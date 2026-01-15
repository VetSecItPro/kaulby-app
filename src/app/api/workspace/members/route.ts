import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET - List workspace members
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

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
        isCurrentUser: m.id === userId,
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

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.workspaceId || user.workspaceRole !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can remove members" }, { status: 403 });
    }

    // Can't remove yourself (owner)
    if (memberId === userId) {
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
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, user.workspaceId),
    });

    if (workspace) {
      await db
        .update(workspaces)
        .set({
          seatCount: Math.max(1, workspace.seatCount - 1),
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspace.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
