import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, count, sql, desc } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface BrandStats {
  monitorId: string;
  brandName: string;
  isYourBrand: boolean;
  totalMentions: number;
  positive: number;
  neutral: number;
  negative: number;
  avgEngagement: number;
  topPlatform: string | null;
  thisWeekMentions: number;
  lastWeekMentions: number;
  trend: "up" | "down" | "flat";
  trendPercent: number;
}

interface CompetitorResponse {
  brands: BrandStats[];
}

function emptyResponse(): CompetitorResponse {
  return { brands: [] };
}

export async function GET() {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    // Get all user's monitors with company name
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: {
        id: true,
        name: true,
        companyName: true,
        keywords: true,
        createdAt: true,
      },
      orderBy: [monitors.createdAt],
    });

    if (userMonitors.length === 0) {
      return NextResponse.json(emptyResponse());
    }

    const monitorIds = userMonitors.map((m) => m.id);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Determine which monitor is "your brand" vs competitors
    // First monitor (oldest) is treated as your brand, unless one has "competitor" in keywords
    const firstMonitorId = userMonitors[0].id;

    function isCompetitorMonitor(m: typeof userMonitors[number]): boolean {
      const hasCompetitorKeyword = m.keywords.some(
        (kw) => kw.toLowerCase().includes("competitor")
      );
      if (hasCompetitorKeyword) return true;
      // The first (oldest) monitor is the user's own brand
      return m.id !== firstMonitorId;
    }

    // Fetch per-monitor stats in parallel
    const [
      // Per-monitor mention counts (last 30 days)
      mentionCounts,
      // Per-monitor sentiment breakdown (last 30 days)
      sentimentBreakdown,
      // Per-monitor average engagement (last 30 days)
      engagementAvgs,
      // Per-monitor top platform (last 30 days)
      platformBreakdown,
      // Per-monitor this week mentions
      thisWeekCounts,
      // Per-monitor last week mentions (7-14 days ago)
      lastWeekCounts,
    ] = await Promise.all([
      // Total mentions per monitor (30 days)
      db
        .select({
          monitorId: results.monitorId,
          mentionCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(results.monitorId),

      // Sentiment per monitor (30 days)
      db
        .select({
          monitorId: results.monitorId,
          sentiment: results.sentiment,
          sentimentCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(results.monitorId, results.sentiment),

      // Avg engagement per monitor (30 days)
      db
        .select({
          monitorId: results.monitorId,
          avgScore: sql<number>`COALESCE(AVG(${results.engagementScore}), 0)`,
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(results.monitorId),

      // Platform breakdown per monitor (30 days) - get top platform
      db
        .select({
          monitorId: results.monitorId,
          platform: results.platform,
          platformCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(results.monitorId, results.platform)
        .orderBy(desc(count())),

      // This week mentions per monitor
      db
        .select({
          monitorId: results.monitorId,
          mentionCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, sevenDaysAgo)
          )
        )
        .groupBy(results.monitorId),

      // Last week mentions per monitor (7-14 days ago)
      db
        .select({
          monitorId: results.monitorId,
          mentionCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, fourteenDaysAgo),
            sql`${results.createdAt} < ${sevenDaysAgo}`
          )
        )
        .groupBy(results.monitorId),
    ]);

    // Index data by monitorId for quick lookups
    const mentionMap = new Map(mentionCounts.map((m) => [m.monitorId, m.mentionCount]));
    const engagementMap = new Map(engagementAvgs.map((m) => [m.monitorId, Number(m.avgScore)]));
    const thisWeekMap = new Map(thisWeekCounts.map((m) => [m.monitorId, m.mentionCount]));
    const lastWeekMap = new Map(lastWeekCounts.map((m) => [m.monitorId, m.mentionCount]));

    // Build sentiment maps per monitor
    const sentimentMap = new Map<string, { positive: number; neutral: number; negative: number }>();
    for (const row of sentimentBreakdown) {
      if (!sentimentMap.has(row.monitorId)) {
        sentimentMap.set(row.monitorId, { positive: 0, neutral: 0, negative: 0 });
      }
      const entry = sentimentMap.get(row.monitorId)!;
      if (row.sentiment === "positive") entry.positive = row.sentimentCount;
      else if (row.sentiment === "negative") entry.negative = row.sentimentCount;
      else if (row.sentiment === "neutral") entry.neutral = row.sentimentCount;
    }

    // Find top platform per monitor
    const topPlatformMap = new Map<string, string>();
    for (const row of platformBreakdown) {
      // First occurrence per monitor has the highest count (ordered by count desc)
      if (!topPlatformMap.has(row.monitorId)) {
        topPlatformMap.set(row.monitorId, row.platform);
      }
    }

    // Build response
    const brands: BrandStats[] = userMonitors.map((m) => {
      const totalMentions = mentionMap.get(m.id) || 0;
      const sentiment = sentimentMap.get(m.id) || { positive: 0, neutral: 0, negative: 0 };
      const avgEngagement = Math.round(engagementMap.get(m.id) || 0);
      const topPlatform = topPlatformMap.get(m.id) || null;
      const thisWeek = thisWeekMap.get(m.id) || 0;
      const lastWeek = lastWeekMap.get(m.id) || 0;

      let trend: "up" | "down" | "flat" = "flat";
      let trendPercent = 0;

      if (lastWeek > 0) {
        trendPercent = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
        if (trendPercent > 10) trend = "up";
        else if (trendPercent < -10) trend = "down";
      } else if (thisWeek > 0) {
        trend = "up";
        trendPercent = 100;
      }

      return {
        monitorId: m.id,
        brandName: m.companyName || m.name,
        isYourBrand: !isCompetitorMonitor(m),
        totalMentions,
        positive: sentiment.positive,
        neutral: sentiment.neutral,
        negative: sentiment.negative,
        avgEngagement,
        topPlatform,
        thisWeekMentions: thisWeek,
        lastWeekMentions: lastWeek,
        trend,
        trendPercent,
      };
    });

    // Sort by total mentions descending
    brands.sort((a, b) => b.totalMentions - a.totalMentions);

    const response = NextResponse.json<CompetitorResponse>({ brands });
    response.headers.set("Cache-Control", "private, max-age=300");
    return response;
  } catch (error) {
    logger.error("Competitor comparison error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to fetch competitor data" },
      { status: 500 }
    );
  }
}
