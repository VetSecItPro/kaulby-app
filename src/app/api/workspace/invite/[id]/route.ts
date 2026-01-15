import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceInvites, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// DELETE - Revoke an invite
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: inviteId } = await params;

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.workspaceId || user.workspaceRole !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can revoke invites" }, { status: 403 });
    }

    // Get invite and verify it belongs to user's workspace
    const invite = await db.query.workspaceInvites.findFirst({
      where: and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, user.workspaceId)
      ),
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Delete the invite
    await db
      .delete(workspaceInvites)
      .where(eq(workspaceInvites.id, inviteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invite:", error);
    return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
  }
}
