import { getEffectiveUserId } from "@/lib/dev-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { findUserWithFallback } from "@/lib/auth-utils";
import { logActivity } from "@/lib/activity-log";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET - Get current user's workspace
export async function GET() {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, 'read');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Get user with workspace (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Not in a workspace
    if (!user.workspaceId) {
      return NextResponse.json({ workspace: null });
    }

    // Get workspace details with member count
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, user.workspaceId),
    });

    if (!workspace) {
      return NextResponse.json({ workspace: null });
    }

    // Get workspace members (bounded by 5-seat limit)
    const members = await db.query.users.findMany({
      where: eq(users.workspaceId, workspace.id),
    });

    return NextResponse.json({
      workspace: {
        ...workspace,
        members: members.map((m) => ({
          id: m.id,
          email: m.email,
          name: m.name,
          role: m.workspaceRole,
          isCurrentUser: m.id === user.id,
        })),
      },
      role: user.workspaceRole,
    });
  } catch (error) {
    logger.error("Error fetching workspace:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to fetch workspace" }, { status: 500 });
  }
}

// POST - Create a new workspace (Enterprise users only)
export async function POST(request: Request) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    const body = await parseJsonBody(request);
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    // Get user (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is team tier
    if (user.subscriptionStatus !== "growth") {
      return NextResponse.json(
        { error: "Team workspaces are only available on the Enterprise plan" },
        { status: 403 }
      );
    }

    // Check if user already has a workspace
    if (user.workspaceId) {
      return NextResponse.json(
        { error: "You are already in a workspace. Leave your current workspace first." },
        { status: 400 }
      );
    }

    // Create workspace and assign user atomically
    const newWorkspace = await db.transaction(async (tx) => {
      // Re-check user doesn't already have a workspace (prevent race)
      const freshUser = await tx.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { workspaceId: true },
      });
      if (freshUser?.workspaceId) {
        throw new Error("ALREADY_IN_WORKSPACE");
      }

      const [ws] = await tx
        .insert(workspaces)
        .values({
          name: name.trim().slice(0, 100),
          ownerId: user.id,
          seatLimit: 3,
          seatCount: 1,
        })
        .returning();

      await tx
        .update(users)
        .set({
          workspaceId: ws.id,
          workspaceRole: "owner",
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      return ws;
    });

    // Log activity (outside transaction — non-critical)
    await logActivity({
      workspaceId: newWorkspace.id,
      userId: user.id,
      action: "workspace_created",
      targetType: "workspace",
      targetId: newWorkspace.id,
      targetName: newWorkspace.name,
    });

    return NextResponse.json({ workspace: newWorkspace }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_IN_WORKSPACE") {
      return NextResponse.json({ error: "You are already in a workspace" }, { status: 400 });
    }
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    logger.error("Error creating workspace:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
