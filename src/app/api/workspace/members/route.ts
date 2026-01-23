import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, users, monitors, audiences } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { findUserWithFallback } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

// GET - List workspace members
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user?.workspaceId) {
      return NextResponse.json({ error: "You are not in a workspace" }, { status: 400 });
    }

    // Get all members
    const members = await db.query.users.findMany({
      where: eq(users.workspaceId, user.workspaceId),
    });

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.workspaceRole,
        isCurrentUser: m.id === user.id,
      })),
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

// DELETE - Remove a member from workspace
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
    }

    // Get current user (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user?.workspaceId || user.workspaceRole !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can remove members" }, { status: 403 });
    }

    // Can't remove yourself (owner) - compare with actual user ID
    if (memberId === user.id) {
      return NextResponse.json({ error: "You cannot remove yourself. Transfer ownership first." }, { status: 400 });
    }

    // Get member
    const member = await db.query.users.findFirst({
      where: and(
        eq(users.id, memberId),
        eq(users.workspaceId, user.workspaceId)
      ),
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found in your workspace" }, { status: 404 });
    }

    // Get workspace owner info
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, user.workspaceId),
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Transfer member's monitors to workspace owner (keep all data, just change ownership)
    await db
      .update(monitors)
      .set({
        userId: workspace.ownerId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(monitors.userId, memberId),
          eq(monitors.workspaceId, user.workspaceId)
        )
      );

    // Transfer member's audiences to workspace owner
    await db
      .update(audiences)
      .set({
        userId: workspace.ownerId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(audiences.userId, memberId),
          eq(audiences.workspaceId, user.workspaceId)
        )
      );

    // Remove from workspace
    await db
      .update(users)
      .set({
        workspaceId: null,
        workspaceRole: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, memberId));

    // Update workspace seat count
    await db
      .update(workspaces)
      .set({
        seatCount: Math.max(1, workspace.seatCount - 1),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspace.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
