import { getEffectiveUserId } from "@/lib/dev-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceInvites, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendInviteAcceptedEmail } from "@/lib/email";
import { findUserWithFallback } from "@/lib/auth-utils";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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

    // Mask email to prevent PII leakage (e.g., j***@example.com)
    const maskedEmail = invite.email.replace(
      /^(.{1,2})(.*)(@.*)$/,
      (_, start, middle, domain) => start + "*".repeat(Math.min(middle.length, 5)) + domain
    );

    return NextResponse.json({
      invite: {
        email: maskedEmail,
        workspaceName: workspace.name,
        inviterName: inviter?.name || inviter?.email || "Someone",
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    logger.error("Error fetching invite:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}

// POST - Accept an invite (requires auth)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Please sign in to accept this invite" }, { status: 401 });
    }

    const { token } = await params;
    // Rate limiting check for accepting invite
    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    }

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

    // Get user (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

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

    // FIX-112: All checks and mutations inside transaction to prevent race conditions.
    // Status check + seat limit + all writes are atomic - prevents double-acceptance
    // and concurrent seat limit bypass.
    const workspace = await db.transaction(async (tx) => {
      // Re-check invite status inside transaction (prevents double-acceptance race)
      const freshInvite = await tx.query.workspaceInvites.findFirst({
        where: eq(workspaceInvites.id, invite.id),
        columns: { status: true },
      });

      if (!freshInvite || freshInvite.status !== "pending") {
        throw new Error("INVITE_ALREADY_USED");
      }

      // Get workspace inside transaction
      const ws = await tx.query.workspaces.findFirst({
        where: eq(workspaces.id, invite.workspaceId),
      });

      if (!ws) {
        throw new Error("WORKSPACE_NOT_FOUND");
      }

      // Check seat limit inside transaction
      if (ws.seatCount >= ws.seatLimit) {
        throw new Error("SEAT_LIMIT_REACHED");
      }

      // Add user to workspace as editor (default role for new members)
      await tx
        .update(users)
        .set({
          workspaceId: ws.id,
          workspaceRole: "editor",
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Update invite status
      await tx
        .update(workspaceInvites)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
        })
        .where(eq(workspaceInvites.id, invite.id));

      // Use SQL increment to prevent stale count overwrites from concurrent requests
      await tx
        .update(workspaces)
        .set({
          seatCount: sql`${workspaces.seatCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, ws.id));

      return ws;
    });

    // Notify workspace owner
    try {
      const owner = workspace.ownerId
        ? await db.query.users.findFirst({
            where: eq(users.id, workspace.ownerId),
          })
        : null;

      if (owner) {
        await sendInviteAcceptedEmail({
          ownerEmail: owner.email,
          memberName: user.name || user.email,
          workspaceName: workspace.name,
        });
      }
    } catch (emailError) {
      logger.error("Failed to send acceptance notification:", { error: emailError instanceof Error ? emailError.message : String(emailError) });
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
    // Handle transaction-thrown business logic errors
    if (error instanceof Error) {
      if (error.message === "INVITE_ALREADY_USED") {
        return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
      }
      if (error.message === "WORKSPACE_NOT_FOUND") {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      }
      if (error.message === "SEAT_LIMIT_REACHED") {
        return NextResponse.json({ error: "This workspace has reached its seat limit. Contact the workspace owner." }, { status: 403 });
      }
    }
    logger.error("Error accepting invite:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
