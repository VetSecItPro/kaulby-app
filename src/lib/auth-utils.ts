import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Find user by Clerk ID with email fallback.
 *
 * This handles cases where the Clerk user ID in the database doesn't match
 * the current Clerk session (e.g., after Clerk account changes or mismatches).
 * Falls back to looking up by email address.
 *
 * @param clerkUserId - The Clerk user ID from auth()
 * @returns The user record or null if not found
 */
export async function findUserWithFallback(clerkUserId: string) {
  // First try by Clerk ID
  let user = await db.query.users.findFirst({
    where: eq(users.id, clerkUserId),
  });

  // Fallback: if not found by Clerk ID, try by email (handles Clerk ID mismatch)
  if (!user) {
    const clerkUser = await currentUser();
    const clerkEmail = clerkUser?.emailAddresses[0]?.emailAddress;
    if (clerkEmail) {
      user = await db.query.users.findFirst({
        where: eq(users.email, clerkEmail),
      });
    }
  }

  return user;
}

/**
 * Find user by Clerk ID with email fallback, selecting specific columns.
 *
 * @param clerkUserId - The Clerk user ID from auth()
 * @param columns - Object specifying which columns to select
 * @returns The user record with selected columns or null if not found
 */
export async function findUserWithFallbackColumns<T extends Record<string, boolean>>(
  clerkUserId: string,
  columns: T
) {
  // First try by Clerk ID
  let user = await db.query.users.findFirst({
    where: eq(users.id, clerkUserId),
    columns,
  });

  // Fallback: if not found by Clerk ID, try by email
  if (!user) {
    const clerkUser = await currentUser();
    const clerkEmail = clerkUser?.emailAddresses[0]?.emailAddress;
    if (clerkEmail) {
      user = await db.query.users.findFirst({
        where: eq(users.email, clerkEmail),
        columns,
      });
    }
  }

  return user;
}
