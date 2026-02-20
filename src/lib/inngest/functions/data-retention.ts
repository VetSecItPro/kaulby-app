import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import { eq, and, lt, sql, count } from "drizzle-orm";

// Data retention limits by plan (in days) - must match PLANS in plans.ts
const RETENTION_DAYS = {
  free: 3, // Free tier: 3-day history
  pro: 90, // Pro tier: 90-day history
  enterprise: 365, // Enterprise: 1-year history
} as const;

// Clean up old results based on user's subscription plan
export const dataRetention = inngest.createFunction(
  {
    id: "data-retention",
    name: "Data Retention Cleanup",
    retries: 3,
    timeouts: { finish: "30m" },
  },
  { cron: "0 3 * * *" }, // Run daily at 3 AM UTC
  async ({ step, logger }) => {
    logger.info("Starting data retention cleanup");

    const now = new Date();
    const cutoffs = {
      free: new Date(now.getTime() - RETENTION_DAYS.free * 24 * 60 * 60 * 1000),
      pro: new Date(now.getTime() - RETENTION_DAYS.pro * 24 * 60 * 60 * 1000),
      enterprise: new Date(now.getTime() - RETENTION_DAYS.enterprise * 24 * 60 * 60 * 1000),
    };

    // PERF-ASYNC-005: Run independent tier cleanups in parallel
    // SECURITY: Drizzle's sql`` template tag safely handles ${table.column} as column references, not raw string interpolation — FIX-115
    const [freeDeleted, proDeleted, enterpriseDeleted] = await Promise.all([
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
      step.run("cleanup-enterprise-tier", async () => {
        const whereClause = and(
          sql`${results.monitorId} IN (
            SELECT ${monitors.id} FROM ${monitors}
            INNER JOIN ${users} ON ${users.id} = ${monitors.userId}
            WHERE ${users.subscriptionStatus} = 'enterprise'
          )`,
          lt(results.createdAt, cutoffs.enterprise),
          eq(results.isSaved, false)
        );
        const [{ value }] = await pooledDb.select({ value: count() }).from(results).where(whereClause);
        if (value > 0) await pooledDb.delete(results).where(whereClause);
        return value;
      }),
    ]);

    const totalDeleted = freeDeleted + proDeleted + enterpriseDeleted;

    // Clean up orphaned results (results with no valid monitor)
    const orphanedDeleted = await step.run("cleanup-orphaned-results", async () => {
      const whereClause = sql`${results.monitorId} NOT IN (SELECT id FROM monitors)`;
      const [{ value }] = await pooledDb.select({ value: count() }).from(results).where(whereClause);
      if (value > 0) await pooledDb.delete(results).where(whereClause);
      return value;
    });

    logger.info(`Data retention cleanup complete. Deleted ${totalDeleted} old results (free: ${freeDeleted}, pro: ${proDeleted}, enterprise: ${enterpriseDeleted}) and ${orphanedDeleted} orphaned results.`);

    return {
      success: true,
      deletedResults: totalDeleted,
      deletedOrphaned: orphanedDeleted,
      breakdown: { free: freeDeleted, pro: proDeleted, enterprise: enterpriseDeleted },
    };
  }
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
