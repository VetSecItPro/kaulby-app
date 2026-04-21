import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, activityLogs, users } from "@/lib/db";
import { eq, desc, and, lt, isNull } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/activity
 * Fetch activity logs for the user's workspace
 * Supports cursor-based pagination
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, 'read');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Get user's workspace
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { workspaceId: true, workspaceRole: true },
    });

    if (!user?.workspaceId) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor"); // ISO timestamp for pagination
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Build query conditions
    // Task DL.3: exclude soft-deleted rows so users don't see records inside the 30d grace window.
    const conditions = [
      eq(activityLogs.workspaceId, user.workspaceId),
      isNull(activityLogs.deletedAt),
    ];
    if (cursor) {
      conditions.push(lt(activityLogs.createdAt, new Date(cursor)));
    }

    // FIX-220: Composite index activity_logs_workspace_created_idx covers this query
    const logs = await db.query.activityLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(activityLogs.createdAt)],
      limit: limit + 1, // Fetch one extra to check if there are more
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
      },
    });

    // Check if there are more results
    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, -1) : logs;
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null;

    return NextResponse.json({
      items: items.map((log) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        targetName: log.targetName,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
        user: {
          id: log.user.id,
          name: log.user.name,
          email: log.user.email,
        },
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    logger.error("Failed to fetch activity logs:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}
