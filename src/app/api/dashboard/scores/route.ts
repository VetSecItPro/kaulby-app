import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, count, sql } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ScoreResponse {
  presenceScore: number;
  presenceExplanation: string;
  presenceTrend: "up" | "down" | "stable";
  reputationScore: number;
  reputationExplanation: string;
  reputationTrend: "up" | "down" | "stable";
}

function emptyScores(): ScoreResponse {
  return {
    presenceScore: 0,
    presenceExplanation: "No mentions found yet. Set up monitors to start tracking.",
    presenceTrend: "stable",
    reputationScore: 0,
    reputationExplanation: "No data available. Mentions will be analyzed as they come in.",
    reputationTrend: "stable",
  };
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

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json(emptyScores());
    }

    const monitorIds = userMonitors.map((m) => m.id);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Fetch all data in parallel
    const [
      // Platform diversity + volume (last 30 days)
      platformCounts,
      // Total mentions last 30 days
      totalMentions30d,
      // Daily distribution for consistency (last 30 days)
      dailyCounts,
      // Sentiment counts for last 30 days
      sentimentCounts,
      // Average engagement score (last 30 days)
      avgEngagement,
      // Sentiment for recent 14 days (trend)
      recentSentiment,
      // Sentiment for previous 14 days (trend baseline)
      previousSentiment,
      // Mention count for recent 14 days vs previous 14 days (presence trend)
      recentMentionCount,
      previousMentionCount,
    ] = await Promise.all([
      // Unique platforms with mention counts
      db
        .select({
          platform: results.platform,
          mentionCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(results.platform),

      // Total mentions last 30 days
      db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        ),

      // Daily distribution (count per day, last 30 days)
      db
        .select({
          day: sql<string>`DATE(${results.createdAt})`,
          dayCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        )
        .groupBy(sql`DATE(${results.createdAt})`),

      // Sentiment distribution (last 30 days)
      db
        .select({
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
        .groupBy(results.sentiment),

      // Average engagement score (last 30 days)
      db
        .select({
          avgScore: sql<number>`COALESCE(AVG(${results.engagementScore}), 0)`,
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, thirtyDaysAgo)
          )
        ),

      // Recent 14 days sentiment
      db
        .select({
          sentiment: results.sentiment,
          sentimentCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, fourteenDaysAgo)
          )
        )
        .groupBy(results.sentiment),

      // Previous 14 days sentiment (14-28 days ago)
      db
        .select({
          sentiment: results.sentiment,
          sentimentCount: count(),
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, twentyEightDaysAgo),
            sql`${results.createdAt} < ${fourteenDaysAgo}`
          )
        )
        .groupBy(results.sentiment),

      // Recent 14 days mention count
      db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, fourteenDaysAgo)
          )
        ),

      // Previous 14 days mention count
      db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, twentyEightDaysAgo),
            sql`${results.createdAt} < ${fourteenDaysAgo}`
          )
        ),
    ]);

    // ─── PRESENCE SCORE ───────────────────────────────────────────────

    // Platform diversity (0-100): more platforms = higher score
    // 17 total platforms possible; 5+ is excellent
    const uniquePlatforms = platformCounts.length;
    const platformDiversity = Math.min(100, (uniquePlatforms / 5) * 100);

    // Volume score (0-100): mentions relative to a reasonable baseline
    // Baseline: 30 mentions in 30 days (1/day) = 50 score, 90+ = 100
    const totalMentions = totalMentions30d[0]?.count || 0;
    const volumeScore = Math.min(100, (totalMentions / 90) * 100);

    // Consistency score (0-100): how spread out mentions are across days
    // Perfect = mentions every day, worst = all in one day
    const daysWithMentions = dailyCounts.length;
    const consistencyScore = totalMentions === 0
      ? 0
      : Math.min(100, (daysWithMentions / 30) * 100);

    const presenceScore = Math.round(
      platformDiversity * 0.35 + volumeScore * 0.35 + consistencyScore * 0.30
    );

    // Presence trend
    const recentMentions = recentMentionCount[0]?.count || 0;
    const previousMentions = previousMentionCount[0]?.count || 0;
    const presenceTrend: "up" | "down" | "stable" =
      previousMentions === 0
        ? recentMentions > 0
          ? "up"
          : "stable"
        : recentMentions > previousMentions * 1.15
          ? "up"
          : recentMentions < previousMentions * 0.85
            ? "down"
            : "stable";

    // Presence explanation
    const presenceExplanation = buildPresenceExplanation(
      presenceScore,
      uniquePlatforms,
      totalMentions,
      daysWithMentions
    );

    // ─── REPUTATION SCORE ─────────────────────────────────────────────

    // Sentiment ratio (0-100): percentage of positive mentions
    const sentimentMap: Record<string, number> = {};
    for (const s of sentimentCounts) {
      if (s.sentiment) sentimentMap[s.sentiment] = s.sentimentCount;
    }
    const positive = sentimentMap["positive"] || 0;
    const negative = sentimentMap["negative"] || 0;
    const neutral = sentimentMap["neutral"] || 0;
    const totalSentiment = positive + negative + neutral;
    const sentimentScore =
      totalSentiment === 0
        ? 50 // neutral default
        : Math.round(((positive + neutral * 0.5) / totalSentiment) * 100);

    // Engagement quality (0-100): normalize average engagement
    // engagementScore in DB represents upvotes+comments; 50+ is high
    const rawAvgEngagement = Number(avgEngagement[0]?.avgScore || 0);
    const engagementQuality = Math.min(100, Math.round((rawAvgEngagement / 50) * 100));

    // Trend score (0-100): is sentiment improving?
    const recentSentimentMap: Record<string, number> = {};
    for (const s of recentSentiment) {
      if (s.sentiment) recentSentimentMap[s.sentiment] = s.sentimentCount;
    }
    const previousSentimentMap: Record<string, number> = {};
    for (const s of previousSentiment) {
      if (s.sentiment) previousSentimentMap[s.sentiment] = s.sentimentCount;
    }

    const recentPositiveRatio = calculatePositiveRatio(recentSentimentMap);
    const previousPositiveRatio = calculatePositiveRatio(previousSentimentMap);

    // Trend score: 50 = stable, >50 = improving, <50 = declining
    const trendDelta = recentPositiveRatio - previousPositiveRatio;
    const trendScore = Math.min(100, Math.max(0, 50 + trendDelta * 200));

    const reputationScore = Math.round(
      sentimentScore * 0.50 + engagementQuality * 0.25 + trendScore * 0.25
    );

    // Reputation trend
    const reputationTrend: "up" | "down" | "stable" =
      trendDelta > 0.05 ? "up" : trendDelta < -0.05 ? "down" : "stable";

    // Reputation explanation
    const reputationExplanation = buildReputationExplanation(
      reputationScore,
      positive,
      negative,
      totalSentiment,
      reputationTrend
    );

    const response = NextResponse.json<ScoreResponse>({
      presenceScore,
      presenceExplanation,
      presenceTrend,
      reputationScore,
      reputationExplanation,
      reputationTrend,
    });
    response.headers.set("Cache-Control", "private, max-age=300");
    return response;
  } catch (error) {
    console.error("Brand scores error:", error);
    return NextResponse.json(
      { error: "Failed to calculate brand scores" },
      { status: 500 }
    );
  }
}

