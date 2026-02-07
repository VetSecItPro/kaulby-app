import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// PATCH - Assign monitor to a different team member
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
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

    const { monitorId } = await params;
    const body = await parseJsonBody(request);
    const { assignToUserId } = body;

    if (!assignToUserId || typeof assignToUserId !== "string") {
      return NextResponse.json({ error: "assignToUserId is required" }, { status: 400 });
    }

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.workspaceId) {
      return NextResponse.json({ error: "You are not in a workspace" }, { status: 400 });
    }

    // Only workspace owners can reassign monitors
    if (user.workspaceRole !== "owner") {
      return NextResponse.json(
        { error: "Only workspace owners can reassign monitors" },
        { status: 403 }
      );
    }

    // Verify target user is in the same workspace
    const targetUser = await db.query.users.findFirst({
      where: and(
        eq(users.id, assignToUserId),
        eq(users.workspaceId, user.workspaceId)
      ),
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user is not in your workspace" },
        { status: 400 }
      );
    }

    // Verify monitor belongs to this workspace
    const monitor = await db.query.monitors.findFirst({
      where: and(
        eq(monitors.id, monitorId),
        eq(monitors.workspaceId, user.workspaceId)
      ),
    });

    if (!monitor) {
      return NextResponse.json(
        { error: "Monitor not found in your workspace" },
        { status: 404 }
      );
    }

    // Update monitor assignment
    await db
      .update(monitors)
      .set({
        userId: assignToUserId,
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, monitorId));

    return NextResponse.json({
      success: true,
      message: `Monitor assigned to ${targetUser.name || targetUser.email}`,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error("Error assigning monitor:", error);
    return NextResponse.json({ error: "Failed to assign monitor" }, { status: 500 });
  }
}
