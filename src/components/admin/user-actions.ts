"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// Verify the current user is an admin
async function verifyAdmin() {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    return true;
  }

  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    throw new Error("Unauthorized: Admin access required");
  }

  return true;
}

export async function updateUserPlan(
  userId: string,
  newPlan: "free" | "pro" | "enterprise"
) {
  await verifyAdmin();

  await db
    .update(users)
    .set({
      subscriptionStatus: newPlan,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath("/manage/users");

  return { success: true };
}

export async function toggleUserBan(userId: string, reason?: string) {
  await verifyAdmin();

  // Get current user state
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isBanned: true, email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const newBanState = !user.isBanned;

  await db
    .update(users)
    .set({
      isBanned: newBanState,
      bannedAt: newBanState ? new Date() : null,
      banReason: newBanState ? (reason || "Banned by admin") : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath("/manage/users");

  return {
    success: true,
    isBanned: newBanState,
    message: newBanState ? `User ${user.email} has been banned` : `User ${user.email} has been unbanned`,
  };
}

export async function makeUserAdmin(userId: string, isAdmin: boolean) {
  await verifyAdmin();

  await db
    .update(users)
    .set({
      isAdmin,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath("/manage/users");

  return { success: true };
}

export async function getUserDetails(userId: string) {
  await verifyAdmin();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      monitors: true,
      usage: true,
    },
  });

  return user;
}