function calculatePositiveRatio(sentimentMap: Record<string, number>): number {
  const pos = sentimentMap["positive"] || 0;
  const neg = sentimentMap["negative"] || 0;
  const neu = sentimentMap["neutral"] || 0;
  const total = pos + neg + neu;
  if (total === 0) return 0.5;
  return (pos + neu * 0.5) / total;
}

function buildPresenceExplanation(
  score: number,
  platforms: number,
  mentions: number,
  activeDays: number
): string {
  if (mentions === 0) {
    return "No mentions found in the last 30 days. Ensure your monitors are active.";
  }
  const parts: string[] = [];
  parts.push(`${mentions} mentions across ${platforms} platform${platforms !== 1 ? "s" : ""}`);
  if (activeDays >= 20) {
    parts.push("with very consistent daily presence");
  } else if (activeDays >= 10) {
    parts.push("with moderate consistency");
  } else {
    parts.push("but mentions are sporadic");
  }
  if (score >= 80) return `Strong presence. ${parts.join(" ")}.`;
  if (score >= 60) return `Good presence. ${parts.join(" ")}.`;
  if (score >= 40) return `Growing presence. ${parts.join(" ")}.`;
  return `Early-stage presence. ${parts.join(" ")}.`;
}

function buildReputationExplanation(
  score: number,
  positive: number,
  negative: number,
  total: number,
  trend: "up" | "down" | "stable"
): string {
  if (total === 0) {
    return "No sentiment data yet. Mentions will be analyzed as they arrive.";
  }
  const posPercent = Math.round((positive / total) * 100);
  const trendText =
    trend === "up"
      ? "Sentiment is improving"
      : trend === "down"
        ? "Sentiment is declining"
        : "Sentiment is stable";
  if (score >= 80) return `Excellent reputation. ${posPercent}% positive mentions. ${trendText}.`;
  if (score >= 60) return `Healthy reputation. ${posPercent}% positive. ${trendText}.`;
  if (score >= 40) return `Mixed reputation. ${posPercent}% positive, ${negative} negative. ${trendText}.`;
  return `Needs attention. ${negative} negative mentions out of ${total}. ${trendText}.`;
}
