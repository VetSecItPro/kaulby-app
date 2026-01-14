import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
        stripeCustomerId: true,
        subscriptionId: true,
        subscriptionStatus: true,
      },
    });

    // Cancel Stripe subscription if active
    if (user?.subscriptionId && user.subscriptionStatus !== "free") {
      try {
        const stripe = (await import("stripe")).default;
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
        await stripeClient.subscriptions.cancel(user.subscriptionId);
      } catch (stripeError) {
        console.error("Failed to cancel Stripe subscription:", stripeError);
        // Continue with deletion even if Stripe fails
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
