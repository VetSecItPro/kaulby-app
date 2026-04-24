/**
 * Day-3 Onboarding Follow-Up
 *
 * Sends a follow-up email to users who signed up 3 days ago
 * but haven't created their first monitor yet.
 * Runs daily at 10 AM UTC (same schedule as re-engagement).
 */

import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { users, monitors } from "@/lib/db/schema";
import { eq, and, lt, gte, inArray, sql } from "drizzle-orm";
import { getOnboardingFollowupHtml } from "@/lib/email";
import { logger } from "@/lib/logger";

export const onboardingFollowup = inngest.createFunction(
  {
    id: "onboarding-followup",
    name: "Day-3 Onboarding Follow-Up",
    concurrency: 1,
    retries: 2,
    timeouts: { finish: "10m" },
  },
  { cron: "0 10 * * *" }, // 10 AM UTC daily
  async ({ step }) => {
    const now = new Date();

    // Target users who signed up ~3 days ago (between 72-96 hours ago)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    // Find eligible users
    const eligibleUsers = await step.run("find-eligible-users", async () => {
      // Get users who signed up 3-4 days ago and haven't completed onboarding
      const candidates = await pooledDb.query.users.findMany({
        where: and(
          // Signed up 3-4 days ago
          lt(users.createdAt, threeDaysAgo),
          gte(users.createdAt, fourDaysAgo),
          // Haven't completed onboarding
          eq(users.onboardingCompleted, false),
          // Not banned
          eq(users.isBanned, false)
        ),
        columns: {
          id: true,
          email: true,
          name: true,
        },
      });

      // PERF-ASYNC-001a: batch monitor count across all candidate users in one query
      if (candidates.length === 0) return [];
      const candidateIds = candidates.map((c) => c.id);
      const counts = await pooledDb
        .select({ userId: monitors.userId, count: sql<number>`count(*)::int` })
        .from(monitors)
        .where(inArray(monitors.userId, candidateIds))
        .groupBy(monitors.userId);
      const countByUser = new Map(counts.map((r) => [r.userId, r.count]));
      return candidates.filter((c) => (countByUser.get(c.id) ?? 0) === 0);
    });

    if (eligibleUsers.length === 0) {
      return { message: "No users eligible for day-3 follow-up" };
    }

    let sent = 0;
    let failed = 0;

    for (const user of eligibleUsers) {
      await step.run(`send-followup-${user.id}`, async () => {
        const { sendEmailWithRetry } = await import("@/lib/email/send-with-retry");
        const result = await sendEmailWithRetry({
          from: "Kaulby <notifications@kaulbyapp.com>",
          to: user.email,
          subject: "Your monitors are waiting — set up takes 30 seconds",
          html: getOnboardingFollowupHtml(user.name || undefined),
          emailType: "onboarding",
          userId: user.id,
        });
        if (result.success) {
          sent++;
          logger.info("[Onboarding] Day-3 follow-up sent", { userId: user.id });
        } else {
          failed++;
          logger.error("[Onboarding] Day-3 follow-up failed after retries", { userId: user.id, error: result.error });
        }
      });
    }

    return {
      message: `Day-3 onboarding follow-up: ${sent} sent, ${failed} failed`,
      eligible: eligibleUsers.length,
      sent,
      failed,
    };
  }
);
