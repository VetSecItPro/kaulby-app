import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, desc, count, and, inArray, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/results - List results for the authenticated user
 *
 * Query params:
 *   - limit: number (default 50, max 100)
 *   - offset: number (default 0)
 *   - monitor_id: string (filter by monitor)
 *   - platform: string (filter by platform)
 *   - sentiment: string (positive, negative, neutral)
 *   - from: ISO date string (filter results from this date)
 *   - to: ISO date string (filter results until this date)
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (userId) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
      const offset = parseInt(searchParams.get("offset") || "0");
      const monitorId = searchParams.get("monitor_id");
      const platform = searchParams.get("platform");
      const sentiment = searchParams.get("sentiment");
      const fromDate = searchParams.get("from");
      const toDate = searchParams.get("to");

      // First, get all monitor IDs for this user
      const userMonitors = await db
        .select({ id: monitors.id })
        .from(monitors)
        .where(eq(monitors.userId, userId));

      const monitorIds = userMonitors.map(m => m.id);

      if (monitorIds.length === 0) {
        return NextResponse.json({
          results: [],
          pagination: { total: 0, limit, offset },
        });
      }

      // Build conditions
      const conditions = [inArray(results.monitorId, monitorIds)];

      if (monitorId) {
        // Verify user owns this monitor
        if (!monitorIds.includes(monitorId)) {
          return NextResponse.json(
            { error: "Monitor not found" },
            { status: 404 }
          );
        }
        conditions.push(eq(results.monitorId, monitorId));
      }

      if (platform) {
        conditions.push(eq(results.platform, platform as typeof results.platform.enumValues[number]));
      }

      if (sentiment) {
        conditions.push(eq(results.sentiment, sentiment as typeof results.sentiment.enumValues[number]));
      }

      if (fromDate) {
        conditions.push(gte(results.createdAt, new Date(fromDate)));
      }

      if (toDate) {
        conditions.push(lte(results.createdAt, new Date(toDate)));
      }

      // Query results
      const resultsList = await db
        .select({
          id: results.id,
          monitorId: results.monitorId,
          platform: results.platform,
          sourceUrl: results.sourceUrl,
          title: results.title,
          content: results.content,
          author: results.author,
          postedAt: results.postedAt,
          sentiment: results.sentiment,
          sentimentScore: results.sentimentScore,
          painPointCategory: results.painPointCategory,
          conversationCategory: results.conversationCategory,
          aiSummary: results.aiSummary,
          createdAt: results.createdAt,
        })
        .from(results)
        .where(and(...conditions))
        .orderBy(desc(results.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(results)
        .where(and(...conditions));

      return NextResponse.json({
        results: resultsList,
        pagination: {
          total: totalResult?.count || 0,
          limit,
          offset,
        },
      });
    } catch (error) {
      console.error("API v1 results error:", error);
      return NextResponse.json(
        { error: "Failed to fetch results" },
        { status: 500 }
      );
    }
  });
}
