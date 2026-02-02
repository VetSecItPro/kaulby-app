import { DashboardCards, type ActionableInsight } from "./dashboard-cards";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, desc, gte, and, count, or } from "drizzle-orm";

export async function DashboardInsights() {
  const data = await fetchDashboardInsights();
  if (!data) return null;
  return <DashboardCards data={data} />;
}

async function fetchDashboardInsights(): Promise<ActionableInsight | null> {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) return null;

    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });

    if (userMonitors.length === 0) return null;

    const monitorIds = userMonitors.map((m) => m.id);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      respondNowResults,
      highIntentResults,
      negativeResults,
      engageTodayResults,
      painPointResults,
      unreadCount,
      todayCount,
      weekCount,
      engagedThisWeek,
    ] = await Promise.all([
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
        columns: { id: true, title: true, platform: true, sourceUrl: true, conversationCategory: true, createdAt: true },
        orderBy: desc(results.createdAt),
        limit: 5,
      }),

      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          eq(results.isViewed, false),
          eq(results.isHidden, false),
          gte(results.leadScore, 60)
        ),
        columns: { id: true, title: true, platform: true, sourceUrl: true, leadScore: true, createdAt: true },
        orderBy: desc(results.leadScore),
        limit: 5,
      }),

      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, sevenDaysAgo),
          eq(results.isViewed, false),
          eq(results.isHidden, false),
          eq(results.sentiment, "negative")
        ),
        columns: { id: true, title: true, platform: true, sourceUrl: true, sentiment: true, createdAt: true },
        orderBy: desc(results.createdAt),
        limit: 5,
      }),

      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, twentyFourHoursAgo),
          eq(results.isHidden, false),
          gte(results.engagementScore, 10)
        ),
        columns: { id: true, title: true, platform: true, sourceUrl: true, engagementScore: true, createdAt: true },
        orderBy: desc(results.engagementScore),
        limit: 5,
      }),

      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, fortyEightHoursAgo),
          eq(results.isViewed, false),
          eq(results.isHidden, false),
          eq(results.conversationCategory, "pain_point")
        ),
        columns: { id: true, title: true, platform: true, sourceUrl: true, painPointCategory: true, createdAt: true },
        orderBy: desc(results.createdAt),
        limit: 5,
      }),

      db.select({ count: count() }).from(results).where(
        and(inArray(results.monitorId, monitorIds), eq(results.isViewed, false), eq(results.isHidden, false))
      ),

      db.select({ count: count() }).from(results).where(
        and(inArray(results.monitorId, monitorIds), gte(results.createdAt, twentyFourHoursAgo))
      ),

      db.select({ count: count() }).from(results).where(
        and(inArray(results.monitorId, monitorIds), gte(results.createdAt, sevenDaysAgo))
      ),

      db.select({ count: count() }).from(results).where(
        and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, sevenDaysAgo),
          or(eq(results.isClicked, true), eq(results.isViewed, true))
        )
      ),
    ]);

    const todayTotal = todayCount[0]?.count || 0;
    const weekTotal = weekCount[0]?.count || 0;
    const avgDaily = weekTotal / 7;
    const hasSpike = todayTotal > avgDaily * 2 && todayTotal > 5;

    const topOpportunity = findTopOpportunity([
      ...respondNowResults,
      ...highIntentResults,
      ...engageTodayResults,
    ]);

    return {
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
      unreadCount: unreadCount[0]?.count || 0,
      todayCount: todayTotal,
      hasSpike,
      spikeMessage: hasSpike
        ? `${todayTotal} mentions today (${Math.round(todayTotal / avgDaily)}x normal)`
        : null,
      topOpportunity,
      engagedThisWeek: engagedThisWeek[0]?.count || 0,
    };
  } catch (error) {
    console.error("Dashboard insights error:", error);
    return null;
  }
}

function formatResult(r: { id: string; title: string; platform: string; sourceUrl: string; createdAt: Date }) {
  return {
    id: r.id,
    title: r.title,
    platform: r.platform,
    sourceUrl: r.sourceUrl,
    createdAt: r.createdAt.toISOString(),
  };
}

function findTopOpportunity(
  items: Array<{
    id: string;
    title: string;
    platform: string;
    sourceUrl: string;
    createdAt: Date;
    leadScore?: number | null;
    engagementScore?: number | null;
    conversationCategory?: string | null;
  }>
): ActionableInsight["topOpportunity"] {
  if (items.length === 0) return null;

  const scored = items.map((r) => {
    let score = 0;
    let reason = "";

    const hoursAgo = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 6) { score += 30; reason = "Fresh post"; }
    else if (hoursAgo < 12) { score += 20; reason = "Recent post"; }
    else if (hoursAgo < 24) { score += 10; }

    if (r.leadScore && r.leadScore >= 80) { score += 40; reason = "High buying intent"; }
    else if (r.leadScore && r.leadScore >= 60) { score += 25; reason = reason || "Strong lead signal"; }

    if (r.engagementScore && r.engagementScore >= 50) { score += 20; reason = reason || "Hot discussion"; }
    else if (r.engagementScore && r.engagementScore >= 20) { score += 10; }

    if (r.conversationCategory === "solution_request") { score += 25; reason = reason || "Asking for recommendations"; }
    else if (r.conversationCategory === "advice_request") { score += 15; reason = reason || "Seeking advice"; }

    return { ...r, score, reason: reason || "Good opportunity" };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return { id: top.id, title: top.title, platform: top.platform, sourceUrl: top.sourceUrl, reason: top.reason };
}
