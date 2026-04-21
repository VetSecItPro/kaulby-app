import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import {
  users,
  monitors,
  results,
  aiVisibilityChecks,
  emailEvents,
  errorLogs,
  chatMessages,
  activityLogs,
  webhookDeliveries,
} from "@/lib/db/schema";
import { eq, and, or, lt, isNull, isNotNull, inArray, sql, count } from "drizzle-orm";

// Data retention limits by plan (in days) - must match PLANS in plans.ts
const RETENTION_DAYS = {
  free: 3, // Free tier: 3-day history
  pro: 90, // Pro tier: 90-day history
  team: 365, // Team: 1-year history
} as const;

// Task 1.2: retention for previously-unbounded tables.
// Soft-delete first (set deletedAt), then hard-delete after a 30-day grace window
// so we have a recovery path if a rule is misconfigured.
const GRACE_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// aiVisibilityChecks: tier-keyed (90d free / 1y pro / 2y team)
const AI_VISIBILITY_RETENTION_DAYS = {
  free: 90,
  pro: 365,
  team: 730,
} as const;

// emailEvents: 90d for 'sent', 1y for 'opened'/'clicked' (analytics value)
const EMAIL_EVENTS_SENT_DAYS = 90;
const EMAIL_EVENTS_ENGAGEMENT_DAYS = 365;

// errorLogs: 90d for resolved, 1y for unresolved (investigation trail)
const ERROR_LOGS_RESOLVED_DAYS = 90;
const ERROR_LOGS_UNRESOLVED_DAYS = 365;

// chatMessages: 1y soft-delete, hard-delete after 30d grace (= 2y total)
const CHAT_MESSAGES_SOFT_DELETE_DAYS = 365;

// Task DL.3: activityLogs are a compliance audit trail — keep 1 year.
// webhook_deliveries: delivered (success) rows drop after 90d (useful for user
// troubleshooting only); failed rows stay 1 year so we can diagnose recurrent
// endpoint issues. Everything hard-deletes after the shared 30d grace window.
const ACTIVITY_LOGS_RETENTION_DAYS = 365;
const WEBHOOK_DELIVERIES_SUCCESS_DAYS = 90;
const WEBHOOK_DELIVERIES_FAILED_DAYS = 365;

// Minimal shape of the inngest context bits we need. Extracted so the handler
// can be unit-tested with mock step/logger (Task 1.2 tests).
// Use a permissive shape for step.run since Inngest's own signature uses
// ConditionalSimplifyDeep<Jsonify<T>> — we only care that the returned number
// flows back through the Promise chain in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RetentionStep = { run: (id: string, fn: () => Promise<any>) => Promise<any> };
type RetentionLogger = {
  info: (msg: string) => void;
  error?: (msg: string, meta?: unknown) => void;
};

