/**
 * AI Quality Canary — periodic health check for the analyze-content pipeline.
 *
 * Runs every 6 hours. Scans a dedicated canary monitor (high-volume keyword,
 * admin account) and audits the resulting AI summaries against persona-voice
 * and antipattern thresholds defined in src/__tests__/ai/quality-baseline.json.
 *
 * Why this exists: on 2026-04-23, analyze-content entered an Inngest
 * "deploy-orphan" state where events queued with zero runs for 4+ hours
 * before being noticed via manual smoke test. This canary turns that class
 * of silent outage into a 30-min-max detection window.
 *
 * Metrics emitted per run (PostHog event: ai_quality_check):
 * - ai_logs_count: number of aiLogs entries since run start
 * - results_audited: number of summaries probed this cycle
 * - persona_rate, generic_rate, robotic_rate, banned_opener_rate
 * - avg_summary_length
 * - hard_floor_violations: array of failed hard-floor names
 *
 * Alerting: any hard-floor violation triggers a critical Sentry event.
 * Soft threshold drift is PostHog-only (dashboards catch trends).
 */

import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { results, aiLogs, monitors } from "@/lib/db/schema";
import { and, eq, gte, isNotNull, desc, sql } from "drizzle-orm";
import { runQualityProbes } from "@/lib/ai/quality-probes";
import { captureEvent } from "@/lib/posthog";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import baseline from "@/__tests__/ai/quality-baseline.json";

// Dedicated admin account running the canary. This is the same vetsecitpro@
// admin we use for smoke tests — reusing their workspace avoids creating a
// phantom billing record for a synthetic user.
const CANARY_USER_ID = "user_38cUc0dnmQulZ7l4h7gCuDsXklh";

// Canary monitor name. The setup script creates one with this exact name
// (see scripts/setup-canary-monitor.ts). If missing, the canary logs and
// exits rather than creating it automatically — an unclaimed monitor would
// surface as a real-looking artifact in the dashboard.
const CANARY_MONITOR_NAME = "[CANARY] AI quality — inngest";

// How long to wait for analyze-content to populate after the scan fires.
// 4 min covers the worst-case scan + concurrency-capped AI analysis time
// observed in prod (scan ~60s, analyze batch ~2-3 min for 20 results at
// concurrency=5).
const AI_POLL_TIMEOUT_MS = 4 * 60 * 1000;
const AI_POLL_INTERVAL_MS = 20 * 1000;

