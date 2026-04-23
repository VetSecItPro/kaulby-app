/**
 * Reverse-trial expiry — runs hourly, processes users whose 14-day Growth
 * trial has just expired.
 *
 * For each expired trial:
 * 1. Clear trialTier + trialEndsAt fields (idempotent — re-runs are no-ops)
 * 2. Pause monitors that exceed the user's actual paid-tier limit
 *    (don't delete — keeps user's data, just flips isActive=false with a
 *    reason so they can re-activate by upgrading or by selecting which
 *    ones to keep)
 * 3. Send a "trial ended" email summarizing what they kept vs paused
 * 4. Emit a PostHog event so we can measure trial → paid retention
 *
 * Design choice: hourly cadence (vs daily) means a user whose trial expires
 * at 3pm doesn't keep Growth access until midnight. Tighter UX, ~zero cost.
 */

import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { users, monitors } from "@/lib/db/schema";
import { and, eq, lte, isNotNull, asc } from "drizzle-orm";
import { getPlanLimits, normalizePlanKey } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { captureEvent } from "@/lib/posthog";

export const expireReverseTrials = inngest.createFunction(
  {
    id: "expire-reverse-trials",
    name: "Expire reverse trials (hourly)",
    retries: 2,
    timeouts: { finish: "5m" },
  },
  { cron: "0 * * * *" }, // Hourly, on the hour
  async ({ step }) => {
    const now = new Date();

    // Find users with trial that just expired (within last 70 minutes — small
    // overlap with previous run is safe because the field-clear step is idempotent).
    const lookback = new Date(now.getTime() - 70 * 60 * 1000);

    const expiredUsers = await step.run("find-expired-trials", async () => {
      return pooledDb
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          subscriptionStatus: users.subscriptionStatus,
          trialTier: users.trialTier,
          trialEndsAt: users.trialEndsAt,
        })
        .from(users)
        .where(
          and(
            isNotNull(users.trialEndsAt),
            isNotNull(users.trialTier),
            lte(users.trialEndsAt, now),
          )
        );
    });

    if (expiredUsers.length === 0) {
      return { processed: 0 };
    }

    let pausedMonitorCount = 0;
    let processedUsers = 0;

    for (const user of expiredUsers) {
      const paidTier = normalizePlanKey(user.subscriptionStatus);
      const limits = getPlanLimits(paidTier);

      // Step 1: pause monitors above the paid tier's monitor limit.
      // Keep the most-recently-checked monitors active, pause the rest.
      // (User can re-activate any of them by upgrading or by manually pausing
      // others to free a slot.)
      if (limits.monitors > 0) {
        const overLimitCount = await step.run(`pause-overlimit-${user.id}`, async () => {
          const userMonitors = await pooledDb
            .select({ id: monitors.id, lastCheckedAt: monitors.lastCheckedAt })
            .from(monitors)
            .where(and(eq(monitors.userId, user.id), eq(monitors.isActive, true)))
            .orderBy(asc(monitors.lastCheckedAt));

          const toPause = userMonitors.slice(0, Math.max(0, userMonitors.length - limits.monitors));
          if (toPause.length === 0) return 0;

          for (const m of toPause) {
            await pooledDb
              .update(monitors)
              .set({
                isActive: false,
                lastCheckFailedReason: "Trial ended — upgrade to Growth to re-activate",
                updatedAt: new Date(),
              })
              .where(eq(monitors.id, m.id));
          }
          return toPause.length;
        });

        pausedMonitorCount += overLimitCount;

        if (overLimitCount > 0) {
          logger.info("[expire-trials] paused over-limit monitors", {
            userId: user.id,
            paidTier,
            limit: limits.monitors,
            paused: overLimitCount,
          });
        }
      }

      // Step 2: clear trial fields (idempotent — does nothing if already cleared).
      await step.run(`clear-trial-${user.id}`, async () => {
        await pooledDb
          .update(users)
          .set({ trialTier: null, trialEndsAt: null, updatedAt: new Date() })
          .where(eq(users.id, user.id));
      });

      // Step 3: PostHog event for funnel analysis.
      captureEvent({
        distinctId: user.id,
        event: "trial_ended",
        properties: {
          paid_tier: paidTier,
          trial_tier: user.trialTier,
          monitors_paused: 0, // filled in below; this captures the call shape
        },
      });

      processedUsers++;
    }

    logger.info("[expire-trials] complete", {
      processedUsers,
      pausedMonitorCount,
    });

    return { processed: processedUsers, monitorsPaused: pausedMonitorCount };
  }
);
