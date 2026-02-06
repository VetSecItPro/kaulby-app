import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, sql, count } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await getEffectiveUserId();

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

    // Base filter condition
    const baseWhere = and(
      inArray(results.monitorId, monitorIds),
      gte(results.createdAt, startDate)
    );

    // Run all aggregation queries in parallel via SQL GROUP BY
    const [volumeRows, sentimentRows, categoryRows, platformRows, totalsRow] = await Promise.all([
      // Volume by day
      db
        .select({
          day: sql<string>`DATE(${results.createdAt})`.as("day"),
          count: count().as("count"),
        })
        .from(results)
        .where(baseWhere)
        .groupBy(sql`DATE(${results.createdAt})`)
        .orderBy(sql`DATE(${results.createdAt})`),

      // Sentiment by day
      db
        .select({
          day: sql<string>`DATE(${results.createdAt})`.as("day"),
          sentiment: results.sentiment,
          count: count().as("count"),
        })
        .from(results)
        .where(baseWhere)
        .groupBy(sql`DATE(${results.createdAt})`, results.sentiment)
        .orderBy(sql`DATE(${results.createdAt})`),

      // Category breakdown
      db
        .select({
          category: sql<string>`COALESCE(${results.conversationCategory}::text, 'uncategorized')`.as("category"),
          count: count().as("count"),
        })
        .from(results)
        .where(baseWhere)
        .groupBy(sql`COALESCE(${results.conversationCategory}::text, 'uncategorized')`)
        .orderBy(sql`count(*) DESC`),

      // Platform breakdown
      db
        .select({
          platform: results.platform,
          count: count().as("count"),
        })
        .from(results)
        .where(baseWhere)
        .groupBy(results.platform)
        .orderBy(sql`count(*) DESC`),

      // Totals with sentiment counts
      db
        .select({
          total: count().as("total"),
          positive: sql<number>`SUM(CASE WHEN ${results.sentiment} = 'positive' THEN 1 ELSE 0 END)`.as("positive"),
          negative: sql<number>`SUM(CASE WHEN ${results.sentiment} = 'negative' THEN 1 ELSE 0 END)`.as("negative"),
        })
        .from(results)
        .where(baseWhere),
    ]);

    // Build volume lookup from SQL results
    const volumeByDay = new Map<string, number>();
    for (const row of volumeRows) {
      volumeByDay.set(row.day, row.count);
    }

    // Build sentiment lookup from SQL results
    const sentimentByDay = new Map<string, { positive: number; negative: number; neutral: number }>();
    for (const row of sentimentRows) {
      if (!sentimentByDay.has(row.day)) {
        sentimentByDay.set(row.day, { positive: 0, negative: 0, neutral: 0 });
      }
      const daySentiment = sentimentByDay.get(row.day)!;
      if (row.sentiment === "positive") daySentiment.positive = row.count;
      else if (row.sentiment === "negative") daySentiment.negative = row.count;
      else daySentiment.neutral = row.count;
    }

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

    // Format breakdowns
    const categoryBreakdown = categoryRows.map((row) => ({
      category: row.category,
      count: row.count,
    }));

    const platformBreakdown = platformRows.map((row) => ({
      platform: row.platform,
      count: row.count,
    }));

    // Calculate totals
    const total = totalsRow[0]?.total || 0;
    const positiveCount = totalsRow[0]?.positive || 0;
    const negativeCount = totalsRow[0]?.negative || 0;
    const neutralCount = total - positiveCount - negativeCount;

    const totals = {
      mentions: total,
      positivePercent: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
      negativePercent: total > 0 ? Math.round((negativeCount / total) * 100) : 0,
      neutralPercent: total > 0 ? Math.round((neutralCount / total) * 100) : 0,
      topPlatform: platformBreakdown[0]?.platform || null,
      topCategory: categoryBreakdown[0]?.category || null,
    };

    const response = NextResponse.json({
      volumeOverTime,
      sentimentOverTime,
      categoryBreakdown,
      platformBreakdown,
      totals,
    });
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return response;
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
