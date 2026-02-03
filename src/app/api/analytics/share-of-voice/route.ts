import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, monitors, results } from "@/lib/db";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import { getUserPlan } from "@/lib/limits";

interface BrandData {
  name: string;
  mentions: number;
  previousMentions: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has Team tier (enterprise feature)
    const plan = await getUserPlan(userId);
    if (plan !== "enterprise") {
      return NextResponse.json(
        { error: "Share of Voice requires Team subscription" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");

    const currentPeriodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(Date.now() - (days * 2) * 24 * 60 * 60 * 1000);
    const previousPeriodEnd = currentPeriodStart;

    // Get user's monitors with company names
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: {
        id: true,
        name: true,
        companyName: true,
        keywords: true,
      },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json({
        yourBrand: null,
        competitors: [],
        period: `Last ${days} days`,
      });
    }

    const monitorIds = userMonitors.map((m) => m.id);

    // Get mention counts for current period by monitor
    const currentMentions = await db
      .select({
        monitorId: results.monitorId,
        total: sql<number>`count(*)`,
        positive: sql<number>`count(*) filter (where ${results.sentiment} = 'positive')`,
        neutral: sql<number>`count(*) filter (where ${results.sentiment} = 'neutral')`,
        negative: sql<number>`count(*) filter (where ${results.sentiment} = 'negative')`,
      })
      .from(results)
      .where(
        and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, currentPeriodStart)
        )
      )
      .groupBy(results.monitorId);

    // Get mention counts for previous period by monitor
    const previousMentions = await db
      .select({
        monitorId: results.monitorId,
        total: sql<number>`count(*)`,
      })
      .from(results)
      .where(
        and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, previousPeriodStart),
          sql`${results.createdAt} < ${previousPeriodEnd}`
        )
      )
      .groupBy(results.monitorId);

    // Build brand data map
    const brandDataMap = new Map<string, BrandData>();

    userMonitors.forEach((monitor) => {
      // Use companyName or first keyword or monitor name as brand name
      const brandName = monitor.companyName || monitor.keywords?.[0] || monitor.name;

      const current = currentMentions.find((m) => m.monitorId === monitor.id);
      const previous = previousMentions.find((m) => m.monitorId === monitor.id);

      // Aggregate by brand name (in case multiple monitors track same brand)
      const existing = brandDataMap.get(brandName);
      if (existing) {
        existing.mentions += Number(current?.total || 0);
        existing.previousMentions += Number(previous?.total || 0);
        existing.sentiment.positive += Number(current?.positive || 0);
        existing.sentiment.neutral += Number(current?.neutral || 0);
        existing.sentiment.negative += Number(current?.negative || 0);
      } else {
        brandDataMap.set(brandName, {
          name: brandName,
          mentions: Number(current?.total || 0),
          previousMentions: Number(previous?.total || 0),
          sentiment: {
            positive: Number(current?.positive || 0),
            neutral: Number(current?.neutral || 0),
            negative: Number(current?.negative || 0),
          },
        });
      }
    });

    // Convert to array and sort by mentions
    const brands = Array.from(brandDataMap.values()).sort(
      (a, b) => b.mentions - a.mentions
    );

    // First brand is assumed to be "your brand", rest are competitors
    // In a more sophisticated setup, you'd have explicit "your brand" vs "competitor" flags
    const [yourBrand, ...competitors] = brands;

    // FIX-214: Add cache headers to response
    const response = NextResponse.json({
      yourBrand: yourBrand || null,
      competitors,
      period: `Last ${days} days`,
      totalMentions: brands.reduce((sum, b) => sum + b.mentions, 0),
    });
    response.headers.set("Cache-Control", "private, max-age=300");
    return response;
  } catch (error) {
    console.error("Share of Voice error:", error);
    return NextResponse.json(
      { error: "Failed to calculate share of voice" },
      { status: 500 }
    );
  }
}
