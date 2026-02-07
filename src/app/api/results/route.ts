import { NextRequest, NextResponse } from "next/server";
import { db, monitors, results } from "@/lib/db";
import { eq, desc, inArray, and, lt } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RESULTS_PER_PAGE = 20;

/**
 * GET /api/results
 * Fetch results with cursor-based pagination for infinite scroll
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor"); // ISO timestamp for pagination
    const limit = Math.min(parseInt(searchParams.get("limit") || String(RESULTS_PER_PAGE)), 50);
    const monitorId = searchParams.get("monitorId"); // Optional filter by monitor

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json({
        items: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    const monitorIds = monitorId
      ? [monitorId].filter((id) => userMonitors.some((m) => m.id === id))
      : userMonitors.map((m) => m.id);

    if (monitorIds.length === 0) {
      return NextResponse.json({
        items: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    // Build query conditions
    const conditions = [
      inArray(results.monitorId, monitorIds),
      eq(results.isHidden, false),
    ];

    if (cursor) {
      conditions.push(lt(results.createdAt, new Date(cursor)));
    }

    // Fetch results
    const userResults = await db.query.results.findMany({
      where: and(...conditions),
      orderBy: [desc(results.createdAt)],
      limit: limit + 1, // Fetch one extra to check if there are more
      with: {
        monitor: {
          columns: { name: true, keywords: true },
        },
      },
    });

    // Check if there are more results
    const hasMore = userResults.length > limit;
    const items = hasMore ? userResults.slice(0, -1) : userResults;
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null;

    // SECURITY: No-cache on sensitive data — FIX-006
    // DB: Returns user-scoped columns; explicit column selection deferred — FIX-117
    const response = NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        platform: r.platform,
        sourceUrl: r.sourceUrl,
        title: r.title,
        content: r.content,
        author: r.author,
        postedAt: r.postedAt?.toISOString() || null,
        sentiment: r.sentiment,
        painPointCategory: r.painPointCategory,
        conversationCategory: r.conversationCategory,
        aiSummary: r.aiSummary,
        isViewed: r.isViewed,
        isClicked: r.isClicked,
        isSaved: r.isSaved,
        isHidden: r.isHidden,
        createdAt: r.createdAt.toISOString(),
        monitor: r.monitor ? { name: r.monitor.name, keywords: r.monitor.keywords } : null,
      })),
      nextCursor,
      hasMore,
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return response;
  } catch (error) {
    console.error("Failed to fetch results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
