import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, inArray, and, gte, lte, count, desc, isNotNull, sql } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// PERF-DB-003: SQL GROUP BY aggregations (was: 5000-row JS aggregation)

/**
 * Results Aggregations API
 *
 * Returns aggregated counts for filtering results:
 * - Platform counts
 * - Community/source counts (extracted from sourceUrl)
 * - Conversation category counts
 * - Sentiment counts
 * - Engagement histogram buckets
 *
 * All aggregations use SQL GROUP BY for efficiency instead of
 * fetching thousands of rows and aggregating in JavaScript.
 */

interface PlatformCount {
  platform: string;
  count: number;
}

interface CommunityCount {
  platform: string;
  community: string;
  count: number;
}

interface CategoryCount {
  category: string;
  count: number;
}

interface SentimentCount {
  sentiment: string;
  count: number;
}

interface EngagementBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

interface AggregationsResponse {
  total: number;
  platforms: PlatformCount[];
  communities: CommunityCount[];
  categories: CategoryCount[];
  sentiments: SentimentCount[];
  engagement: EngagementBucket[];
}

/**
 * Extract community identifier from source URL
 * - Reddit: r/subredditname
 * - Hacker News: Hacker News
 * - Product Hunt: Product Hunt
 * - Others: platform name
 */
function extractCommunity(platform: string, sourceUrl: string): string {
  try {
    switch (platform) {
      case "reddit": {
        // Extract subreddit from URL like https://reddit.com/r/subreddit/...
        const match = sourceUrl.match(/\/r\/([^\/\?]+)/i);
        return match ? `r/${match[1]}` : "Reddit";
      }
      case "hackernews":
        return "Hacker News";
      case "producthunt":
        return "Product Hunt";
      case "devto":
        return "Dev.to";
      case "googlereviews": {
        // Try to extract business name from URL
        const gMatch = sourceUrl.match(/place\/([^\/]+)/);
        return gMatch ? decodeURIComponent(gMatch[1].replace(/\+/g, " ")) : "Google Reviews";
      }
      case "trustpilot": {
        // Extract company from trustpilot.com/review/company-name
        const tMatch = sourceUrl.match(/review\/([^\/\?]+)/i);
        return tMatch ? tMatch[1].replace(/-/g, " ") : "Trustpilot";
      }
      case "appstore":
        return "App Store";
      case "playstore":
        return "Play Store";
      case "quora":
        return "Quora";
      default:
        return platform;
    }
  } catch {
    return platform;
  }
}

