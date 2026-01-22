import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, monitors, results } from "@/lib/db";
import { eq, desc, gte } from "drizzle-orm";
import { DiscoverView } from "@/components/dashboard/discover-view";
import { getUserPlan } from "@/lib/limits";

/**
 * Get user's current platforms and keywords for context-aware suggestions
 */
async function getUserContext(userId: string) {
  // Get all user's monitors
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: {
      id: true,
      keywords: true,
      platforms: true,
    },
  });

  // Extract unique platforms and keywords
  const platforms = new Set<string>();
  const keywords = new Set<string>();

  userMonitors.forEach((monitor) => {
    monitor.platforms?.forEach((p) => platforms.add(p));
    monitor.keywords?.forEach((k) => keywords.add(k));
  });

  return {
    activePlatforms: Array.from(platforms),
    keywords: Array.from(keywords),
    monitorCount: userMonitors.length,
  };
}

/**
 * Get trending topics across all platforms (global, not user-specific)
 */
async function getTrendingTopics() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get recent results with high engagement
  const trendingResults = await db.query.results.findMany({
    where: gte(results.createdAt, sevenDaysAgo),
    orderBy: [desc(results.engagementScore)],
    limit: 100,
    columns: {
      id: true,
      title: true,
      platform: true,
      engagementScore: true,
      conversationCategory: true,
      sentiment: true,
    },
  });

  // Group by platform and extract common themes
  const platformTrends: Record<string, { count: number; topTopics: string[] }> = {};

  trendingResults.forEach((result) => {
    if (!platformTrends[result.platform]) {
      platformTrends[result.platform] = { count: 0, topTopics: [] };
    }
    platformTrends[result.platform].count++;
    if (result.conversationCategory) {
      platformTrends[result.platform].topTopics.push(result.conversationCategory);
    }
  });

  // Calculate what's hot
  const hotTopics = trendingResults
    .filter((r) => r.engagementScore && r.engagementScore > 50)
    .slice(0, 10)
    .map((r) => ({
      title: r.title,
      platform: r.platform,
      engagement: r.engagementScore || 0,
      category: r.conversationCategory,
    }));

  return {
    platformActivity: platformTrends,
    hotTopics,
    totalTrending: trendingResults.length,
  };
}

export default async function DiscoverPage() {
  const { userId } = await auth();

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV;

  if (!userId && isProduction) {
    redirect("/sign-in");
  }

  // Get user context and plan
  const [userContext, userPlan, trendingData] = userId
    ? await Promise.all([
        getUserContext(userId),
        getUserPlan(userId),
        getTrendingTopics(),
      ])
    : [
        { activePlatforms: [], keywords: [], monitorCount: 0 },
        "free" as const,
        { platformActivity: {}, hotTopics: [], totalTrending: 0 },
      ];

  const isPro = userPlan === "pro" || userPlan === "enterprise";

  return (
    <DiscoverView
      activePlatforms={userContext.activePlatforms}
      keywords={userContext.keywords}
      monitorCount={userContext.monitorCount}
      isPro={isPro}
      trendingData={trendingData}
    />
  );
}
