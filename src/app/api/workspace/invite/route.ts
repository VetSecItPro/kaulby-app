import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceInvites, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendWorkspaceInviteEmail } from "@/lib/email";
import { findUserWithFallback } from "@/lib/auth-utils";
import { logActivity } from "@/lib/activity-log";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Generate secure invite token
function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

// GET - List pending invites for workspace
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, 'read');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Get user (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user?.workspaceId || user.workspaceRole !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can view invites" }, { status: 403 });
    }

    // Get pending invites
    const invites = await db.query.workspaceInvites.findMany({
      where: and(
        eq(workspaceInvites.workspaceId, user.workspaceId),
        eq(workspaceInvites.status, "pending")
      ),
      orderBy: (invites, { desc }) => [desc(invites.createdAt)],
    });

    // Filter out expired invites
    const now = new Date();
    const activeInvites = invites.filter((i) => new Date(i.expiresAt) > now);

    return NextResponse.json({
      invites: activeInvites.map((i) => ({
        id: i.id,
        email: i.email,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }
}

// POST - Create a new invite
export async function POST(request: Request) {
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

    const body = await parseJsonBody(request);
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Get user (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user?.workspaceId || user.workspaceRole !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can invite members" }, { status: 403 });
    }

    // Get workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, user.workspaceId),
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Check seat limit
    if (workspace.seatCount >= workspace.seatLimit) {
      return NextResponse.json(
        { error: `Seat limit reached (${workspace.seatLimit}). Contact support to add more seats.` },
        { status: 403 }
      );
    }

    // Check if user already exists in workspace
    const existingMember = await db.query.users.findFirst({
      where: and(
        eq(users.email, email.toLowerCase()),
        eq(users.workspaceId, workspace.id)
      ),
    });

    if (existingMember) {
      return NextResponse.json({ error: "This user is already a member of your workspace" }, { status: 400 });
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await db.query.workspaceInvites.findFirst({
      where: and(
        eq(workspaceInvites.workspaceId, workspace.id),
        eq(workspaceInvites.email, email.toLowerCase()),
        eq(workspaceInvites.status, "pending")
      ),
    });

    if (existingInvite && new Date(existingInvite.expiresAt) > new Date()) {
      return NextResponse.json({ error: "An invite is already pending for this email" }, { status: 400 });
    }

    // Create invite
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Use user.id (database ID) instead of Clerk userId in case of ID mismatch
    const [invite] = await db
      .insert(workspaceInvites)
      .values({
        workspaceId: workspace.id,
        email: email.toLowerCase(),
        invitedBy: user.id,
        token,
        status: "pending",
        expiresAt,
      })
      .returning();

    // Send invite email
    try {
      await sendWorkspaceInviteEmail({
        email: email.toLowerCase(),
        workspaceName: workspace.name,
        inviterName: user.name || user.email,
        inviteToken: token,
      });
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Don't fail the request if email fails - invite is still valid
    }

    // Log activity
    await logActivity({
      workspaceId: workspace.id,
      userId: user.id,
      action: "member_invited",
      targetType: "invite",
      targetId: invite.id,
      targetName: email.toLowerCase(),
    });

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
