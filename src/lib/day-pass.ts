/**
 * Day Pass functionality
 * Handle activation and checking of 24-hour Pro access passes
 */

import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Activate a day pass for a user (called from Polar webhook)
 * Grants Pro-level access for 24 hours
 */
export async function activateDayPass(userId: string): Promise<{
  expiresAt: Date;
  purchaseCount: number;
}> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  // Get current purchase count
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { dayPassPurchaseCount: true },
  });

  const newPurchaseCount = (user?.dayPassPurchaseCount || 0) + 1;

  await db
    .update(users)
    .set({
      dayPassExpiresAt: expiresAt,
      lastDayPassPurchasedAt: now,
      dayPassPurchaseCount: newPurchaseCount,
    })
    .where(eq(users.id, userId));

  console.log(`Day pass activated for user ${userId}, expires at ${expiresAt.toISOString()}`);

  return {
    expiresAt,
    purchaseCount: newPurchaseCount,
  };
}

/**
 * Check if a user has an active day pass
 */
export async function checkDayPassStatus(userId: string): Promise<{
  active: boolean;
  expiresAt: Date | null;
  hoursRemaining: number | null;
  minutesRemaining: number | null;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { dayPassExpiresAt: true },
  });

  if (!user?.dayPassExpiresAt) {
    return {
      active: false,
      expiresAt: null,
      hoursRemaining: null,
      minutesRemaining: null,
    };
  }

  const expiresAt = new Date(user.dayPassExpiresAt);
  const now = new Date();

  if (expiresAt <= now) {
    return {
      active: false,
      expiresAt: null,
      hoursRemaining: null,
      minutesRemaining: null,
    };
  }

  const msRemaining = expiresAt.getTime() - now.getTime();
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  return {
    active: true,
    expiresAt,
    hoursRemaining,
    minutesRemaining,
  };
}

/**
 * Get day pass purchase history for a user
 */
export async function getDayPassHistory(userId: string): Promise<{
  totalPurchases: number;
  lastPurchasedAt: Date | null;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      dayPassPurchaseCount: true,
      lastDayPassPurchasedAt: true,
    },
  });

  return {
    totalPurchases: user?.dayPassPurchaseCount || 0,
    lastPurchasedAt: user?.lastDayPassPurchasedAt || null,
  };
}

