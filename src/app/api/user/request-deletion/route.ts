import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest";
import { checkApiRateLimit } from "@/lib/rate-limit";

// POST /api/user/request-deletion - Request account deletion (7-day cooldown)
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Get user email before updating
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true, deletionRequestedAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if deletion is already requested
    if (user.deletionRequestedAt) {
      return NextResponse.json(
        { error: "Deletion already requested" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Set deletion requested timestamp
    await db
      .update(users)
      .set({
        deletionRequestedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // Trigger Inngest function to handle the 7-day deletion process
    await inngest.send({
      name: "user/deletion.scheduled",
      data: {
        userId,
        email: user.email,
        scheduledAt: now.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Account scheduled for deletion in 7 days",
      deletionDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Error requesting deletion:", error);
    return NextResponse.json(
      { error: "Failed to request account deletion" },
      { status: 500 }
    );
  }
}

// DELETE /api/user/request-deletion - Cancel deletion request
export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Clear deletion requested timestamp
    await db
      .update(users)
      .set({
        deletionRequestedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: "Deletion request cancelled",
    });
  } catch (error) {
    console.error("Error cancelling deletion:", error);
    return NextResponse.json(
      { error: "Failed to cancel deletion request" },
      { status: 500 }
    );
  }
}
