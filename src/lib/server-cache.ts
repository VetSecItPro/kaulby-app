/**
 * Server-side caching utilities using Next.js unstable_cache
 *
 * These functions wrap database queries with caching for improved performance.
 * Cache is automatically invalidated using revalidateTag() when data changes.
 */

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { monitors, results, users } from "@/lib/db/schema";
import { eq, desc, count, and, gte, inArray } from "drizzle-orm";

// Cache tags for invalidation
export const CACHE_TAGS = {
  USER: (userId: string) => `user-${userId}`,
  MONITORS: (userId: string) => `monitors-${userId}`,
  RESULTS: (userId: string) => `results-${userId}`,
  STATS: (userId: string) => `stats-${userId}`,
} as const;

/**
 * Get user data with caching (5 minute TTL)
 */
export const getCachedUser = unstable_cache(
  async (userId: string) => {
    return db.query.users.findFirst({
      where: eq(users.id, userId),
    });
  },
  ["user-data"],
  {
    revalidate: 300, // 5 minutes
    tags: ["users"],
  }
);

/**
 * Get user's monitors with caching (1 minute TTL)
 */
export const getCachedMonitors = unstable_cache(
  async (userId: string) => {
    return db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      orderBy: [desc(monitors.createdAt)],
    });
  },
  ["user-monitors"],
  {
    revalidate: 60, // 1 minute
    tags: ["monitors"],
  }
);

/**
 * Get user's monitor IDs only (lightweight, 1 minute TTL)
 */
export const getCachedMonitorIds = unstable_cache(
  async (userId: string) => {
    return db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });
  },
  ["user-monitor-ids"],
  {
    revalidate: 60,
    tags: ["monitors"],
  }
);

/**
 * Get recent results count for a user (2 minute TTL)
 */
export const getCachedResultsCount = unstable_cache(
  async (userId: string, monitorIds: string[], daysAgo: number = 30) => {
    if (monitorIds.length === 0) return 0;

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    const [result] = await db
      .select({ count: count() })
      .from(results)
      .where(
        and(
          gte(results.createdAt, dateThreshold),
          inArray(results.monitorId, monitorIds)
        )
      );

    return result?.count || 0;
  },
  ["user-results-count"],
  {
    revalidate: 120, // 2 minutes
    tags: ["results"],
  }
);

/**
 * Get results for a monitor with caching (1 minute TTL)
 * Includes pagination support via cursor
 */
export const getCachedResults = unstable_cache(
  async (monitorId: string, limit: number = 20, cursor?: string) => {
    const whereConditions = cursor
      ? and(eq(results.monitorId, monitorId), gte(results.id, cursor))
      : eq(results.monitorId, monitorId);

    return db.query.results.findMany({
      where: whereConditions,
      orderBy: [desc(results.createdAt)],
      limit: limit + 1, // Fetch one extra to determine if there's more
    });
  },
  ["monitor-results"],
  {
    revalidate: 60, // 1 minute
    tags: ["results"],
  }
);

/**
 * Get recent results for a user across all monitors (2 minute TTL)
 */
export const getCachedRecentResults = unstable_cache(
  async (userId: string, limit: number = 50) => {
    // First get user's monitor IDs
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true },
    });

    if (userMonitors.length === 0) return [];

    const monitorIds = userMonitors.map(m => m.id);

    return db.query.results.findMany({
      where: inArray(results.monitorId, monitorIds),
      orderBy: [desc(results.createdAt)],
      limit,
    });
  },
  ["user-recent-results"],
  {
    revalidate: 120, // 2 minutes
    tags: ["results"],
  }
);

/**
 * Get result by ID with caching (5 minute TTL)
 */
export const getCachedResultById = unstable_cache(
  async (resultId: string) => {
    return db.query.results.findFirst({
      where: eq(results.id, resultId),
    });
  },
  ["result-by-id"],
  {
    revalidate: 300, // 5 minutes
    tags: ["results"],
  }
);

/**
 * Get results by sentiment for analytics (5 minute TTL)
 */
export const getCachedResultsBySentiment = unstable_cache(
  async (monitorId: string) => {
    const monitorResults = await db.query.results.findMany({
      where: eq(results.monitorId, monitorId),
      columns: {
        sentiment: true,
        sentimentScore: true,
        createdAt: true,
      },
    });

    // Group by sentiment
    const sentimentCounts = {
      positive: 0,
      negative: 0,
      neutral: 0,
      mixed: 0,
    };

    monitorResults.forEach(r => {
      if (r.sentiment && r.sentiment in sentimentCounts) {
        sentimentCounts[r.sentiment as keyof typeof sentimentCounts]++;
      }
    });

    return {
      counts: sentimentCounts,
      total: monitorResults.length,
      avgScore: monitorResults.length > 0
        ? monitorResults.reduce((sum, r) => sum + (r.sentimentScore || 0), 0) / monitorResults.length
        : 0,
    };
  },
  ["results-by-sentiment"],
  {
    revalidate: 300, // 5 minutes
    tags: ["results"],
  }
);

/**
 * Get dashboard stats with caching (2 minute TTL)
 */
export const getCachedDashboardStats = unstable_cache(
  async (userId: string) => {
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true, isActive: true },
    });

    const monitorIds = userMonitors.map(m => m.id);
    const activeCount = userMonitors.filter(m => m.isActive).length;

    if (monitorIds.length === 0) {
      return {
        totalMonitors: 0,
        activeMonitors: 0,
        totalResults: 0,
        recentResults: 0,
      };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalResults, recentResults] = await Promise.all([
      db.select({ count: count() })
        .from(results)
        .where(inArray(results.monitorId, monitorIds)),
      db.select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, sevenDaysAgo)
          )
        ),
    ]);

    return {
      totalMonitors: userMonitors.length,
      activeMonitors: activeCount,
      totalResults: totalResults[0]?.count || 0,
      recentResults: recentResults[0]?.count || 0,
    };
  },
  ["dashboard-stats"],
  {
    revalidate: 120, // 2 minutes
    tags: ["monitors", "results"],
  }
);
