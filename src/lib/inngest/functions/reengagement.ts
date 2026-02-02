/**
 * Re-engagement System - Churn Prevention
 *
 * Detects inactive users and sends re-engagement emails to bring them back.
 * Runs daily at 10 AM UTC to catch users who haven't been active in 7+ days.
 */

import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import { eq, lt, and, isNull, gte, desc, count } from "drizzle-orm";
import { sendReengagementEmail } from "@/lib/email";

// Thresholds
const INACTIVE_DAYS = 7; // Days without activity before sending email
const COOLDOWN_DAYS = 30; // Days to wait before sending another re-engagement email

/**
 * Daily cron job to find inactive users and send re-engagement emails
 * Runs at 10 AM UTC every day
 */
export const detectInactiveUsers = inngest.createFunction(
  {
    id: "detect-inactive-users",
    name: "Detect Inactive Users",
    concurrency: 1,
    timeouts: { finish: "15m" },
  },
  { cron: "0 10 * * *" }, // 10 AM UTC daily
  async ({ step }) => {
    const now = new Date();
    const inactiveThreshold = new Date(
      now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000
    );
    const cooldownThreshold = new Date(
      now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );

    // Find inactive users who:
    // 1. Have lastActiveAt before the inactive threshold OR lastActiveAt is null (never tracked)
    // 2. Haven't received a re-engagement email recently (or never)
    // 3. Are paying users (Pro or Enterprise) - focus on revenue retention
    // 4. Are not banned
    // 5. Haven't requested account deletion
    const inactiveUsers = await step.run("find-inactive-users", async () => {
      return pooledDb.query.users.findMany({
        where: and(
          // Active subscription
          gte(users.subscriptionStatus, "pro"),
          // Not banned
          eq(users.isBanned, false),
          // No pending deletion
          isNull(users.deletionRequestedAt),
          // Either never active or inactive for 7+ days
          // Note: If lastActiveAt is null, we use createdAt as fallback
          lt(users.lastActiveAt, inactiveThreshold)
        ),
        columns: {
          id: true,
          email: true,
          name: true,
          lastActiveAt: true,
          reengagementEmailSentAt: true,
          subscriptionStatus: true,
        },
      });
    });

    // Filter out users who received re-engagement email recently
    const eligibleUsers = inactiveUsers.filter((user) => {
      if (!user.reengagementEmailSentAt) return true;
      const sentAt = new Date(user.reengagementEmailSentAt);
      return sentAt < cooldownThreshold;
    });

    // Process each inactive user
    const processed: string[] = [];
    const skipped: string[] = [];

    for (const user of eligibleUsers) {
      // Get user's stats for personalized email
      const stats = await step.run(`get-stats-${user.id}`, async () => {
        // Count active monitors
        const [monitorCount] = await pooledDb
          .select({ count: count() })
          .from(monitors)
          .where(
            and(eq(monitors.userId, user.id), eq(monitors.isActive, true))
          );

        // Count new mentions since last active
        const lastActive = user.lastActiveAt
          ? new Date(user.lastActiveAt)
          : new Date(0);

        const [mentionCount] = await pooledDb
          .select({ count: count() })
          .from(results)
          .innerJoin(monitors, eq(results.monitorId, monitors.id))
          .where(
            and(
              eq(monitors.userId, user.id),
              gte(results.createdAt, lastActive)
            )
          );

        // Get user's monitor IDs first
        const userMonitors = await pooledDb.query.monitors.findMany({
          where: eq(monitors.userId, user.id),
          columns: { id: true },
        });
        const monitorIds = userMonitors.map((m) => m.id);

        // Get top mention for highlight (only if user has monitors)
        let topMention = null;
        if (monitorIds.length > 0) {
          const recentResults = await pooledDb.query.results.findMany({
            where: gte(results.createdAt, lastActive),
            orderBy: [desc(results.engagementScore)],
            limit: 10,
            columns: {
              title: true,
              platform: true,
              sourceUrl: true,
              monitorId: true,
            },
          });

          // Filter to user's monitors
          topMention = recentResults.find((r) => monitorIds.includes(r.monitorId));
        }

        return {
          activeMonitors: monitorCount?.count || 0,
          newMentions: mentionCount?.count || 0,
          topMention: topMention
            ? {
                title: topMention.title,
                platform: topMention.platform,
                url: topMention.sourceUrl,
              }
            : undefined,
        };
      });

      // Only send if there's something to show (active monitors or new mentions)
      if (stats.activeMonitors === 0 && stats.newMentions === 0) {
        skipped.push(user.id);
        continue;
      }

      // Calculate days since active
      const lastActiveDate = user.lastActiveAt
        ? new Date(user.lastActiveAt)
        : null;
      const daysSinceActive = lastActiveDate
        ? Math.floor(
            (now.getTime() - lastActiveDate.getTime()) / (24 * 60 * 60 * 1000)
          )
        : INACTIVE_DAYS;

      // Send re-engagement email via event (allows retrying)
      await step.sendEvent("send-reengagement", {
        name: "user/reengagement.send",
        data: {
          userId: user.id,
          email: user.email,
          name: user.name || undefined,
          daysSinceActive,
          stats,
        },
      });

      processed.push(user.id);
    }

    return {
      totalInactive: inactiveUsers.length,
      eligible: eligibleUsers.length,
      processed: processed.length,
      skipped: skipped.length,
      processedUserIds: processed,
    };
  }
);

/**
 * Send re-engagement email to a specific user
 */
export const sendReengagement = inngest.createFunction(
  {
    id: "send-reengagement-email",
    name: "Send Re-engagement Email",
    retries: 3,
    timeouts: { finish: "2m" },
  },
  { event: "user/reengagement.send" },
  async ({ event, step }) => {
    const { userId, email, name, daysSinceActive, stats } = event.data;

    // Send the email
    await step.run("send-email", async () => {
      await sendReengagementEmail({
        email,
        name,
        daysSinceActive,
        stats,
      });
    });

    // Update user's reengagementEmailSentAt
    await step.run("update-user", async () => {
      await pooledDb
        .update(users)
        .set({ reengagementEmailSentAt: new Date() })
        .where(eq(users.id, userId));
    });

    return { success: true, userId, email };
  }
);
