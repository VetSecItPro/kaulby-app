import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET - Get current user's workspace
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with workspace
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

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

    // Get all members
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

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

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
    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        name: name.trim().slice(0, 100),
        ownerId: userId,
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
      .where(eq(users.id, userId));

    return NextResponse.json({ workspace: newWorkspace }, { status: 201 });
  } catch (error) {
    console.error("Error creating workspace:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
