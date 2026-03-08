/**
 * Trial Win-Back System
 *
 * Detects users whose trial expired 1-2 days ago without converting to paid.
 * Sends a personalized win-back email highlighting what they found during the trial
 * and urging them to upgrade within 7 days.
 *
 * Runs daily at 9 AM UTC.
 */

import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import { eq, and, lt, gte, isNull, inArray, desc, count } from "drizzle-orm";
import { sendTrialWinbackEmail } from "@/lib/email";

const COOLDOWN_DAYS = 30; // Don't re-send within 30 days

/**
 * Daily cron job to find expired trial users and trigger win-back emails.
 * Runs at 9 AM UTC every day.
 */
export const detectExpiredTrials = inngest.createFunction(
  {
    id: "detect-expired-trials",
    name: "Detect Expired Trials",
    concurrency: 1,
    timeouts: { finish: "15m" },
  },
  { cron: "0 9 * * *" }, // 9 AM UTC daily
  async ({ step }) => {
    const now = new Date();

    // Trial expired 1-2 days ago
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Cooldown threshold for re-sending
    const cooldownThreshold = new Date(
      now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );

    // Find users whose trial expired 1-2 days ago and are now on the free plan
    const expiredTrialUsers = await step.run("find-expired-trials", async () => {
      return pooledDb.query.users.findMany({
        where: and(
          // Currently on free plan (downgraded after trial)
          eq(users.subscriptionStatus, "free"),
          // Not banned
          eq(users.isBanned, false),
          // No pending deletion
          isNull(users.deletionRequestedAt),
          // Trial ended 1-2 days ago (currentPeriodEnd is past but recent)
          lt(users.currentPeriodEnd, oneDayAgo),
          gte(users.currentPeriodEnd, twoDaysAgo)
        ),
        columns: {
          id: true,
          email: true,
          name: true,
          currentPeriodEnd: true,
          trialWinbackSentAt: true,
        },
      });
    });

    // Filter out users who already received a win-back email recently
    const eligibleUsers = expiredTrialUsers.filter((user) => {
      if (!user.trialWinbackSentAt) return true;
      const sentAt = new Date(user.trialWinbackSentAt);
      return sentAt < cooldownThreshold;
    });

    const processed: string[] = [];
    const skipped: string[] = [];

    for (const user of eligibleUsers) {
      // Gather trial stats for personalization
      const stats = await step.run(`get-trial-stats-${user.id}`, async () => {
        // Count total mentions found during trial
        const [mentionCount] = await pooledDb
          .select({ count: count() })
          .from(results)
          .innerJoin(monitors, eq(results.monitorId, monitors.id))
          .where(eq(monitors.userId, user.id));

        // Count distinct platforms used
        const userMonitors = await pooledDb.query.monitors.findMany({
          where: eq(monitors.userId, user.id),
          columns: { id: true, platforms: true },
        });
        const uniquePlatforms = new Set(userMonitors.flatMap((m) => m.platforms ?? []));
        const monitorIds = userMonitors.map((m) => m.id);

        // Get top mention for highlight (scoped to user's monitors)
        let topMention = null;
        if (monitorIds.length > 0) {
          const topResults = await pooledDb.query.results.findMany({
            where: inArray(results.monitorId, monitorIds),
            orderBy: [desc(results.engagementScore)],
            limit: 1,
            columns: {
              title: true,
              platform: true,
              sourceUrl: true,
              monitorId: true,
            },
          });

          topMention = topResults[0] ?? null;
        }

        return {
          totalMentions: mentionCount?.count || 0,
          platforms: uniquePlatforms.size,
          topMention: topMention
            ? {
                title: topMention.title,
                platform: topMention.platform,
                url: topMention.sourceUrl,
              }
            : undefined,
        };
      });

      // Only send if user actually used the product during trial
      if (stats.totalMentions === 0 && stats.platforms === 0) {
        skipped.push(user.id);
        continue;
      }

      // Send win-back email via event (allows retrying)
      await step.sendEvent("send-trial-winback", {
        name: "user/trial-expiry.winback",
        data: {
          userId: user.id,
          email: user.email,
          name: user.name || undefined,
          stats,
        },
      });

      processed.push(user.id);
    }

    return {
      totalExpired: expiredTrialUsers.length,
      eligible: eligibleUsers.length,
      processed: processed.length,
      skipped: skipped.length,
      processedUserIds: processed,
    };
  }
);

/**
 * Send trial win-back email to a specific user
 */
export const sendTrialWinback = inngest.createFunction(
  {
    id: "send-trial-winback-email",
    name: "Send Trial Win-Back Email",
    retries: 3,
    timeouts: { finish: "2m" },
  },
  { event: "user/trial-expiry.winback" },
  async ({ event, step }) => {
    const { userId, email, name, stats } = event.data;

    // Update timestamp FIRST to prevent double-send on retry
    await step.run("update-user", async () => {
      await pooledDb
        .update(users)
        .set({ trialWinbackSentAt: new Date() })
        .where(eq(users.id, userId));
    });

    // Then send the email
    await step.run("send-email", async () => {
      await sendTrialWinbackEmail({
        email,
        name,
        stats,
      });
    });

    return { success: true, userId, email };
  }
);
