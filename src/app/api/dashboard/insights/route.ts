import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, desc, gte, and, count, or } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json(emptyActionableData());
    }

    const monitorIds = userMonitors.map((m) => m.id);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      // 1. Respond Now - Solution/advice requests from last 48hrs, unread
      respondNowResults,

      // 2. High-Intent Leads - High lead score posts, unread
      highIntentResults,

      // 3. Negative Attention - Negative sentiment, unread
      negativeResults,

      // 4. Engage Today - Hot posts from last 24hrs
      engageTodayResults,

      // 5. Pain Points - People with problems you can solve
      painPointResults,

      // 6. Unread count total
      unreadCount,

      // 7. Spike detection - compare today vs average
      todayCount,
      weekCount,

      // 8. Clicked/engaged this week (gamification)
      engagedThisWeek,
    ] = await Promise.all([
      // 1. Respond Now - Questions seeking solutions/advice
      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, fortyEightHoursAgo),
          eq(results.isViewed, false),
          eq(results.isHidden, false),
          or(
            eq(results.conversationCategory, "solution_request"),
            eq(results.conversationCategory, "advice_request")
          )
        ),
        columns: {
          id: true,
          title: true,
          platform: true,
          sourceUrl: true,
          conversationCategory: true,
          createdAt: true,
        },
        orderBy: desc(results.createdAt),
        limit: 5,
      }),

      // 2. High-Intent Leads (lead_score >= 60)
      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          eq(results.isViewed, false),
          eq(results.isHidden, false),
          gte(results.leadScore, 60)
        ),
        columns: {
          id: true,
          title: true,
          platform: true,
          sourceUrl: true,
          leadScore: true,
          createdAt: true,
        },
        orderBy: desc(results.leadScore),
        limit: 5,
      }),

      // 3. Negative Attention - Negative sentiment posts
      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, sevenDaysAgo),
          eq(results.isViewed, false),
          eq(results.isHidden, false),
          eq(results.sentiment, "negative")
        ),
        columns: {
          id: true,
          title: true,
          platform: true,
          sourceUrl: true,
          sentiment: true,
          createdAt: true,
        },
        orderBy: desc(results.createdAt),
        limit: 5,
      }),

      // 4. Engage Today - Hot posts from last 24hrs
      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, twentyFourHoursAgo),
          eq(results.isHidden, false),
          gte(results.engagementScore, 10) // At least 10 engagement
        ),
        columns: {
          id: true,
          title: true,
          platform: true,
          sourceUrl: true,
          engagementScore: true,
          createdAt: true,
        },
        orderBy: desc(results.engagementScore),
        limit: 5,
      }),

      // 5. Pain Points - Problems people are expressing
      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, fortyEightHoursAgo),
          eq(results.isViewed, false),
          eq(results.isHidden, false),
          eq(results.conversationCategory, "pain_point")
        ),
        columns: {
          id: true,
          title: true,
          platform: true,
          sourceUrl: true,
          painPointCategory: true,
          createdAt: true,
        },
        orderBy: desc(results.createdAt),
        limit: 5,
      }),

      // 6. Total unread count
      db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            eq(results.isViewed, false),
            eq(results.isHidden, false)
          )
        ),

      // 7a. Today's results count
      db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, twentyFourHoursAgo)
          )
        ),

      // 7b. Week's results count
      db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, sevenDaysAgo)
          )
        ),

      // 8. How many posts user has engaged with this week
      db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, sevenDaysAgo),
            or(
              eq(results.isClicked, true),
              eq(results.isViewed, true)
            )
          )
        ),
    ]);

    // Calculate spike detection
    const todayTotal = todayCount[0]?.count || 0;
    const weekTotal = weekCount[0]?.count || 0;
    const avgDaily = weekTotal / 7;
    const hasSpike = todayTotal > avgDaily * 2 && todayTotal > 5;

    // Find top opportunity (best combination of recency + intent + engagement)
    const topOpportunity = findTopOpportunity([
      ...respondNowResults,
      ...highIntentResults,
      ...engageTodayResults,
    ]);

    const response = NextResponse.json({
      // Actionable items
      respondNow: respondNowResults.map(formatResult),
      respondNowCount: respondNowResults.length,

      highIntentLeads: highIntentResults.map((r) => ({
        ...formatResult(r),
        leadScore: r.leadScore,
      })),
      highIntentCount: highIntentResults.length,

      negativeAttention: negativeResults.map(formatResult),
      negativeCount: negativeResults.length,

      engageToday: engageTodayResults.map((r) => ({
        ...formatResult(r),
        engagement: r.engagementScore || 0,
      })),
      engageTodayCount: engageTodayResults.length,

      painPoints: painPointResults.map(formatResult),
      painPointCount: painPointResults.length,

      // Summary stats
      unreadCount: unreadCount[0]?.count || 0,
      todayCount: todayTotal,

      // Spike alert
      hasSpike,
      spikeMessage: hasSpike
        ? `${todayTotal} mentions today (${Math.round(todayTotal / avgDaily)}x normal)`
        : null,

      // Top opportunity
      topOpportunity,

      // Gamification
      engagedThisWeek: engagedThisWeek[0]?.count || 0,
    });
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return response;
  } catch (error) {
    console.error("Dashboard insights error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard insights" },
      { status: 500 }
    );
  }
}

