import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { findUserWithFallback } from "@/lib/auth-utils";
import { permissions } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

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

    // Get current user
    const currentUser = await findUserWithFallback(userId);

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!currentUser.workspaceId) {
      return NextResponse.json({ error: "You are not in a workspace" }, { status: 400 });
    }

    // Check permissions
    if (!permissions.canRemoveMembers(currentUser.workspaceRole)) {
      return NextResponse.json({ error: "You don't have permission to remove members" }, { status: 403 });
    }

    // Get the member to remove
    const memberToRemove = await db.query.users.findFirst({
      where: eq(users.id, memberId),
    });

    if (!memberToRemove) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Can't remove yourself
    if (memberToRemove.id === currentUser.id) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
    }

    // Check if member is in the same workspace
    if (memberToRemove.workspaceId !== currentUser.workspaceId) {
      return NextResponse.json({ error: "Member is not in your workspace" }, { status: 400 });
    }

    // Can't remove owner
    if (memberToRemove.workspaceRole === "owner") {
      return NextResponse.json({ error: "Cannot remove the workspace owner" }, { status: 400 });
    }

    // Check if current user can modify this member
    if (!permissions.canModifyMember(currentUser.workspaceRole, memberToRemove.workspaceRole!)) {
      return NextResponse.json(
        { error: "You don't have permission to remove this member" },
        { status: 403 }
      );
    }

    // Remove member from workspace
    await db
      .update(users)
      .set({
        workspaceId: null,
        workspaceRole: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, memberId));

    // Log activity
    await logActivity({
      workspaceId: currentUser.workspaceId,
      userId: currentUser.id,
      action: "member_removed",
      targetType: "member",
      targetId: memberId,
      targetName: memberToRemove.name || memberToRemove.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
