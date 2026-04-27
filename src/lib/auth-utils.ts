import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
 * `reconcileClerkUserId` to update the DB row + cascade all FK references.
 */

/**
 * Migrate a user row from `oldId` → `newId` via a single UPDATE that cascades
 * to every FK. Atomic; on failure, nothing changes.
 *
 * Why this is one statement: every table that references `users.id` has
 * `ON UPDATE CASCADE` declared in the schema. PostgreSQL handles the cascade
 * automatically — `activity_logs.user_id`, `monitors.user_id`,
 * `workspaces.owner_id`, etc. all follow the parent's id change in lockstep.
 *
 * Adding new tables that reference users.id is safe: as long as the FK is
 * declared with `onUpdate: "cascade"` in `schema.ts`, this helper keeps working.
 */
export async function reconcileClerkUserId(oldId: string, newId: string) {
  if (oldId === newId) {
    return await db.query.users.findFirst({ where: eq(users.id, newId) });
  }

  await db
    .update(users)
    .set({ id: newId, updatedAt: new Date() })
    .where(eq(users.id, oldId));

  return await db.query.users.findFirst({ where: eq(users.id, newId) });
}

/**
 * Find user by Clerk ID with email fallback + self-healing reconciliation.
 *
 * - Lookup by Clerk ID (fast path; matches in 99%+ of requests).
 * - On miss: lookup by email. Catches the Clerk-regenerated-ID case.
 * - When the email match returns a row with a *different* id, that's a
 *   confirmed Clerk-DB drift. We run `reconcileClerkUserId` to update the
 *   row's id; ON UPDATE CASCADE moves every FK reference automatically.
 * - If reconciliation fails (concurrent collision, etc.), we log and return
 *   the user via the email match so the request still succeeds.
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