// Extracted handler — exported for direct testing without an Inngest runtime.
export async function runDataRetention({
  step,
  logger,
}: {
  step: RetentionStep;
  logger: RetentionLogger;
}) {
    logger.info("Starting data retention cleanup");

    const now = new Date();
    const cutoffs = {
      free: new Date(now.getTime() - RETENTION_DAYS.free * 24 * 60 * 60 * 1000),
      pro: new Date(now.getTime() - RETENTION_DAYS.pro * 24 * 60 * 60 * 1000),
      team: new Date(now.getTime() - RETENTION_DAYS.team * 24 * 60 * 60 * 1000),
    };

    // PERF-ASYNC-005: Run independent tier cleanups in parallel
    // SECURITY: Drizzle's sql`` template tag safely handles ${table.column} as column references, not raw string interpolation — FIX-115
    const [freeDeleted, proDeleted, teamDeleted] = await Promise.all([
      step.run("cleanup-free-tier", async () => {
        const whereClause = and(
          sql`${results.monitorId} IN (
            SELECT ${monitors.id} FROM ${monitors}
            INNER JOIN ${users} ON ${users.id} = ${monitors.userId}
            WHERE COALESCE(${users.subscriptionStatus}, 'free') = 'free'
          )`,
          lt(results.createdAt, cutoffs.free)
        );
        const [{ value }] = await pooledDb.select({ value: count() }).from(results).where(whereClause);
        if (value > 0) await pooledDb.delete(results).where(whereClause);
        return value;
      }),
      step.run("cleanup-pro-tier", async () => {
        const whereClause = and(
          sql`${results.monitorId} IN (
            SELECT ${monitors.id} FROM ${monitors}
            INNER JOIN ${users} ON ${users.id} = ${monitors.userId}
            WHERE ${users.subscriptionStatus} = 'pro'
          )`,
          lt(results.createdAt, cutoffs.pro),
          eq(results.isSaved, false)
        );
        const [{ value }] = await pooledDb.select({ value: count() }).from(results).where(whereClause);
        if (value > 0) await pooledDb.delete(results).where(whereClause);
        return value;
      }),
      step.run("cleanup-team-tier", async () => {
        const whereClause = and(
          sql`${results.monitorId} IN (
            SELECT ${monitors.id} FROM ${monitors}
            INNER JOIN ${users} ON ${users.id} = ${monitors.userId}
            WHERE ${users.subscriptionStatus} = 'team'
          )`,
          lt(results.createdAt, cutoffs.team),
          eq(results.isSaved, false)
        );
        const [{ value }] = await pooledDb.select({ value: count() }).from(results).where(whereClause);
        if (value > 0) await pooledDb.delete(results).where(whereClause);
        return value;
      }),
    ]);

    const totalDeleted = freeDeleted + proDeleted + teamDeleted;

    // Clean up orphaned results (results with no valid monitor)
    const orphanedDeleted = await step.run("cleanup-orphaned-results", async () => {
      const whereClause = sql`${results.monitorId} NOT IN (SELECT id FROM monitors)`;
      const [{ value }] = await pooledDb.select({ value: count() }).from(results).where(whereClause);
      if (value > 0) await pooledDb.delete(results).where(whereClause);
      return value;
    });

    // ──────────────────────────────────────────────────────────────────────
    // Task 1.2: soft-delete + hard-delete for 4 unbounded tables.
    // Pattern per table:
    //   1. Soft-delete: set deletedAt = now() on rows past the tier/state cutoff
    //      that don't already have deletedAt set.
    //   2. Hard-delete: DELETE rows where deletedAt < now() - 30d (grace window).
    // ──────────────────────────────────────────────────────────────────────

    const hardDeleteCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * DAY_MS);

    // --- aiVisibilityChecks: tier-keyed retention ---
    const aiVisSoftCutoffs = {
      free: new Date(now.getTime() - AI_VISIBILITY_RETENTION_DAYS.free * DAY_MS),
      pro: new Date(now.getTime() - AI_VISIBILITY_RETENTION_DAYS.pro * DAY_MS),
      team: new Date(now.getTime() - AI_VISIBILITY_RETENTION_DAYS.team * DAY_MS),
    };

    const aiVisSoftDeleted = await step.run("soft-delete-ai-visibility", async () => {
      // Tier is resolved through the user's subscriptionStatus via a correlated
      // subquery. We update in a single statement to avoid a read-then-write race.
      const whereClause = and(
        isNull(aiVisibilityChecks.deletedAt),
        or(
          sql`${aiVisibilityChecks.userId} IN (
            SELECT ${users.id} FROM ${users}
            WHERE COALESCE(${users.subscriptionStatus}, 'free') = 'free'
          ) AND ${aiVisibilityChecks.checkedAt} < ${aiVisSoftCutoffs.free}`,
          sql`${aiVisibilityChecks.userId} IN (
            SELECT ${users.id} FROM ${users}
            WHERE ${users.subscriptionStatus} = 'pro'
          ) AND ${aiVisibilityChecks.checkedAt} < ${aiVisSoftCutoffs.pro}`,
          sql`${aiVisibilityChecks.userId} IN (
            SELECT ${users.id} FROM ${users}
            WHERE ${users.subscriptionStatus} = 'team'
          ) AND ${aiVisibilityChecks.checkedAt} < ${aiVisSoftCutoffs.team}`,
        ),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(aiVisibilityChecks).where(whereClause);
      if (value > 0) {
        await pooledDb.update(aiVisibilityChecks).set({ deletedAt: now }).where(whereClause);
      }
      logger.info(`Soft-deleted ${value} aiVisibilityChecks rows`);
      return value;
    });

    const aiVisHardDeleted = await step.run("hard-delete-ai-visibility", async () => {
      const whereClause = and(
        isNotNull(aiVisibilityChecks.deletedAt),
        lt(aiVisibilityChecks.deletedAt, hardDeleteCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(aiVisibilityChecks).where(whereClause);
      if (value > 0) await pooledDb.delete(aiVisibilityChecks).where(whereClause);
      logger.info(`Hard-deleted ${value} aiVisibilityChecks rows (past 30d grace)`);
      return value;
    });

    // --- emailEvents: eventType-keyed retention ---
    const emailSentCutoff = new Date(now.getTime() - EMAIL_EVENTS_SENT_DAYS * DAY_MS);
    const emailEngagementCutoff = new Date(now.getTime() - EMAIL_EVENTS_ENGAGEMENT_DAYS * DAY_MS);

    const emailEventsSoftDeleted = await step.run("soft-delete-email-events", async () => {
      // 'sent' events older than 90d OR 'opened'/'clicked' events older than 1y.
      const whereClause = and(
        isNull(emailEvents.deletedAt),
        or(
          and(eq(emailEvents.eventType, "sent"), lt(emailEvents.createdAt, emailSentCutoff)),
          and(
            inArray(emailEvents.eventType, ["opened", "clicked"]),
            lt(emailEvents.createdAt, emailEngagementCutoff),
          ),
        ),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(emailEvents).where(whereClause);
      if (value > 0) {
        await pooledDb.update(emailEvents).set({ deletedAt: now }).where(whereClause);
      }
      logger.info(`Soft-deleted ${value} emailEvents rows`);
      return value;
    });

    const emailEventsHardDeleted = await step.run("hard-delete-email-events", async () => {
      const whereClause = and(
        isNotNull(emailEvents.deletedAt),
        lt(emailEvents.deletedAt, hardDeleteCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(emailEvents).where(whereClause);
      if (value > 0) await pooledDb.delete(emailEvents).where(whereClause);
      logger.info(`Hard-deleted ${value} emailEvents rows (past 30d grace)`);
      return value;
    });

    // --- errorLogs: resolved vs unresolved retention ---
    const errorLogsResolvedCutoff = new Date(now.getTime() - ERROR_LOGS_RESOLVED_DAYS * DAY_MS);
    const errorLogsUnresolvedCutoff = new Date(now.getTime() - ERROR_LOGS_UNRESOLVED_DAYS * DAY_MS);

    const errorLogsSoftDeleted = await step.run("soft-delete-error-logs", async () => {
      const whereClause = and(
        isNull(errorLogs.deletedAt),
        or(
          and(eq(errorLogs.resolved, true), lt(errorLogs.createdAt, errorLogsResolvedCutoff)),
          and(eq(errorLogs.resolved, false), lt(errorLogs.createdAt, errorLogsUnresolvedCutoff)),
        ),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(errorLogs).where(whereClause);
      if (value > 0) {
        await pooledDb.update(errorLogs).set({ deletedAt: now }).where(whereClause);
      }
      logger.info(`Soft-deleted ${value} errorLogs rows`);
      return value;
    });

    const errorLogsHardDeleted = await step.run("hard-delete-error-logs", async () => {
      const whereClause = and(
        isNotNull(errorLogs.deletedAt),
        lt(errorLogs.deletedAt, hardDeleteCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(errorLogs).where(whereClause);
      if (value > 0) await pooledDb.delete(errorLogs).where(whereClause);
      logger.info(`Hard-deleted ${value} errorLogs rows (past 30d grace)`);
      return value;
    });

    // --- chatMessages: 1y soft / 2y hard (= 30d grace via shared cutoff) ---
    const chatMessagesSoftCutoff = new Date(now.getTime() - CHAT_MESSAGES_SOFT_DELETE_DAYS * DAY_MS);

    const chatMessagesSoftDeleted = await step.run("soft-delete-chat-messages", async () => {
      const whereClause = and(
        isNull(chatMessages.deletedAt),
        lt(chatMessages.createdAt, chatMessagesSoftCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(chatMessages).where(whereClause);
      if (value > 0) {
        await pooledDb.update(chatMessages).set({ deletedAt: now }).where(whereClause);
      }
      logger.info(`Soft-deleted ${value} chatMessages rows`);
      return value;
    });

    const chatMessagesHardDeleted = await step.run("hard-delete-chat-messages", async () => {
      const whereClause = and(
        isNotNull(chatMessages.deletedAt),
        lt(chatMessages.deletedAt, hardDeleteCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(chatMessages).where(whereClause);
      if (value > 0) await pooledDb.delete(chatMessages).where(whereClause);
      logger.info(`Hard-deleted ${value} chatMessages rows (past 30d grace)`);
      return value;
    });

    // ──────────────────────────────────────────────────────────────────────
    // Task DL.3: retention for activity_logs + webhook_deliveries.
    // Same soft-then-hard pattern, different retention horizons per table.
    // ──────────────────────────────────────────────────────────────────────

    // --- activityLogs: 1y audit trail ---
    const activityLogsSoftCutoff = new Date(now.getTime() - ACTIVITY_LOGS_RETENTION_DAYS * DAY_MS);

    const activityLogsSoftDeleted = await step.run("soft-delete-activity-logs", async () => {
      const whereClause = and(
        isNull(activityLogs.deletedAt),
        lt(activityLogs.createdAt, activityLogsSoftCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(activityLogs).where(whereClause);
      if (value > 0) {
        await pooledDb.update(activityLogs).set({ deletedAt: now }).where(whereClause);
      }
      logger.info(`Soft-deleted ${value} activityLogs rows`);
      return value;
    });

    const activityLogsHardDeleted = await step.run("hard-delete-activity-logs", async () => {
      const whereClause = and(
        isNotNull(activityLogs.deletedAt),
        lt(activityLogs.deletedAt, hardDeleteCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(activityLogs).where(whereClause);
      if (value > 0) await pooledDb.delete(activityLogs).where(whereClause);
      logger.info(`Hard-deleted ${value} activityLogs rows (past 30d grace)`);
      return value;
    });

    // --- webhookDeliveries: status-keyed retention ---
    // Keep in-flight rows ("pending"/"retrying") untouched regardless of age —
    // they're actively being processed by retryWebhookDeliveries.
    const webhookDeliveriesSuccessCutoff = new Date(now.getTime() - WEBHOOK_DELIVERIES_SUCCESS_DAYS * DAY_MS);
    const webhookDeliveriesFailedCutoff = new Date(now.getTime() - WEBHOOK_DELIVERIES_FAILED_DAYS * DAY_MS);

    const webhookDeliveriesSoftDeleted = await step.run("soft-delete-webhook-deliveries", async () => {
      const whereClause = and(
        isNull(webhookDeliveries.deletedAt),
        or(
          and(eq(webhookDeliveries.status, "success"), lt(webhookDeliveries.createdAt, webhookDeliveriesSuccessCutoff)),
          and(eq(webhookDeliveries.status, "failed"), lt(webhookDeliveries.createdAt, webhookDeliveriesFailedCutoff)),
        ),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(webhookDeliveries).where(whereClause);
      if (value > 0) {
        await pooledDb.update(webhookDeliveries).set({ deletedAt: now }).where(whereClause);
      }
      logger.info(`Soft-deleted ${value} webhookDeliveries rows`);
      return value;
    });

    const webhookDeliveriesHardDeleted = await step.run("hard-delete-webhook-deliveries", async () => {
      const whereClause = and(
        isNotNull(webhookDeliveries.deletedAt),
        lt(webhookDeliveries.deletedAt, hardDeleteCutoff),
      );
      const [{ value }] = await pooledDb.select({ value: count() }).from(webhookDeliveries).where(whereClause);
      if (value > 0) await pooledDb.delete(webhookDeliveries).where(whereClause);
      logger.info(`Hard-deleted ${value} webhookDeliveries rows (past 30d grace)`);
      return value;
    });

    logger.info(`Data retention cleanup complete. Deleted ${totalDeleted} old results (free: ${freeDeleted}, pro: ${proDeleted}, team: ${teamDeleted}) and ${orphanedDeleted} orphaned results.`);

    return {
      success: true,
      deletedResults: totalDeleted,
      deletedOrphaned: orphanedDeleted,
      breakdown: { free: freeDeleted, pro: proDeleted, team: teamDeleted },
      unboundedTables: {
        aiVisibilityChecks: { softDeleted: aiVisSoftDeleted, hardDeleted: aiVisHardDeleted },
        emailEvents: { softDeleted: emailEventsSoftDeleted, hardDeleted: emailEventsHardDeleted },
        errorLogs: { softDeleted: errorLogsSoftDeleted, hardDeleted: errorLogsHardDeleted },
        chatMessages: { softDeleted: chatMessagesSoftDeleted, hardDeleted: chatMessagesHardDeleted },
        activityLogs: { softDeleted: activityLogsSoftDeleted, hardDeleted: activityLogsHardDeleted },
        webhookDeliveries: { softDeleted: webhookDeliveriesSoftDeleted, hardDeleted: webhookDeliveriesHardDeleted },
      },
    };
}

// Clean up old results based on user's subscription plan
export const dataRetention = inngest.createFunction(
  {
    id: "data-retention",
    name: "Data Retention Cleanup",
    retries: 3,
    timeouts: { finish: "30m" },
  },
  { cron: "0 3 * * 0" }, // Weekly Sunday at 3 AM UTC (retention periods are 3-365 days, weekly is sufficient)
  async ({ step, logger }) => runDataRetention({ step, logger }),
);

// Reset usage counters at the start of each billing period
export const resetUsageCounters = inngest.createFunction(
  {
    id: "reset-usage-counters",
    name: "Reset Usage Counters",
    retries: 3,
    timeouts: { finish: "10m" },
  },
  { cron: "0 0 * * *" }, // Run daily at midnight UTC
  async ({ step, logger }) => {
    logger.info("Checking for usage periods to reset");

    const now = new Date();

    // Get users whose billing period has ended
    const usersToReset = await step.run("get-users-to-reset", async () => {
      return await pooledDb.query.users.findMany({
        where: lt(users.currentPeriodEnd, now),
        columns: {
          id: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          subscriptionStatus: true,
        },
      });
    });

    if (usersToReset.length === 0) {
      logger.info("No users need usage reset");
      return { success: true, resetCount: 0 };
    }

    logger.info(`Resetting usage for ${usersToReset.length} users`);

    let resetCount = 0;

    for (const user of usersToReset) {
      await step.run(`reset-usage-${user.id}`, async () => {
        // Calculate new period dates (monthly)
        const newPeriodStart = new Date();
        const newPeriodEnd = new Date();
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

        // Update user's period dates
        await pooledDb
          .update(users)
          .set({
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        resetCount++;
      });
    }

    logger.info(`Reset usage for ${resetCount} users`);

    return {
      success: true,
      resetCount,
    };
  }
);

// Clean up old AI logs (keep 90 days for all users)
export const cleanupAiLogs = inngest.createFunction(
  {
    id: "cleanup-ai-logs",
    name: "Cleanup AI Logs",
    retries: 3,
    timeouts: { finish: "15m" },
  },
  { cron: "0 4 * * 0" }, // Run weekly on Sunday at 4 AM UTC
  async ({ step, logger }) => {
    logger.info("Starting AI logs cleanup");

    const deleted = await step.run("delete-old-ai-logs", async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const { aiLogs } = await import("@/lib/db/schema");

      const [{ value }] = await pooledDb.select({ value: count() }).from(aiLogs).where(lt(aiLogs.createdAt, cutoffDate));
      if (value > 0) await pooledDb.delete(aiLogs).where(lt(aiLogs.createdAt, cutoffDate));
      return value;
    });

    logger.info(`Deleted ${deleted} old AI log entries`);

    return {
      success: true,
      deletedLogs: deleted,
    };
  }
);
