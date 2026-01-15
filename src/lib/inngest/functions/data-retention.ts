import { inngest } from "../client";
import { db } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import { eq, and, lt, inArray, sql } from "drizzle-orm";

// Data retention limits by plan (in days) - must match PLANS in stripe.ts
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
  },
  { cron: "0 3 * * *" }, // Run daily at 3 AM UTC
  async ({ step, logger }) => {
    logger.info("Starting data retention cleanup");

    // Get all users with their subscription status
    const allUsers = await step.run("get-all-users", async () => {
      return await db.query.users.findMany({
        columns: {
          id: true,
          subscriptionStatus: true,
        },
      });
    });

    logger.info(`Processing ${allUsers.length} users for data retention`);

    let totalDeleted = 0;

    // Process each user
    for (const user of allUsers) {
      const deleted = await step.run(`cleanup-user-${user.id}`, async () => {
        const plan = user.subscriptionStatus || "free";
        const retentionDays = RETENTION_DAYS[plan];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // Get user's monitors
        const userMonitors = await db.query.monitors.findMany({
          where: eq(monitors.userId, user.id),
          columns: { id: true },
        });

        if (userMonitors.length === 0) {
          return 0;
        }

        const monitorIds = userMonitors.map((m) => m.id);

        // Delete old results (but keep saved ones for pro/enterprise)
        const deleteConditions = plan === "free"
          ? // Free users: delete all old results regardless of saved status
            and(
              inArray(results.monitorId, monitorIds),
              lt(results.createdAt, cutoffDate)
            )
          : // Pro/Enterprise: delete old results but keep saved ones
            and(
              inArray(results.monitorId, monitorIds),
              lt(results.createdAt, cutoffDate),
              eq(results.isSaved, false)
            );

        const deleteResult = await db
          .delete(results)
          .where(deleteConditions)
          .returning({ id: results.id });

        return deleteResult.length;
      });

      totalDeleted += deleted;
    }

    // Also clean up orphaned results (results with no valid monitor)
    // Uses SQL subquery instead of loading all data into memory
    const orphanedDeleted = await step.run("cleanup-orphaned-results", async () => {
      const deleteResult = await db
        .delete(results)
        .where(
          sql`${results.monitorId} NOT IN (SELECT id FROM monitors)`
        )
        .returning({ id: results.id });

      return deleteResult.length;
    });

    logger.info(`Data retention cleanup complete. Deleted ${totalDeleted} old results and ${orphanedDeleted} orphaned results.`);

    return {
      success: true,
      deletedResults: totalDeleted,
      deletedOrphaned: orphanedDeleted,
    };
  }
);

// Reset usage counters at the start of each billing period
export const resetUsageCounters = inngest.createFunction(
  {
    id: "reset-usage-counters",
    name: "Reset Usage Counters",
    retries: 3,
  },
  { cron: "0 0 * * *" }, // Run daily at midnight UTC
  async ({ step, logger }) => {
    logger.info("Checking for usage periods to reset");

    const now = new Date();

    // Get users whose billing period has ended
    const usersToReset = await step.run("get-users-to-reset", async () => {
      return await db.query.users.findMany({
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
        await db
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
  },
  { cron: "0 4 * * 0" }, // Run weekly on Sunday at 4 AM UTC
  async ({ step, logger }) => {
    logger.info("Starting AI logs cleanup");

    const deleted = await step.run("delete-old-ai-logs", async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const { aiLogs } = await import("@/lib/db/schema");

      const deleteResult = await db
        .delete(aiLogs)
        .where(lt(aiLogs.createdAt, cutoffDate))
        .returning({ id: aiLogs.id });

      return deleteResult.length;
    });

    logger.info(`Deleted ${deleted} old AI log entries`);

    return {
      success: true,
      deletedLogs: deleted,
    };
  }
);
