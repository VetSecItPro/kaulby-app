import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { users, chatConversations } from "@/lib/db/schema";
import { and, lt, sql, count } from "drizzle-orm";

// Chat history retention by plan (in days)
const CHAT_RETENTION_DAYS = {
  free: 7,
  pro: 30,
  team: 90,
} as const;

// Clean up old chat conversations based on user's subscription plan
export const chatCleanup = inngest.createFunction(
  {
    id: "chat-cleanup",
    name: "Chat History Cleanup",
    retries: 3,
    timeouts: { finish: "15m" },
  },
  { cron: "0 4 * * *" }, // Run daily at 4 AM UTC
  async ({ step, logger }) => {
    logger.info("Starting chat history cleanup");

    const now = new Date();
    const cutoffs = {
      free: new Date(now.getTime() - CHAT_RETENTION_DAYS.free * 24 * 60 * 60 * 1000),
      pro: new Date(now.getTime() - CHAT_RETENTION_DAYS.pro * 24 * 60 * 60 * 1000),
      team: new Date(now.getTime() - CHAT_RETENTION_DAYS.team * 24 * 60 * 60 * 1000),
    };

    // Run tier cleanups in parallel
    const [freeDeleted, proDeleted, teamDeleted] = await Promise.all([
      step.run("cleanup-chat-free-tier", async () => {
        const whereClause = and(
          sql`${chatConversations.userId} IN (
            SELECT ${users.id} FROM ${users}
            WHERE COALESCE(${users.subscriptionStatus}, 'free') = 'free'
          )`,
          lt(chatConversations.updatedAt, cutoffs.free)
        );
        const [{ value }] = await pooledDb
          .select({ value: count() })
          .from(chatConversations)
          .where(whereClause);
        if (value > 0) {
          // Messages cascade-delete when conversation is deleted
          await pooledDb.delete(chatConversations).where(whereClause);
        }
        return value;
      }),
      step.run("cleanup-chat-pro-tier", async () => {
        const whereClause = and(
          sql`${chatConversations.userId} IN (
            SELECT ${users.id} FROM ${users}
            WHERE ${users.subscriptionStatus} = 'pro'
          )`,
          lt(chatConversations.updatedAt, cutoffs.pro)
        );
        const [{ value }] = await pooledDb
          .select({ value: count() })
          .from(chatConversations)
          .where(whereClause);
        if (value > 0) {
          await pooledDb.delete(chatConversations).where(whereClause);
        }
        return value;
      }),
      step.run("cleanup-chat-team-tier", async () => {
        const whereClause = and(
          sql`${chatConversations.userId} IN (
            SELECT ${users.id} FROM ${users}
            WHERE ${users.subscriptionStatus} = 'team'
          )`,
          lt(chatConversations.updatedAt, cutoffs.team)
        );
        const [{ value }] = await pooledDb
          .select({ value: count() })
          .from(chatConversations)
          .where(whereClause);
        if (value > 0) {
          await pooledDb.delete(chatConversations).where(whereClause);
        }
        return value;
      }),
    ]);

    const totalDeleted = freeDeleted + proDeleted + teamDeleted;

    logger.info(
      `Chat cleanup complete. Deleted ${totalDeleted} conversations (free: ${freeDeleted}, pro: ${proDeleted}, team: ${teamDeleted})`
    );

    return {
      success: true,
      deletedConversations: totalDeleted,
      breakdown: { free: freeDeleted, pro: proDeleted, team: teamDeleted },
    };
  }
);
