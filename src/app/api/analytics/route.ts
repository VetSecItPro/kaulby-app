import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get time range from query params (default: 30 days)
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    // Calculate start date based on range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get user's monitor IDs
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json({
        volumeOverTime: [],
        sentimentOverTime: [],
        categoryBreakdown: [],
        platformBreakdown: [],
        totals: {
          mentions: 0,
          positivePercent: 0,
          negativePercent: 0,
          neutralPercent: 0,
          topPlatform: null,
          topCategory: null,
        },
      });
    }

    const monitorIds = userMonitors.map((m) => m.id);

    // Fetch results within date range
    const userResults = await db.query.results.findMany({
      where: and(
        inArray(results.monitorId, monitorIds),
        gte(results.createdAt, startDate)
      ),
      columns: {
        id: true,
        platform: true,
        sentiment: true,
        conversationCategory: true,
        createdAt: true,
      },
    });

    // Calculate volume over time (group by day)
    const volumeByDay = new Map<string, number>();
    const sentimentByDay = new Map<string, { positive: number; negative: number; neutral: number }>();

    userResults.forEach((result) => {
      const day = result.createdAt.toISOString().split("T")[0];

      // Volume
      volumeByDay.set(day, (volumeByDay.get(day) || 0) + 1);

      // Sentiment
      if (!sentimentByDay.has(day)) {
        sentimentByDay.set(day, { positive: 0, negative: 0, neutral: 0 });
      }
      const daySentiment = sentimentByDay.get(day)!;
      if (result.sentiment === "positive") daySentiment.positive++;
      else if (result.sentiment === "negative") daySentiment.negative++;
      else daySentiment.neutral++;
    });

    // Fill in missing days with zeros
    const volumeOverTime: { date: string; count: number }[] = [];
    const sentimentOverTime: { date: string; positive: number; negative: number; neutral: number }[] = [];

    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const day = currentDate.toISOString().split("T")[0];
      volumeOverTime.push({
        date: day,
        count: volumeByDay.get(day) || 0,
      });
      sentimentOverTime.push({
        date: day,
        positive: sentimentByDay.get(day)?.positive || 0,
        negative: sentimentByDay.get(day)?.negative || 0,
        neutral: sentimentByDay.get(day)?.neutral || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Category breakdown
    const categoryCount = new Map<string, number>();
    userResults.forEach((result) => {
      const category = result.conversationCategory || "uncategorized";
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    });

    const categoryBreakdown = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Platform breakdown
    const platformCount = new Map<string, number>();
    userResults.forEach((result) => {
      platformCount.set(result.platform, (platformCount.get(result.platform) || 0) + 1);
    });

    const platformBreakdown = Array.from(platformCount.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate totals
    const total = userResults.length;
    const positiveCount = userResults.filter((r) => r.sentiment === "positive").length;
    const negativeCount = userResults.filter((r) => r.sentiment === "negative").length;
    const neutralCount = total - positiveCount - negativeCount;

    const totals = {
      mentions: total,
      positivePercent: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
      negativePercent: total > 0 ? Math.round((negativeCount / total) * 100) : 0,
      neutralPercent: total > 0 ? Math.round((neutralCount / total) * 100) : 0,
      topPlatform: platformBreakdown[0]?.platform || null,
      topCategory: categoryBreakdown[0]?.category || null,
    };

    return NextResponse.json({
      volumeOverTime,
      sentimentOverTime,
      categoryBreakdown,
      platformBreakdown,
      totals,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
