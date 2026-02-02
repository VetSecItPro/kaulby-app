"use server";

import { getEffectiveUserId } from "@/lib/dev-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Marks onboarding as completed for the current user.
 * Called when user dismisses the onboarding wizard.
 */
export async function completeOnboarding() {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await db
      .update(users)
      .set({
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    console.error("Failed to complete onboarding:", error);
    return { success: false, error: "Failed to update onboarding status" };
  }
}

/**
 * Resets onboarding for the current user.
 * Mainly used for testing/debugging.
 */
export async function resetOnboarding() {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await db
      .update(users)
      .set({
        onboardingCompleted: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error) {
    console.error("Failed to reset onboarding:", error);
    return { success: false, error: "Failed to reset onboarding status" };
  }
}
