import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiVisibilityChecks, monitors } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) },
        }
      );
    }

    // Get user's monitors to map results
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true, name: true, companyName: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json(emptyVisibilityData());
    }

    const monitorIds = userMonitors.map((m) => m.id);

    // Get the latest visibility checks for this user's monitors
    const checks = await db.query.aiVisibilityChecks.findMany({
      where: inArray(aiVisibilityChecks.monitorId, monitorIds),
      orderBy: desc(aiVisibilityChecks.checkedAt),
      limit: 100, // Last 100 check results (covers ~20 brands x 5 queries)
    });

    if (checks.length === 0) {
      return NextResponse.json(emptyVisibilityData());
    }

    // Group by brand
    const brandMap = new Map<
      string,
      {
        brandName: string;
        monitorId: string;
        monitorName: string;
        queries: Array<{
          query: string;
          mentioned: boolean;
          position: string | null;
          context: string | null;
          competitors: string[];
          model: string;
          checkedAt: string;
        }>;
      }
    >();

    for (const check of checks) {
      const key = `${check.brandName.toLowerCase()}-${check.monitorId ?? "unknown"}`;
      if (!brandMap.has(key)) {
        const monitor = userMonitors.find((m) => m.id === check.monitorId);
        brandMap.set(key, {
          brandName: check.brandName,
          monitorId: check.monitorId ?? "",
          monitorName: monitor?.name ?? check.brandName,
          queries: [],
        });
      }
      brandMap.get(key)!.queries.push({
        query: check.query,
        mentioned: check.mentioned,
        position: check.position,
        context: check.context,
        competitors: (check.competitors as string[]) ?? [],
        model: check.model,
        checkedAt: check.checkedAt.toISOString(),
      });
    }

    // Calculate overall scores per brand
    const brands = Array.from(brandMap.values()).map((brand) => {
      const totalQueries = brand.queries.length;
      const mentionedCount = brand.queries.filter((q) => q.mentioned).length;
      const primaryCount = brand.queries.filter(
        (q) => q.position === "primary"
      ).length;
      const score =
        totalQueries > 0 ? Math.round((mentionedCount / totalQueries) * 100) : 0;

      // Aggregate all competitors across queries
      const competitorCounts = new Map<string, number>();
      for (const q of brand.queries) {
        for (const c of q.competitors) {
          competitorCounts.set(c, (competitorCounts.get(c) || 0) + 1);
        }
      }
      const topCompetitors = Array.from(competitorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return {
        brandName: brand.brandName,
        monitorId: brand.monitorId,
        monitorName: brand.monitorName,
        score,
        totalQueries,
        mentionedCount,
        primaryCount,
        topCompetitors,
        queries: brand.queries,
        lastChecked: brand.queries[0]?.checkedAt ?? null,
      };
    });

    // Overall score across all brands
    const totalMentioned = brands.reduce((s, b) => s + b.mentionedCount, 0);
    const totalQueries = brands.reduce((s, b) => s + b.totalQueries, 0);
    const overallScore =
      totalQueries > 0
        ? Math.round((totalMentioned / totalQueries) * 100)
        : 0;

    const response = NextResponse.json({
      overallScore,
      totalQueries,
      totalMentioned,
      brands,
      lastChecked: checks[0]?.checkedAt.toISOString() ?? null,
    });
    response.headers.set("Cache-Control", "private, max-age=600, stale-while-revalidate=1200");
    return response;
  } catch (error) {
    logger.error("AI visibility API error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to fetch AI visibility data" },
      { status: 500 }
    );
  }
}

function emptyVisibilityData() {
  return {
    overallScore: 0,
    totalQueries: 0,
    totalMentioned: 0,
    brands: [],
    lastChecked: null,
  };
}
