/**
 * Phase 5: hand-coded alerts cron.
 *
 * Every 15 minutes: read latest vendor_metrics + recent scan failures,
 * check threshold rules, send admin email when a rule fires.
 *
 * Cooldown: each rule has its own cooldown row in vendor_metrics
 * (vendor='_alerts', metric='last_fired_<rule_id>'). We re-fire only if
 * the most recent firing is older than the rule's cooldownMinutes.
 *
 * This is intentionally simple. Phase 9 (alert rules engine, deferred)
 * will replace this with a configurable rules table + UI when we have
 * 15+ rules and an admin wants to add them without a deploy.
 */

import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb, db } from "@/lib/db";
import { vendorMetrics, monitors } from "@/lib/db/schema";
import { and, gte, isNotNull, sql } from "drizzle-orm";
import { sendEmailWithRetry } from "@/lib/email/send-with-retry";

interface FiredAlert {
  ruleId: string;
  severity: "warning" | "critical";
  subject: string;
  body: string;
}

interface RuleEvaluation {
  ruleId: string;
  cooldownMinutes: number;
  fired: FiredAlert | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLD RULES
// ─────────────────────────────────────────────────────────────────────────────

interface VendorMetricSnapshot {
  vendor: string;
  metric: string;
  value: number | null;
  metadata: unknown;
}

function findMetric(
  snapshots: VendorMetricSnapshot[],
  vendor: string,
  metric: string,
): VendorMetricSnapshot | undefined {
  return snapshots.find((s) => s.vendor === vendor && s.metric === metric);
}

function evaluateApifyQuota(snapshots: VendorMetricSnapshot[]): RuleEvaluation {
  const pct = findMetric(snapshots, "apify", "monthly_usage_pct");
  if (pct?.value == null) return { ruleId: "apify_quota", cooldownMinutes: 1440, fired: null };
  if (pct.value >= 95) {
    return {
      ruleId: "apify_quota",
      cooldownMinutes: 1440,
      fired: {
        ruleId: "apify_quota",
        severity: "critical",
        subject: `[Kaulby/CRITICAL] Apify quota at ${pct.value.toFixed(0)}%`,
        body: `Apify monthly usage is at ${pct.value.toFixed(1)}% of plan limit. Scans will start failing soon when the quota exhausts. Action: upgrade Apify plan or migrate hot scrapers to self-hosted.`,
      },
    };
  }
  if (pct.value >= 75) {
    return {
      ruleId: "apify_quota",
      cooldownMinutes: 1440,
      fired: {
        ruleId: "apify_quota",
        severity: "warning",
        subject: `[Kaulby/WARN] Apify quota at ${pct.value.toFixed(0)}%`,
        body: `Apify monthly usage at ${pct.value.toFixed(1)}% of plan limit. Cron will continue but you'll hit the wall this billing cycle if usage holds.`,
      },
    };
  }
  return { ruleId: "apify_quota", cooldownMinutes: 1440, fired: null };
}

function evaluateOpenRouterCredit(snapshots: VendorMetricSnapshot[]): RuleEvaluation {
  const rem = findMetric(snapshots, "openrouter", "credit_remaining_usd");
  if (rem?.value == null) return { ruleId: "openrouter_credit", cooldownMinutes: 1440, fired: null };
  if (rem.value < 1) {
    return {
      ruleId: "openrouter_credit",
      cooldownMinutes: 360,
      fired: {
        ruleId: "openrouter_credit",
        severity: "critical",
        subject: `[Kaulby/CRITICAL] OpenRouter credit $${rem.value.toFixed(2)} — AI calls will fail soon`,
        body: `OpenRouter credit balance is $${rem.value.toFixed(2)}. AI sentiment/persona analysis will start failing when credit hits zero. Top up at https://openrouter.ai/credits.`,
      },
    };
  }
  if (rem.value < 5) {
    return {
      ruleId: "openrouter_credit",
      cooldownMinutes: 1440,
      fired: {
        ruleId: "openrouter_credit",
        severity: "warning",
        subject: `[Kaulby/WARN] OpenRouter credit $${rem.value.toFixed(2)}`,
        body: `OpenRouter credit balance is $${rem.value.toFixed(2)}. Top up before it hits zero to avoid AI analysis failures.`,
      },
    };
  }
  return { ruleId: "openrouter_credit", cooldownMinutes: 1440, fired: null };
}

function evaluateXaiKey(snapshots: VendorMetricSnapshot[]): RuleEvaluation {
  const active = findMetric(snapshots, "xai", "key_active");
  if (active?.value === 0) {
    return {
      ruleId: "xai_key_disabled",
      cooldownMinutes: 360,
      fired: {
        ruleId: "xai_key_disabled",
        severity: "critical",
        subject: `[Kaulby/CRITICAL] xAI API key disabled — X scanning broken`,
        body: `The xAI API key is reporting disabled state. X (Twitter) monitor scans will fail. Check console.x.ai for billing or key rotation issues.`,
      },
    };
  }
  return { ruleId: "xai_key_disabled", cooldownMinutes: 360, fired: null };
}

async function evaluateScanFailureRate(): Promise<RuleEvaluation> {
  // Recent failures vs total monitor-checks in the last hour. We don't track
  // successful checks directly, but we can use lastCheckFailedAt vs total
  // active monitors for a rough proxy.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const failuresRow = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(monitors)
    .where(
      and(
        isNotNull(monitors.lastCheckFailedAt),
        gte(monitors.lastCheckFailedAt, oneHourAgo),
      ),
    );

  const totalRow = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(monitors);

  const failures = Number(failuresRow[0]?.count ?? 0);
  const total = Number(totalRow[0]?.count ?? 1);
  const rate = total > 0 ? (failures / total) * 100 : 0;

  if (rate >= 25) {
    return {
      ruleId: "scan_failure_rate",
      cooldownMinutes: 60,
      fired: {
        ruleId: "scan_failure_rate",
        severity: "critical",
        subject: `[Kaulby/CRITICAL] ${rate.toFixed(1)}% of monitors failing`,
        body: `${failures} of ${total} monitors have a recent (last 1h) failure. This usually means a vendor is down or a scraper is broken. Check /manage/observability/failures.`,
      },
    };
  }
  if (rate >= 10) {
    return {
      ruleId: "scan_failure_rate",
      cooldownMinutes: 60,
      fired: {
        ruleId: "scan_failure_rate",
        severity: "warning",
        subject: `[Kaulby/WARN] ${rate.toFixed(1)}% of monitors failing`,
        body: `${failures} of ${total} monitors have a recent (last 1h) failure. Investigate at /manage/observability/failures.`,
      },
    };
  }
  return { ruleId: "scan_failure_rate", cooldownMinutes: 60, fired: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// COOLDOWN HANDLING
// ─────────────────────────────────────────────────────────────────────────────

async function getRecentAlertFirings(): Promise<Map<string, Date>> {
  const rows = await db.execute<{ metric: string; recorded_at: Date }>(sql`
    SELECT DISTINCT ON (metric) metric, recorded_at
    FROM vendor_metrics
    WHERE vendor = '_alerts' AND metric LIKE 'last_fired_%'
    ORDER BY metric, recorded_at DESC
  `);
  const map = new Map<string, Date>();
  for (const r of rows.rows) {
    const ruleId = r.metric.replace("last_fired_", "");
    map.set(ruleId, r.recorded_at as Date);
  }
  return map;
}

function isInCooldown(
  ruleId: string,
  cooldownMinutes: number,
  recentFirings: Map<string, Date>,
): boolean {
  const lastFired = recentFirings.get(ruleId);
  if (!lastFired) return false;
  const ageMinutes = (Date.now() - lastFired.getTime()) / 60_000;
  return ageMinutes < cooldownMinutes;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON
// ─────────────────────────────────────────────────────────────────────────────

export const checkVendorThresholds = inngest.createFunction(
  {
    id: "check-vendor-thresholds",
    name: "Check Vendor Thresholds (Alerts)",
    retries: 1,
    timeouts: { finish: "3m" },
    concurrency: { limit: 1 },
  },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (!adminEmail) {
      logger.info("[check-vendor-thresholds] ADMIN_ALERT_EMAIL not set — skipping");
      return { skipped: true, reason: "ADMIN_ALERT_EMAIL not set" };
    }

    // Latest snapshot per (vendor, metric).
    const snapshots = await step.run("load-vendor-metrics", async () => {
      const rows = await db.execute<{
        vendor: string;
        metric: string;
        value: number | null;
        metadata: unknown;
        recorded_at: Date;
      }>(sql`
        SELECT DISTINCT ON (vendor, metric)
          vendor, metric, value, metadata, recorded_at
        FROM vendor_metrics
        WHERE recorded_at > NOW() - INTERVAL '6 hours'
          AND vendor != '_alerts'
        ORDER BY vendor, metric, recorded_at DESC
      `);
      return rows.rows.map((r) => ({
        vendor: r.vendor,
        metric: r.metric,
        value: r.value != null ? Number(r.value) : null,
        metadata: r.metadata,
      }));
    });

    const recentFirings = await step.run("load-cooldowns", async () => {
      const map = await getRecentAlertFirings();
      // Convert Map to plain object for JSON-safe step return.
      return Object.fromEntries(Array.from(map.entries()).map(([k, v]) => [k, v.toISOString()]));
    });
    const cooldownMap = new Map<string, Date>(
      Object.entries(recentFirings).map(([k, v]) => [k, new Date(v as string)]),
    );

    const failureRateEval = await step.run("eval-scan-failure-rate", () => evaluateScanFailureRate());

    const evaluations: RuleEvaluation[] = [
      evaluateApifyQuota(snapshots),
      evaluateOpenRouterCredit(snapshots),
      evaluateXaiKey(snapshots),
      failureRateEval,
    ];

    const toFire = evaluations.filter((e) => e.fired && !isInCooldown(e.ruleId, e.cooldownMinutes, cooldownMap));

    if (toFire.length === 0) {
      return {
        evaluated: evaluations.length,
        firedCount: 0,
        skippedDueToCooldown: evaluations.filter((e) => e.fired && isInCooldown(e.ruleId, e.cooldownMinutes, cooldownMap)).length,
      };
    }

    // Send one email per fired alert; cooldown gate is per-rule.
    for (const evalResult of toFire) {
      if (!evalResult.fired) continue;
      await step.run(`send-${evalResult.fired.ruleId}`, async () => {
        const result = await sendEmailWithRetry({
          from: "Kaulby Alerts <alerts@kaulbyapp.com>",
          to: adminEmail,
          subject: evalResult.fired!.subject,
          text: `${evalResult.fired!.body}\n\nRule: ${evalResult.fired!.ruleId}\nSeverity: ${evalResult.fired!.severity}\nDashboard: https://kaulbyapp.com/manage/observability\n\n(Sent by check-vendor-thresholds cron)`,
          emailType: "admin_threshold_alert",
        });
        if (!result.success) {
          logger.error("[check-vendor-thresholds] failed to send", { ruleId: evalResult.fired!.ruleId, error: result.error });
        }
        return result;
      });

      // Write cooldown marker.
      await step.run(`mark-cooldown-${evalResult.fired.ruleId}`, async () => {
        await pooledDb.insert(vendorMetrics).values({
          vendor: "_alerts",
          metric: `last_fired_${evalResult.fired!.ruleId}`,
          value: evalResult.fired!.severity === "critical" ? 2 : 1,
          metadata: { subject: evalResult.fired!.subject, severity: evalResult.fired!.severity },
        });
      });
    }

    return {
      evaluated: evaluations.length,
      firedCount: toFire.length,
      firedRules: toFire.map((e) => e.fired?.ruleId),
    };
  },
);
