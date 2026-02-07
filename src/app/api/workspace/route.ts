import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { findUserWithFallback } from "@/lib/auth-utils";
import { logActivity } from "@/lib/activity-log";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET - Get current user's workspace
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

    // FIX-213: Get all members
    // TODO: Consider potential N+1 query pattern - if workspace has many members,
    // this could be optimized by using a join or by paginating members list.
    // For now, team workspaces are limited to 5 seats, so this is acceptable.
    // If seat limits increase significantly, consider refactoring to use a single
    // query with JOIN or implement pagination for large teams.
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
    console.error("Error fetching workspace:", error);
    return NextResponse.json({ error: "Failed to fetch workspace" }, { status: 500 });
  }
}

// POST - Create a new workspace (Enterprise users only)
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
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    // Get user (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is enterprise
    if (user.subscriptionStatus !== "enterprise") {
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

    // Create workspace and update user in transaction
    // Use user.id (database ID) instead of Clerk userId in case of ID mismatch
    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        name: name.trim().slice(0, 100),
        ownerId: user.id,
        seatLimit: 5,
        seatCount: 1,
      })
      .returning();

    // Update user to be owner of workspace
    await db
      .update(users)
      .set({
        workspaceId: newWorkspace.id,
        workspaceRole: "owner",
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Log activity
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
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error("Error creating workspace:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
