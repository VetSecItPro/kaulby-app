import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, inArray, and, gte, lte } from "drizzle-orm";

// Force dynamic rendering
export const dynamic = "force-dynamic";

/**
 * Results Aggregations API
 *
 * Returns aggregated counts for filtering results:
 * - Platform counts
 * - Community/source counts (extracted from sourceUrl)
 * - Conversation category counts
 * - Sentiment counts
 * - Engagement histogram buckets
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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Fetch all results for aggregation
    // Note: For large datasets, this could be optimized with SQL GROUP BY queries
    const userResults = await db.query.results.findMany({
      where: whereCondition,
      columns: {
        platform: true,
        sourceUrl: true,
        conversationCategory: true,
        sentiment: true,
        engagementScore: true,
      },
    });

    const total = userResults.length;

    // Platform counts
    const platformMap = new Map<string, number>();
    userResults.forEach((r) => {
      const current = platformMap.get(r.platform) || 0;
      platformMap.set(r.platform, current + 1);
    });
    const platforms: PlatformCount[] = Array.from(platformMap.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);

    // Community counts
    const communityMap = new Map<string, { platform: string; count: number }>();
    userResults.forEach((r) => {
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

    // Category counts
    const categoryMap = new Map<string, number>();
    userResults.forEach((r) => {
      if (r.conversationCategory) {
        const current = categoryMap.get(r.conversationCategory) || 0;
        categoryMap.set(r.conversationCategory, current + 1);
      }
    });
    const categories: CategoryCount[] = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Sentiment counts
    const sentimentMap = new Map<string, number>();
    userResults.forEach((r) => {
      if (r.sentiment) {
        const current = sentimentMap.get(r.sentiment) || 0;
        sentimentMap.set(r.sentiment, current + 1);
      }
    });
    const sentiments: SentimentCount[] = Array.from(sentimentMap.entries())
      .map(([sentiment, count]) => ({ sentiment, count }))
      .sort((a, b) => b.count - a.count);

    // Engagement histogram buckets (GummySearch-style)
    const engagementBuckets: EngagementBucket[] = [
      { label: "0", min: 0, max: 0, count: 0 },
      { label: "1-5", min: 1, max: 5, count: 0 },
      { label: "6-10", min: 6, max: 10, count: 0 },
      { label: "11-50", min: 11, max: 50, count: 0 },
      { label: "51-100", min: 51, max: 100, count: 0 },
      { label: "100+", min: 101, max: Infinity, count: 0 },
    ];

    userResults.forEach((r) => {
      const score = r.engagementScore ?? 0;
      for (const bucket of engagementBuckets) {
        if (score >= bucket.min && score <= bucket.max) {
          bucket.count++;
          break;
        }
      }
    });

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
