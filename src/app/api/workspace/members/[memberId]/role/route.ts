import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { findUserWithFallback } from "@/lib/auth-utils";
import { permissions, getAssignableRoles, type WorkspaceRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// PATCH - Change a member's role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await params;
    const body = await request.json();
    const { role: newRole } = body;

    if (!newRole || !["admin", "editor", "viewer"].includes(newRole)) {
      return NextResponse.json(
        { error: "Invalid role. Must be admin, editor, or viewer" },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await findUserWithFallback(userId);

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!currentUser.workspaceId) {
      return NextResponse.json({ error: "You are not in a workspace" }, { status: 400 });
    }

    // Check if user can change roles
    if (!permissions.canChangeRoles(currentUser.workspaceRole)) {
      return NextResponse.json({ error: "You don't have permission to change roles" }, { status: 403 });
    }

    // Get the member to update
    const memberToUpdate = await db.query.users.findFirst({
      where: eq(users.id, memberId),
    });

    if (!memberToUpdate) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Can't change your own role
    if (memberToUpdate.id === currentUser.id) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    // Check if member is in the same workspace
    if (memberToUpdate.workspaceId !== currentUser.workspaceId) {
      return NextResponse.json({ error: "Member is not in your workspace" }, { status: 400 });
    }

    // Can't change owner's role
    if (memberToUpdate.workspaceRole === "owner") {
      return NextResponse.json({ error: "Cannot change the workspace owner's role" }, { status: 400 });
    }

    // Check if current user can modify this member
    if (!permissions.canModifyMember(currentUser.workspaceRole, memberToUpdate.workspaceRole!)) {
      return NextResponse.json(
        { error: "You don't have permission to change this member's role" },
        { status: 403 }
      );
    }

    // Check if the new role is assignable by the current user
    const assignableRoles = getAssignableRoles(currentUser.workspaceRole as WorkspaceRole);
    if (!assignableRoles.includes(newRole as WorkspaceRole)) {
      return NextResponse.json(
        { error: `You cannot assign the ${newRole} role` },
        { status: 403 }
      );
    }

    // Update member's role
    await db
      .update(users)
      .set({
        workspaceRole: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, memberId));

    // Log activity
    await logActivity({
      workspaceId: currentUser.workspaceId,
      userId: currentUser.id,
      action: "member_role_changed",
      targetType: "member",
      targetId: memberId,
      targetName: memberToUpdate.name || memberToUpdate.email,
      metadata: {
        oldRole: memberToUpdate.workspaceRole,
        newRole,
      },
    });

    return NextResponse.json({ success: true, role: newRole });
  } catch (error) {
    console.error("Error changing role:", error);
    return NextResponse.json({ error: "Failed to change role" }, { status: 500 });
  }
}
