import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

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
 * Check if we're in local development mode.
 * This is used for dev bypasses in various parts of the app.
 */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV === "development" &&
         process.env.ALLOW_DEV_AUTH_BYPASS === "true" &&
         !process.env.VERCEL &&
         !process.env.VERCEL_ENV;
}
