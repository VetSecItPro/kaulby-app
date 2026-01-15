import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceInvites, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendInviteAcceptedEmail } from "@/lib/email";

// GET - Get invite details (public - for display before accepting)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Get invite
    const invite = await db.query.workspaceInvites.findFirst({
      where: eq(workspaceInvites.token, token),
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Check if expired
    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    // Check if already accepted
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
    }

    // Get workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, invite.workspaceId),
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Get inviter
    const inviter = await db.query.users.findFirst({
      where: eq(users.id, invite.invitedBy),
    });

    return NextResponse.json({
      invite: {
        email: invite.email,
        workspaceName: workspace.name,
        inviterName: inviter?.name || inviter?.email || "Someone",
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}

// POST - Accept an invite (requires auth)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Please sign in to accept this invite" }, { status: 401 });
    }

    const { token } = await params;

    // Get invite
    const invite = await db.query.workspaceInvites.findFirst({
      where: eq(workspaceInvites.token, token),
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Check if expired
    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    // Check if already accepted
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify email matches invite
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { error: `This invite was sent to ${invite.email}. Please sign in with that email address.` },
        { status: 403 }
      );
    }

    // Check if user is already in a workspace
    if (user.workspaceId) {
      return NextResponse.json(
        { error: "You are already in a workspace. Leave your current workspace first." },
        { status: 400 }
      );
    }

    // Get workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, invite.workspaceId),
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Check seat limit
    if (workspace.seatCount >= workspace.seatLimit) {
      return NextResponse.json(
        { error: "This workspace has reached its seat limit. Contact the workspace owner." },
        { status: 403 }
      );
    }

    // Add user to workspace
    await db
      .update(users)
      .set({
        workspaceId: workspace.id,
        workspaceRole: "member",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Update invite status
    await db
      .update(workspaceInvites)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
      })
      .where(eq(workspaceInvites.id, invite.id));

    // Update workspace seat count
    await db
      .update(workspaces)
      .set({
        seatCount: workspace.seatCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspace.id));

    // Notify workspace owner
    try {
      const owner = await db.query.users.findFirst({
        where: eq(users.id, workspace.ownerId),
      });

      if (owner) {
        await sendInviteAcceptedEmail({
          ownerEmail: owner.email,
          memberName: user.name || user.email,
          workspaceName: workspace.name,
        });
      }
    } catch (emailError) {
      console.error("Failed to send acceptance notification:", emailError);
      // Don't fail - the join was successful
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
