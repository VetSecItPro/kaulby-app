/**
 * Re-engagement System - Churn Prevention
 *
 * Detects inactive users and sends re-engagement emails to bring them back.
 * Runs daily at 10 AM UTC to catch users who haven't been active in 7+ days.
 */

import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import {
  eq,
  lt,
  and,
  isNull,
  gte,
  count,
  inArray,
  sql,
} from "drizzle-orm";
import { sendReengagementEmail } from "@/lib/email";

// Thresholds
const INACTIVE_DAYS = 7; // Days without activity before sending email
const COOLDOWN_DAYS = 30; // Days to wait before sending another re-engagement email

// Minimal step/event shape extracted so the handler can be unit-tested
// without an Inngest runtime. Mirrors the pattern used in data-retention.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReengagementStep = {
  run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendEvent: (id: string, payload: any) => Promise<unknown>;
};

type TopMention = {
  title: string;
  platform: string;
  url: string;
};

/**
 * Extracted handler — aggregates all per-user lookups into 3 bulk queries.
 *
 * N+1 fix (Task DL.1):
 *   Previous implementation ran 3 queries inside a per-user `step.run`:
 *     - monitor count
 *     - mention count (since lastActiveAt)
 *     - top mention (2 queries: user's monitor IDs, then top result)
 *   With N eligible users this was 3N-4N serial roundtrips.
 *
 *   New implementation issues 3 aggregate queries covering all eligible users
 *   at once (GROUP BY user_id + DISTINCT ON for the top mention), then the
 *   per-user loop is pure in-memory map lookups.
 */
