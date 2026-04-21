/**
 * Monday 9am weekly digest cron (Task 2.4).
 *
 * This is distinct from the existing `sendWeeklyDigest` in send-alerts.ts,
 * which is gated on explicit per-monitor "weekly" alert subscriptions. This
 * new cron is an automatic "your week at a glance" recap for EVERY pro/team
 * user who hasn't opted out via weeklyDigestEnabled=false.
 *
 * Schedule: `0 9 * * 1` — Monday 9am UTC (simple single-fire, no per-user
 * timezone fan-out; per-timezone send is already handled by the alert-based
 * weekly digest path).
 *
 * Gating:
 *   - subscriptionStatus ∈ {pro, team}
 *   - weeklyDigestEnabled != false
 *   - digestPaused != true   (respect the global pause flag too)
 *
 * Cost per eligible user: 1 jsonCompletion call (~$0.005-0.02), logged to
 * aiLogs.analysisType="weekly-insights" by computeWeeklyInsightsFor.
 */

import { inngest } from "../client";
import { pooledDb, users, results, monitors } from "@/lib/db";
import { eq, and, gte, inArray, or, ne, isNull } from "drizzle-orm";
import { sendWeeklyDigestEmail } from "@/lib/email";
import { computeWeeklyInsightsFor } from "./weekly-insights-helper";
import { signTrackingParams } from "@/lib/security/hmac";
import { logger } from "@/lib/logger";

const APP_URL = "https://kaulbyapp.com";

/** Build the HMAC-signed one-click unsubscribe link for weeklyDigestEnabled=false. */
function buildUnsubscribeUrl(userId: string): string {
  const sig = signTrackingParams({
    eid: userId,
    uid: userId,
    type: "weekly-digest-unsub",
    url: "",
  });
  return `${APP_URL}/api/user/weekly-digest-unsubscribe?uid=${encodeURIComponent(userId)}&sig=${sig}`;
}

/** Minimal Inngest step interface the handler depends on. */
interface WeeklyDigestStep {
  run<T>(id: string, callback: () => Promise<T>): Promise<T>;
}

/**
 * Pure handler — exported separately so tests can invoke it without
 * touching the Inngest runtime. The Inngest-wrapped export below simply
 * delegates to this function.
 */
export async function runSendWeeklyDigest({ step }: { step: WeeklyDigestStep }) {
    // Eligible users: pro/team, not paused, not opted out.
    const eligibleUsers = await step.run("get-eligible-users", async () => {
      return pooledDb.query.users.findMany({
        where: and(
          inArray(users.subscriptionStatus, ["pro", "team"] as const),
          eq(users.weeklyDigestEnabled, true),
          eq(users.digestPaused, false)
        ),
        columns: {
          id: true,
          email: true,
          name: true,
          subscriptionStatus: true,
        },
      });
    });

    if (eligibleUsers.length === 0) {
      return { sent: 0, skipped: 0, reason: "No eligible users" };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    let sent = 0;
    let skippedNoResults = 0;
    let failed = 0;

    for (const user of eligibleUsers) {
      try {
        // Scope the window to this user's own monitors' results.
        // One query per user is acceptable — Monday-morning fan-out is small
        // (hundreds, not millions), and results are indexed by monitorId.
        const userResults = await step.run(`get-results-${user.id}`, async () => {
          const userMonitors = await pooledDb.query.monitors.findMany({
            where: eq(monitors.userId, user.id),
            columns: { id: true, name: true },
          });
          const monitorIds = userMonitors.map((m) => m.id);
          if (monitorIds.length === 0) {
            return { results: [], monitors: userMonitors };
          }

          const rows = await pooledDb.query.results.findMany({
            where: and(
              inArray(results.monitorId, monitorIds),
              gte(results.createdAt, cutoffDate),
              // Exclude failed AI rows — their sentiment is null and would
              // skew the "positive %" stat in the hero.
              or(ne(results.aiAnalyzed, false), isNull(results.aiAnalyzed))
            ),
            orderBy: (results, { desc }) => [desc(results.createdAt)],
            limit: 2000,
          });
          return { results: rows, monitors: userMonitors };
        });

        if (userResults.results.length === 0) {
          skippedNoResults++;
          continue;
        }

        // Compute AI insights (shared helper — also used by send-alerts.ts).
        const insights = await computeWeeklyInsightsFor(
          user.id,
          userResults.results.map((r) => ({
            title: r.title,
            content: r.content,
            platform: r.platform,
            sentiment: r.sentiment,
            painPointCategory: r.painPointCategory,
            aiSummary: r.aiSummary,
          })),
          step
        );

        // Build top-monitor summary.
        const monitorNameById = new Map(
          userResults.monitors.map((m) => [m.id, m.name])
        );
        const monitorCounts = new Map<string, number>();
        for (const r of userResults.results) {
          monitorCounts.set(r.monitorId, (monitorCounts.get(r.monitorId) || 0) + 1);
        }
        const topMonitors = Array.from(monitorCounts.entries())
          .map(([id, count]) => ({
            name: monitorNameById.get(id) || "Monitor",
            resultsCount: count,
          }))
          .sort((a, b) => b.resultsCount - a.resultsCount);

        await step.run(`send-${user.id}`, async () => {
          await sendWeeklyDigestEmail({
            to: user.email,
            userName: user.name || "there",
            userId: user.id,
            totalMentions: userResults.results.length,
            insights,
            topMonitors,
            unsubscribeUrl: buildUnsubscribeUrl(user.id),
          });
        });
        sent++;
      } catch (error) {
        failed++;
        logger.error("Weekly digest send failed", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      eligible: eligibleUsers.length,
      sent,
      skippedNoResults,
      failed,
    };
}

export const sendWeeklyDigestCron = inngest.createFunction(
  {
    id: "send-weekly-digest-cron",
    name: "Weekly Digest (Monday 9am, pro/team)",
    retries: 2,
    timeouts: { finish: "30m" },
  },
  { cron: "0 9 * * 1" }, // Monday 09:00 UTC
  async ({ step }) => runSendWeeklyDigest({ step: step as unknown as WeeklyDigestStep })
);
