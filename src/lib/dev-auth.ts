import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get the effective user ID for the current request.
 * In local development, returns the first user in the database for easier testing.
 * In production, returns the authenticated Clerk user ID.
 */
export async function getEffectiveUserId(): Promise<string | null> {
  // SECURITY: Only allow dev bypass with explicit opt-in
  const isLocalDev = process.env.NODE_ENV === "development" &&
                     process.env.ALLOW_DEV_AUTH_BYPASS === "true" &&
                     !process.env.VERCEL &&
                     !process.env.VERCEL_ENV;

  if (isLocalDev) {
    // In local dev, prefer the admin user for full-feature testing
    // This matches the dashboard layout's dev bypass (which hardcodes team)
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
 * Check if we're in local development mode.
 * This is used for dev bypasses in various parts of the app.
 */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV === "development" &&
         process.env.ALLOW_DEV_AUTH_BYPASS === "true" &&
         !process.env.VERCEL &&
         !process.env.VERCEL_ENV;
}
