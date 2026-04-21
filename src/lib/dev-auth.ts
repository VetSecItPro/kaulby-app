import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Determine whether the current environment is a "safe" dev-like context
 * where the auth bypass may activate.
 *
 * Two activation paths, both gated by explicit opt-in via `ALLOW_DEV_AUTH_BYPASS=true`:
 *   1. Local development — `NODE_ENV === "development"` (pnpm dev).
 *   2. GitHub Actions CI — `CI === "true"` or `GITHUB_ACTIONS === "true"`
 *      (E2E Playwright specs need an authenticated session against a built
 *      production bundle where NODE_ENV is "production").
 *
 * In BOTH cases the bypass is HARD-BLOCKED on Vercel (`VERCEL` or
 * `VERCEL_ENV` set) so no production deploy can ever activate it even if
 * `ALLOW_DEV_AUTH_BYPASS` were accidentally enabled.
 *
 * Threat model:
 * - `ALLOW_DEV_AUTH_BYPASS` is the explicit opt-in; it is NEVER set in Vercel
 *   environment variables. Adding it there is the only way to make prod
 *   bypass-able, and this file still blocks via the Vercel guard.
 * - CI flag alone does nothing — without `ALLOW_DEV_AUTH_BYPASS=true` the
 *   bypass stays off even when `CI=true`.
 */
function isBypassEligibleEnv(): boolean {
  if (process.env.ALLOW_DEV_AUTH_BYPASS !== "true") return false;
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;

  const isDev = process.env.NODE_ENV === "development";
  const isCI =
    process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

  return isDev || isCI;
}

/**
 * Get the effective user ID for the current request.
 * In local development OR CI (with explicit opt-in), returns the first admin
 * user in the database for easier testing. In production, returns the
 * authenticated Clerk user ID.
 */
export async function getEffectiveUserId(): Promise<string | null> {
  if (isBypassEligibleEnv()) {
    // In local dev / CI, prefer the admin user for full-feature testing.
    // This matches the dashboard layout's dev bypass (which hardcodes team).
    const devUser = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.isAdmin, true),
      columns: { id: true },
    }) ?? await db.query.users.findFirst({
      columns: { id: true },
    });
    return devUser?.id || null;
  }

  try {
    const { userId } = await auth();
    return userId;
  } catch (error) {
    // auth() can fail if Clerk middleware is not detected (e.g., Inngest dev server)
    console.warn("[dev-auth] auth() failed:", (error as Error).message);
    return null;
  }
}

/**
 * Verify the authenticated user exists in the database.
 * Handles Clerk ID mismatches by falling back to email lookup.
 * Returns the correct DB user ID (which may differ from the Clerk session ID).
 *
 * Use this before any INSERT that has a user_id FK constraint to prevent
 * FK violations when Clerk IDs change (e.g., user re-signs up).
 */
export async function verifyUserInDb(clerkUserId: string): Promise<string | null> {
  // Fast path: user exists by Clerk ID
  const user = await db.query.users.findFirst({
    where: eq(users.id, clerkUserId),
    columns: { id: true },
  });
  if (user) return user.id;

  // Slow path: Clerk ID mismatch — try email fallback
  try {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (email) {
      const userByEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
        columns: { id: true },
      });
      if (userByEmail) {
        // User exists by email but not by ID — the webhook hasn't migrated yet.
        // Return the DB user ID so FK inserts succeed.
        return userByEmail.id;
      }
    }
  } catch {
    // currentUser() may fail in non-request contexts
  }

  return null;
}

/**
 * Check if we're in a dev-like environment where auth bypasses are safe.
 * This is used for dev bypasses in various parts of the app.
 * Returns true for local dev OR GitHub Actions CI (both require
 * `ALLOW_DEV_AUTH_BYPASS=true` as explicit opt-in). NEVER true on Vercel.
 */
export function isLocalDev(): boolean {
  return isBypassEligibleEnv();
}
