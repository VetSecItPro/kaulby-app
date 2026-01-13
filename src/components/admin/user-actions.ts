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

export async function toggleUserBan(userId: string) {
  await verifyAdmin();

  // Note: This would require adding a "banned" or "status" field to the users table
  // For now, we'll just log the action
  console.log(`Ban toggle requested for user: ${userId}`);

  // TODO: Add banned field to schema and implement:
  // const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  // await db.update(users).set({ banned: !user?.banned }).where(eq(users.id, userId));

  revalidatePath("/manage/users");

  return { success: true, message: "Ban functionality requires schema update" };
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
