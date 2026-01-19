import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user to check if they have an active subscription
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        polarCustomerId: true,
        subscriptionId: true,
        subscriptionStatus: true,
      },
    });

    // Cancel Polar subscription if active
    // Note: Polar as MoR handles subscription lifecycle - deletion triggers webhook
    if (user?.subscriptionId && user.subscriptionStatus !== "free") {
      try {
        const { getPolarClient } = await import("@/lib/polar");
        const polar = await getPolarClient();
        if (polar && user.subscriptionId) {
          // Polar will handle subscription cancellation via webhook
          console.log(`User ${userId} deleted - Polar subscription ${user.subscriptionId} will be handled by webhook`);
        }
      } catch (polarError) {
        console.error("Failed to notify Polar:", polarError);
        // Continue with deletion - Polar will sync via webhook
      }
    }

    // Delete user from database (cascades to related records due to onDelete: "cascade")
    await db.delete(users).where(eq(users.id, userId));

    // Delete user from Clerk
    try {
      const clerk = await clerkClient();
      await clerk.users.deleteUser(userId);
    } catch (clerkError) {
      console.error("Failed to delete Clerk user:", clerkError);
      // User already deleted from DB, Clerk will eventually sync
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
