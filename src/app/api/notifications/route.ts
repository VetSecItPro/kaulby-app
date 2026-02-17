import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

// GET - List unread notifications for the current user
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const userNotifications = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ),
      orderBy: [desc(notifications.createdAt)],
      limit: 50,
    });

    return NextResponse.json({ notifications: userNotifications });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PATCH - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const body = await parseJsonBody(request);
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array of notification IDs" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (ids.length > 100) {
      return NextResponse.json(
        { error: "Cannot mark more than 100 notifications at once" },
        { status: 400 }
      );
    }

    // Validate that all ids are strings
    if (!ids.every((id: unknown) => typeof id === "string")) {
      return NextResponse.json(
        { error: "All ids must be strings" },
        { status: 400 }
      );
    }

    // Only update notifications belonging to this user
    const updated = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          inArray(notifications.id, ids),
          eq(notifications.userId, userId)
        )
      )
      .returning({ id: notifications.id });

    return NextResponse.json({ updated: updated.length });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    console.error("Failed to mark notifications as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
