/**
 * Server-side caching utilities using Next.js unstable_cache
 *
 * These functions wrap database queries with caching for improved performance.
 * Cache is automatically invalidated using revalidateTag() when data changes.
 */

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, desc, count, and, gte, inArray } from "drizzle-orm";

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