/** Map SQL engagement bucket names to display labels with min/max ranges */
const engagementBucketMeta: Record<string, { label: string; min: number; max: number }> = {
  none: { label: "0", min: 0, max: 0 },
  low: { label: "1-5", min: 1, max: 5 },
  "medium-low": { label: "6-10", min: 6, max: 10 },
  medium: { label: "11-50", min: 11, max: 50 },
  high: { label: "51-100", min: 51, max: 100 },
  viral: { label: "100+", min: 101, max: Infinity },
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, 'read');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const monitorId = searchParams.get("monitorId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json({
        total: 0,
        platforms: [],
        communities: [],
        categories: [],
        sentiments: [],
        engagement: [],
      } satisfies AggregationsResponse);
    }

    // Filter to specific monitor if requested
    const userMonitorIds = userMonitors.map((m) => m.id);
    const monitorIds = monitorId
      ? userMonitorIds.includes(monitorId)
        ? [monitorId]
        : []
      : userMonitorIds;

    if (monitorId && monitorIds.length === 0) {
      return NextResponse.json(
        { error: "Monitor not found or access denied" },
        { status: 403 }
      );
    }

    // Build where conditions
    const conditions = [
      inArray(results.monitorId, monitorIds),
      eq(results.isHidden, false), // Only count visible results
    ];

    if (dateFrom) {
      conditions.push(gte(results.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(results.createdAt, new Date(dateTo)));
    }

    const whereCondition = and(...conditions);

    // PERF-DB-003: Run all aggregation queries in parallel using SQL GROUP BY
    const engagementCaseExpr = sql`CASE
      WHEN ${results.engagementScore} IS NULL OR ${results.engagementScore} = 0 THEN 'none'
      WHEN ${results.engagementScore} <= 5 THEN 'low'
      WHEN ${results.engagementScore} <= 10 THEN 'medium-low'
      WHEN ${results.engagementScore} <= 50 THEN 'medium'
      WHEN ${results.engagementScore} <= 100 THEN 'high'
      ELSE 'viral'
    END`;

    const [
      totalResult,
      platformCounts,
      categoryCounts,
      sentimentCounts,
      engagementRows,
      communityResults,
    ] = await Promise.all([
      // 1. Total count
      db
        .select({ total: count() })
        .from(results)
        .where(whereCondition),

      // 2. Platform counts via GROUP BY
      db
        .select({
          platform: results.platform,
          count: count(),
        })
        .from(results)
        .where(whereCondition)
        .groupBy(results.platform)
        .orderBy(desc(count())),

      // 3. Category counts via GROUP BY
      db
        .select({
          category: results.conversationCategory,
          count: count(),
        })
        .from(results)
        .where(and(whereCondition, isNotNull(results.conversationCategory)))
        .groupBy(results.conversationCategory)
        .orderBy(desc(count())),

      // 4. Sentiment counts via GROUP BY
      db
        .select({
          sentiment: results.sentiment,
          count: count(),
        })
        .from(results)
        .where(and(whereCondition, isNotNull(results.sentiment)))
        .groupBy(results.sentiment),

      // 5. Engagement buckets via CASE WHEN + GROUP BY
      db
        .select({
          bucket: engagementCaseExpr,
          count: count(),
        })
        .from(results)
        .where(whereCondition)
        .groupBy(engagementCaseExpr),

      // 6. Community extraction — limited fetch (Option B: JS aggregation on smaller dataset)
      db.query.results.findMany({
        where: whereCondition,
        limit: 500,
        columns: {
          platform: true,
          sourceUrl: true,
        },
      }),
    ]);

    const total = totalResult[0]?.total ?? 0;

    // Format platform counts
    const platforms: PlatformCount[] = platformCounts.map((r) => ({
      platform: r.platform,
      count: Number(r.count),
    }));

    // Format category counts
    const categories: CategoryCount[] = categoryCounts
      .filter((r) => r.category !== null)
      .map((r) => ({
        category: r.category!,
        count: Number(r.count),
      }));

    // Format sentiment counts
    const sentiments: SentimentCount[] = sentimentCounts
      .filter((r) => r.sentiment !== null)
      .map((r) => ({
        sentiment: r.sentiment!,
        count: Number(r.count),
      }))
      .sort((a, b) => b.count - a.count);

    // Format engagement buckets — ensure all buckets are present in order
    const engagementMap = new Map(
      engagementRows.map((r) => [r.bucket, Number(r.count)])
    );
    const engagementBuckets: EngagementBucket[] = Object.entries(engagementBucketMeta).map(
      ([key, meta]) => ({
        label: meta.label,
        min: meta.min,
        max: meta.max,
        count: engagementMap.get(key) ?? 0,
      })
    );

    // Aggregate communities in JS (URL parsing requires regex)
    const communityMap = new Map<string, { platform: string; count: number }>();
    communityResults.forEach((r) => {
      const community = extractCommunity(r.platform, r.sourceUrl);
      const key = `${r.platform}:${community}`;
      const current = communityMap.get(key) || { platform: r.platform, count: 0 };
      communityMap.set(key, { platform: current.platform, count: current.count + 1 });
    });
    const communities: CommunityCount[] = Array.from(communityMap.entries())
      .map(([key, value]) => ({
        platform: value.platform,
        community: key.split(":").slice(1).join(":"), // Handle communities with colons
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      total,
      platforms,
      communities,
      categories,
      sentiments,
      engagement: engagementBuckets,
    } satisfies AggregationsResponse);
  } catch (error) {
    console.error("Aggregations error:", error);
    return NextResponse.json(
      { error: "Failed to get aggregations" },
      { status: 500 }
    );
  }
}