export async function runDetectInactiveUsers({
  step,
}: {
  step: ReengagementStep;
}) {
  const now = new Date();
  const inactiveThreshold = new Date(
    now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000
  );
  const cooldownThreshold = new Date(
    now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );

  // Find inactive paying users.
  const inactiveUsers = await step.run("find-inactive-users", async () => {
    return pooledDb.query.users.findMany({
      where: and(
        gte(users.subscriptionStatus, "solo"),
        eq(users.isBanned, false),
        isNull(users.deletionRequestedAt),
        lt(users.lastActiveAt, inactiveThreshold)
      ),
      columns: {
        id: true,
        email: true,
        name: true,
        lastActiveAt: true,
        reengagementEmailSentAt: true,
        reengagementOptOut: true,
        subscriptionStatus: true,
      },
    });
  });

  // Filter out users who opted out or received re-engagement email recently.
  const eligibleUsers = inactiveUsers.filter((user) => {
    if (user.reengagementOptOut) return false;
    if (!user.reengagementEmailSentAt) return true;
    const sentAt = new Date(user.reengagementEmailSentAt);
    return sentAt < cooldownThreshold;
  });

  const processed: string[] = [];
  const skipped: string[] = [];

  if (eligibleUsers.length === 0) {
    return {
      totalInactive: inactiveUsers.length,
      eligible: 0,
      processed: 0,
      skipped: 0,
      processedUserIds: processed,
    };
  }

  const userIds = eligibleUsers.map((u) => u.id);

  // Aggregate query #1: active monitor count per user.
  // Replaces N SELECT COUNT(*) FROM monitors WHERE user_id=? queries.
  const monitorCountsByUser = await step.run(
    "aggregate-monitor-counts",
    async () => {
      const rows = await pooledDb
        .select({
          userId: monitors.userId,
          count: count(monitors.id),
        })
        .from(monitors)
        .where(
          and(inArray(monitors.userId, userIds), eq(monitors.isActive, true))
        )
        .groupBy(monitors.userId);

      const map = new Map<string, number>();
      for (const row of rows) {
        map.set(row.userId, Number(row.count) || 0);
      }
      return map;
    }
  );

  // Aggregate query #2: mention counts per user since each user's lastActiveAt.
  // We cannot parameterize a per-user cutoff in a single GROUP BY, so we use
  // the earliest lastActiveAt across the batch as a lower bound and filter
  // per-user in memory. For users without lastActiveAt we treat it as epoch 0.
  //
  // NOTE: This may slightly overcount for users with a more recent lastActiveAt
  // than the earliest in the batch. To preserve exact semantics we fetch per-
  // user mention counts via a single query with a CASE/WHERE built from each
  // user's cutoff using a VALUES join.
  const mentionCountsByUser = await step.run(
    "aggregate-mention-counts",
    async () => {
      // Build a VALUES table: (user_id, last_active_at) for each eligible user.
      // Then JOIN onto monitors/results with r.created_at >= last_active_at.
      const valuesSql = sql.join(
        eligibleUsers.map(
          (u) =>
            sql`(${u.id}::text, ${
              u.lastActiveAt ? new Date(u.lastActiveAt) : new Date(0)
            }::timestamp)`
        ),
        sql`, `
      );

      const rows = await pooledDb.execute(sql`
        SELECT m.user_id AS "userId", COUNT(r.id)::int AS "count"
        FROM (VALUES ${valuesSql}) AS cutoffs(user_id, last_active_at)
        JOIN ${monitors} m ON m.user_id = cutoffs.user_id
        LEFT JOIN ${results} r
          ON r.monitor_id = m.id
          AND r.created_at >= cutoffs.last_active_at
        GROUP BY m.user_id
      `);

      const map = new Map<string, number>();
      // drizzle pooledDb.execute returns { rows: [...] } for node-postgres and
      // a plain array for neon-http; handle both.
      const rowList: Array<{ userId: string; count: number }> = Array.isArray(
        rows
      )
        ? (rows as unknown as Array<{ userId: string; count: number }>)
        : ((rows as unknown as {
            rows: Array<{ userId: string; count: number }>;
          }).rows ?? []);
      for (const row of rowList) {
        map.set(row.userId, Number(row.count) || 0);
      }
      return map;
    }
  );

  // Aggregate query #3: one top mention per user, ordered by engagement score.
  // Replaces N "fetch user monitors + fetch top 10 recent results" pairs.
  // Uses DISTINCT ON (m.user_id) so Postgres returns exactly one row per user.
  const topMentionsByUser = await step.run(
    "aggregate-top-mentions",
    async () => {
      const valuesSql = sql.join(
        eligibleUsers.map(
          (u) =>
            sql`(${u.id}::text, ${
              u.lastActiveAt ? new Date(u.lastActiveAt) : new Date(0)
            }::timestamp)`
        ),
        sql`, `
      );

      const rows = await pooledDb.execute(sql`
        SELECT DISTINCT ON (m.user_id)
          m.user_id AS "userId",
          r.title AS "title",
          r.platform AS "platform",
          r.source_url AS "sourceUrl"
        FROM (VALUES ${valuesSql}) AS cutoffs(user_id, last_active_at)
        JOIN ${monitors} m ON m.user_id = cutoffs.user_id
        JOIN ${results} r ON r.monitor_id = m.id
        WHERE r.created_at >= cutoffs.last_active_at
        ORDER BY
          m.user_id,
          r.engagement_score DESC NULLS LAST,
          r.created_at DESC
      `);

      const map = new Map<string, TopMention>();
      const rowList: Array<{
        userId: string;
        title: string;
        platform: string;
        sourceUrl: string;
      }> = Array.isArray(rows)
        ? (rows as unknown as Array<{
            userId: string;
            title: string;
            platform: string;
            sourceUrl: string;
          }>)
        : ((rows as unknown as {
            rows: Array<{
              userId: string;
              title: string;
              platform: string;
              sourceUrl: string;
            }>;
          }).rows ?? []);
      for (const row of rowList) {
        map.set(row.userId, {
          title: row.title,
          platform: row.platform,
          url: row.sourceUrl,
        });
      }
      return map;
    }
  );

  // Per-user loop: pure in-memory lookups. No DB roundtrips.
  for (const user of eligibleUsers) {
    const activeMonitors = monitorCountsByUser.get(user.id) ?? 0;
    const newMentions = mentionCountsByUser.get(user.id) ?? 0;
    const topMention = topMentionsByUser.get(user.id);

    // Only send if there's something to show (active monitors or new mentions)
    if (activeMonitors === 0 && newMentions === 0) {
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

    await step.sendEvent("send-reengagement", {
      name: "user/reengagement.send",
      data: {
        userId: user.id,
        email: user.email,
        name: user.name || undefined,
        daysSinceActive,
        stats: {
          activeMonitors,
          newMentions,
          topMention: topMention ?? undefined,
        },
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
    return runDetectInactiveUsers({ step: step as unknown as ReengagementStep });
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
