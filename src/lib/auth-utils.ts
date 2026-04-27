import { currentUser } from "@clerk/nextjs/server";
import { db, pooledDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * AUTHORITATIVE IDENTITY MODEL
 *
 * Clerk is the source of truth for user identity. The DB row's `id` column
 * MUST track Clerk's `user.id`. When they drift (account recovery, OAuth
 * regeneration, manual re-creation), the DB row is wrong — fix the DB to
 * match Clerk, never the other way around.
 *
 * `findUserWithFallback` self-heals: when an ID lookup misses but an email
 * lookup hits, we know Clerk regenerated the user's ID. We then run
 * `reconcileClerkUserId` to migrate the DB row + all FK references to the
 * new Clerk ID, atomically.
 */

/**
 * All tables that store a user reference by Clerk ID.
 *
 * 19 declared FKs use the `user_id` column; `workspaces.owner_id` is a
 * logical reference (plain text column, not an enforced FK — flagged as
 * hygiene debt to fix in a future schema migration).
 *
 * IMPORTANT: when adding a new table that references users.id, add it
 * here so reconciliation moves its rows to the new Clerk ID.
 */
const USER_FK_TABLES: Array<{ table: string; column: string }> = [
  { table: "activity_logs", column: "user_id" },
  { table: "ai_logs", column: "user_id" },
  { table: "ai_visibility_checks", column: "user_id" },
  { table: "api_keys", column: "user_id" },
  { table: "audiences", column: "user_id" },
  { table: "bookmark_collections", column: "user_id" },
  { table: "bookmarks", column: "user_id" },
  { table: "chat_conversations", column: "user_id" },
  { table: "email_delivery_failures", column: "user_id" },
  { table: "email_events", column: "user_id" },
  { table: "feedback", column: "user_id" },
  { table: "monitors", column: "user_id" },
  { table: "notifications", column: "user_id" },
  { table: "saved_searches", column: "user_id" },
  { table: "saved_views", column: "user_id" },
  { table: "shared_reports", column: "user_id" },
  { table: "usage", column: "user_id" },
  { table: "user_detection_keywords", column: "user_id" },
  { table: "webhooks", column: "user_id" },
  { table: "workspaces", column: "owner_id" }, // logical ref, not a real FK
];

/**
 * Migrate a user row from `oldId` → `newId`, moving every FK and logical
 * reference. Atomic in a single transaction; on any failure, nothing changes.
 *
 * Strategy:
 *   1. INSERT new row at `newId` copying all fields (ON CONFLICT DO NOTHING
 *      so the function is safe to retry / safe under concurrent reconcile).
 *   2. UPDATE every USER_FK_TABLES entry from oldId → newId.
 *   3. DELETE old row.
 *
 * Returns the migrated user record at `newId`.
 */
export async function reconcileClerkUserId(oldId: string, newId: string) {
  if (oldId === newId) {
    return await db.query.users.findFirst({ where: eq(users.id, newId) });
  }

  return await pooledDb.transaction(async (tx) => {
    // 1. Read old row.
    const oldUser = await tx.query.users.findFirst({
      where: eq(users.id, oldId),
    });
    if (!oldUser) {
      return null;
    }

    // 2. Insert new row at the new id. The users.email column has a UNIQUE
    //    constraint, so we can't have two rows sharing the email — even
    //    momentarily inside a transaction (the constraint is checked
    //    immediately, not deferred). Workaround: insert with a temporary
    //    placeholder email, then swap it back after the old row is deleted.
    //
    //    Long-term cleaner fix would be ON UPDATE CASCADE on every FK to
    //    users.id (so a single UPDATE users SET id=... cascades) — schema
    //    migration tracked as separate hygiene work.
    const tempEmail = `_pending_swap_${Date.now()}_${oldUser.email}`;
    await tx
      .insert(users)
      .values({
        ...oldUser,
        id: newId,
        email: tempEmail,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // 3. Move every FK + logical reference to the new id.
    for (const { table, column } of USER_FK_TABLES) {
      await tx.execute(
        sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${newId} WHERE ${sql.identifier(column)} = ${oldId}`
      );
    }

    // 4. Drop the old row. Safe now that nothing references it.
    await tx.delete(users).where(eq(users.id, oldId));

    // 5. Restore the real email on the new row (old row's email is freed).
    await tx
      .update(users)
      .set({ email: oldUser.email })
      .where(eq(users.id, newId));

    // Return the freshly-aligned user.
    return await tx.query.users.findFirst({
      where: eq(users.id, newId),
    });
  });
}

/**
 * Find user by Clerk ID with email fallback + self-healing reconciliation.
 *
 * - Lookup by Clerk ID (fast path; matches in 99%+ of requests).
 * - On miss: lookup by email. This catches the Clerk-regenerated-ID case.
 * - When the email match returns a row with a *different* id, that's a
 *   confirmed Clerk-DB drift. We run `reconcileClerkUserId` to migrate the
 *   row + all FK references to the new Clerk ID, atomically.
 * - If reconciliation fails for any reason (concurrent collision, partial
 *   transaction abort), we log and return the user via the email match so
 *   the request still succeeds.
 *
 * @param clerkUserId - The Clerk user ID from auth()
 * @returns The user record (with the correct Clerk ID) or null
 */
export async function findUserWithFallback(clerkUserId: string) {
  // Fast path: direct ID match
  let user = await db.query.users.findFirst({
    where: eq(users.id, clerkUserId),
  });
  if (user) return user;

  // Fallback: email-based lookup
  const clerkUser = await currentUser();
  const clerkEmail = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!clerkEmail) return null;

  user = await db.query.users.findFirst({
    where: eq(users.email, clerkEmail),
  });
  if (!user) return null;

  // ID mismatch detected — Clerk is authoritative, heal the DB row.
  if (user.id !== clerkUserId) {
    logger.warn("Clerk-DB ID drift detected; reconciling", {
      oldId: user.id,
      newId: clerkUserId,
      email: clerkEmail,
    });
    try {
      const reconciled = await reconcileClerkUserId(user.id, clerkUserId);
      if (reconciled) return reconciled;
    } catch (err) {
      logger.error("Reconciliation failed; returning user via email fallback", {
        oldId: user.id,
        newId: clerkUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through and return the email-matched user with stale id.
    }
  }

  return user;
}
