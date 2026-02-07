import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, monitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET - List all monitors in workspace
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

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.workspaceId) {
      return NextResponse.json({ error: "You are not in a workspace" }, { status: 400 });
    }

    // Get all monitors in the workspace with user info
    const workspaceMonitors = await db.query.monitors.findMany({
      where: eq(monitors.workspaceId, user.workspaceId),
      with: {
        user: true,
      },
      orderBy: (monitors, { desc }) => [desc(monitors.createdAt)],
    });

    // Get all workspace members for dropdown
    const members = await db.query.users.findMany({
      where: eq(users.workspaceId, user.workspaceId),
    });

    return NextResponse.json({
      monitors: workspaceMonitors.map((m) => ({
        id: m.id,
        name: m.name,
        companyName: m.companyName,
        keywords: m.keywords,
        platforms: m.platforms,
        isActive: m.isActive,
        newMatchCount: m.newMatchCount,
        lastCheckedAt: m.lastCheckedAt,
        createdAt: m.createdAt,
        assignee: m.user ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
        } : null,
      })),
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.workspaceRole,
      })),
      isOwner: user.workspaceRole === "owner",
    });
  } catch (error) {
    console.error("Error fetching workspace monitors:", error);
    return NextResponse.json({ error: "Failed to fetch monitors" }, { status: 500 });
  }
}