function emptyActionableData() {
  return {
    respondNow: [],
    respondNowCount: 0,
    highIntentLeads: [],
    highIntentCount: 0,
    negativeAttention: [],
    negativeCount: 0,
    engageToday: [],
    engageTodayCount: 0,
    painPoints: [],
    painPointCount: 0,
    unreadCount: 0,
    todayCount: 0,
    hasSpike: false,
    spikeMessage: null,
    topOpportunity: null,
    engagedThisWeek: 0,
  };
}

function formatResult(r: {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  createdAt: Date;
}) {
  return {
    id: r.id,
    title: r.title,
    platform: r.platform,
    sourceUrl: r.sourceUrl,
    createdAt: r.createdAt.toISOString(),
  };
}

function findTopOpportunity(
  results: Array<{
    id: string;
    title: string;
    platform: string;
    sourceUrl: string;
    createdAt: Date;
    leadScore?: number | null;
    engagementScore?: number | null;
    conversationCategory?: string | null;
  }>
): { id: string; title: string; platform: string; sourceUrl: string; reason: string } | null {
  if (results.length === 0) return null;

  // Score each result
  const scored = results.map((r) => {
    let score = 0;
    let reason = "";

    // Recency bonus (last 6 hours = max points)
    const hoursAgo = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 6) {
      score += 30;
      reason = "Fresh post";
    } else if (hoursAgo < 12) {
      score += 20;
      reason = "Recent post";
    } else if (hoursAgo < 24) {
      score += 10;
    }

    // Lead score bonus
    if (r.leadScore && r.leadScore >= 80) {
      score += 40;
      reason = "High buying intent";
    } else if (r.leadScore && r.leadScore >= 60) {
      score += 25;
      reason = reason || "Strong lead signal";
    }

    // Engagement bonus
    if (r.engagementScore && r.engagementScore >= 50) {
      score += 20;
      reason = reason || "Hot discussion";
    } else if (r.engagementScore && r.engagementScore >= 20) {
      score += 10;
    }

    // Category bonus
    if (r.conversationCategory === "solution_request") {
      score += 25;
      reason = reason || "Asking for recommendations";
    } else if (r.conversationCategory === "advice_request") {
      score += 15;
      reason = reason || "Seeking advice";
    }

    return { ...r, score, reason: reason || "Good opportunity" };
  });

  // Sort by score and return top
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  return {
    id: top.id,
    title: top.title,
    platform: top.platform,
    sourceUrl: top.sourceUrl,
    reason: top.reason,
  };
}