export const aiQualityCanary = inngest.createFunction(
  {
    id: "ai-quality-canary",
    name: "AI Quality Canary (6h)",
    retries: 1,
    timeouts: { finish: "10m" },
  },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const runStartedAt = new Date();

    // Step 1: Find the canary monitor. If it doesn't exist, log + exit.
    const canaryMonitor = await step.run("find-canary-monitor", async () => {
      const m = await pooledDb.query.monitors.findFirst({
        where: and(
          eq(monitors.userId, CANARY_USER_ID),
          eq(monitors.name, CANARY_MONITOR_NAME),
          eq(monitors.isActive, true),
        ),
      });
      return m ?? null;
    });

    if (!canaryMonitor) {
      logger.warn("[ai-quality-canary] Canary monitor not found — skipping run", {
        expectedName: CANARY_MONITOR_NAME,
        hint: "Run scripts/setup-canary-monitor.ts to create it",
      });
      return { skipped: true, reason: "canary_monitor_missing" };
    }

    // Step 2: Fire a scan for the canary monitor.
    await step.sendEvent("fire-canary-scan", {
      name: "monitor/scan-now",
      data: {
        monitorId: canaryMonitor.id,
        userId: CANARY_USER_ID,
      },
    });

    // Step 3: Poll for AI summaries to populate. We only audit results that
    // landed AFTER runStartedAt — old cached summaries from prior runs would
    // skew the measurement (they got made under a potentially older prompt).
    const freshResults = await step.run("poll-for-ai-analysis", async () => {
      const deadline = Date.now() + AI_POLL_TIMEOUT_MS;
      let last: Array<{ aiSummary: string | null }> = [];
      while (Date.now() < deadline) {
        last = await pooledDb
          .select({ aiSummary: results.aiSummary })
          .from(results)
          .where(
            and(
              eq(results.monitorId, canaryMonitor.id),
              gte(results.createdAt, runStartedAt),
              isNotNull(results.aiSummary),
              eq(results.aiAnalyzed, true),
            ),
          )
          .orderBy(desc(results.createdAt))
          .limit(40);
        if (last.length >= 5) return last;
        await new Promise((r) => setTimeout(r, AI_POLL_INTERVAL_MS));
      }
      return last;
    });

    // Step 4: Count aiLogs that landed since run start for THIS canary user.
    // This is the load-bearing signal for the 2026-04-23 incident class:
    // if scan-on-demand worked but analyze-content is silent, events emit
    // but zero rows appear here.
    const aiLogsCount = await step.run("count-ai-logs", async () => {
      const row = await pooledDb
        .select({ count: sql<number>`count(*)::int` })
        .from(aiLogs)
        .where(
          and(
            eq(aiLogs.userId, CANARY_USER_ID),
            gte(aiLogs.createdAt, runStartedAt),
          ),
        );
      return row[0]?.count ?? 0;
    });

    // Step 5: Compute quality metrics over the fresh summaries.
    const summaries = freshResults
      .map((r) => r.aiSummary)
      .filter((s): s is string => typeof s === "string" && s.length > 0);
    const metrics = runQualityProbes(summaries);

    // Step 6: Check hard floors. Any violation is a critical alarm.
    const hardFloorViolations: string[] = [];
    if (aiLogsCount < baseline.hard_floors.ai_logs_count_since_run_start.min) {
      hardFloorViolations.push("ai_logs_count_since_run_start");
    }
    if (metrics.total > 0) {
      if (metrics.personaRate < baseline.hard_floors.persona_rate.min) {
        hardFloorViolations.push("persona_rate");
      }
      if (metrics.roboticRate > baseline.hard_floors.robotic_rate.max) {
        hardFloorViolations.push("robotic_rate");
      }
      if (metrics.bannedOpenerRate > baseline.hard_floors.banned_opener_rate.max) {
        hardFloorViolations.push("banned_opener_rate");
      }
    }

    // Step 7: Emit to PostHog (always — dashboards need every cycle's data
    // for trend lines, not just the failures).
    await step.run("emit-posthog", async () => {
      captureEvent({
        distinctId: CANARY_USER_ID,
        event: "ai_quality_check",
        properties: {
          run_started_at: runStartedAt.toISOString(),
          monitor_id: canaryMonitor.id,
          ai_logs_count: aiLogsCount,
          results_audited: metrics.total,
          persona_rate: metrics.personaRate,
          generic_rate: metrics.genericRate,
          robotic_rate: metrics.roboticRate,
          banned_opener_rate: metrics.bannedOpenerRate,
          avg_summary_length: metrics.avgLength,
          hard_floor_violations: hardFloorViolations,
          passed: hardFloorViolations.length === 0,
        },
      });
    });

    // Step 8: Sentry alert on hard-fail. We use captureMessage (not exception)
    // because this isn't a code error — it's a downstream health regression.
    if (hardFloorViolations.length > 0) {
      Sentry.captureMessage(
        `AI quality canary hard-floor violation: ${hardFloorViolations.join(", ")}`,
        {
          level: "error",
          tags: { canary: "ai-quality" },
          extra: {
            violations: hardFloorViolations,
            metrics,
            aiLogsCount,
            runStartedAt: runStartedAt.toISOString(),
          },
        },
      );
      logger.error("[ai-quality-canary] HARD FLOOR VIOLATION", {
        violations: hardFloorViolations,
        metrics,
        aiLogsCount,
      });
    } else {
      logger.info("[ai-quality-canary] pass", {
        personaRate: metrics.personaRate,
        total: metrics.total,
        aiLogsCount,
      });
    }

    return {
      passed: hardFloorViolations.length === 0,
      aiLogsCount,
      metrics,
      hardFloorViolations,
    };
  },
);
