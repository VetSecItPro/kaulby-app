/**
 * Shared query functions for the observability admin pages.
 *
 * Each query is wrapped in a `safe<Query>()` helper at the call site so a
 * failure in one query doesn't break the page. See `_safe.ts`.
 *
 * All queries are hot — they aggregate raw aiLogs/results/monitors. Phase 6
 * trend charts read from the daily_metrics rollup instead.
 */

import { db } from "@/lib/db";
import { aiLogs, monitors, results, users } from "@/lib/db/schema";
import { and, count, desc, eq, gte, isNotNull, sql, sum } from "drizzle-orm";

/**
 * Effective scan cadence per (tier, platform) for the last 7 days.
 * Computed as the average gap between consecutive `results.created_at` per
 * monitor, then aggregated across monitors of the same tier+platform.
 */
export async function getCadenceHealth(): Promise<
  Array<{ tier: string; platform: string; avgGapMin: number; sampleSize: number }>
> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db.execute<{
    tier: string;
    platform: string;
    avg_gap_min: number;
    sample_size: number;
  }>(sql`
    WITH scan_intervals AS (
      SELECT
        r.platform AS platform,
        u.subscription_status AS tier,
        EXTRACT(
          EPOCH FROM (
            r.created_at - LAG(r.created_at) OVER (
              PARTITION BY r.monitor_id ORDER BY r.created_at
            )
          )
        ) / 60.0 AS gap_min
      FROM results r
      JOIN monitors m ON m.id = r.monitor_id
      JOIN users u ON u.id = m.user_id
      WHERE r.created_at > ${sevenDaysAgo}
    )
    SELECT
      tier,
      platform,
      AVG(gap_min) FILTER (WHERE gap_min IS NOT NULL) AS avg_gap_min,
      COUNT(*) FILTER (WHERE gap_min IS NOT NULL) AS sample_size
    FROM scan_intervals
    GROUP BY tier, platform
    HAVING COUNT(*) >= 3
    ORDER BY tier, platform
  `);

  return rows.rows.map((r) => ({
    tier: String(r.tier ?? "unknown"),
    platform: String(r.platform),
    avgGapMin: Number(r.avg_gap_min ?? 0),
    sampleSize: Number(r.sample_size ?? 0),
  }));
}

export async function getAiCostByTier(): Promise<
  Array<{ tier: string; totalCostUsd: number; calls: number }>
> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db
    .select({
      tier: users.subscriptionStatus,
      totalCostUsd: sum(aiLogs.costUsd),
      calls: count(),
    })
    .from(aiLogs)
    .leftJoin(users, eq(users.id, aiLogs.userId))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(users.subscriptionStatus)
    .orderBy(desc(sum(aiLogs.costUsd)));

  return rows.map((r) => ({
    tier: r.tier ?? "unknown",
    totalCostUsd: Number(r.totalCostUsd ?? 0),
    calls: Number(r.calls ?? 0),
  }));
}

export async function getScanVolumeByTier(): Promise<
  Array<{ tier: string; platform: string; scans: number }>
> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db
    .select({
      tier: users.subscriptionStatus,
      platform: results.platform,
      scans: count(),
    })
    .from(results)
    .innerJoin(monitors, eq(monitors.id, results.monitorId))
    .leftJoin(users, eq(users.id, monitors.userId))
    .where(gte(results.createdAt, sevenDaysAgo))
    .groupBy(users.subscriptionStatus, results.platform)
    .orderBy(users.subscriptionStatus, results.platform);

  return rows.map((r) => ({
    tier: r.tier ?? "unknown",
    platform: String(r.platform),
    scans: Number(r.scans),
  }));
}

export async function getRecentFailures(): Promise<
  Array<{
    monitorId: string;
    name: string;
    email: string | null;
    failedAt: Date;
    reason: string | null;
  }>
> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      monitorId: monitors.id,
      name: monitors.name,
      email: users.email,
      failedAt: monitors.lastCheckFailedAt,
      reason: monitors.lastCheckFailedReason,
    })
    .from(monitors)
    .leftJoin(users, eq(users.id, monitors.userId))
    .where(
      and(
        isNotNull(monitors.lastCheckFailedAt),
        gte(monitors.lastCheckFailedAt, oneDayAgo),
      ),
    )
    .orderBy(desc(monitors.lastCheckFailedAt))
    .limit(50);

  return rows.map((r) => ({
    monitorId: r.monitorId,
    name: r.name,
    email: r.email,
    failedAt: r.failedAt as Date,
    reason: r.reason,
  }));
}

export async function getVendorHealth(): Promise<
  Array<{ vendor: string; metric: string; value: number | null; metadata: unknown; recordedAt: Date }>
> {
  const rows = await db.execute<{
    vendor: string;
    metric: string;
    value: number | null;
    metadata: unknown;
    recorded_at: Date;
  }>(sql`
    SELECT DISTINCT ON (vendor, metric)
      vendor, metric, value, metadata, recorded_at
    FROM vendor_metrics
    WHERE recorded_at > NOW() - INTERVAL '6 hours'
    ORDER BY vendor, metric, recorded_at DESC
  `);

  return rows.rows.map((r) => ({
    vendor: String(r.vendor),
    metric: String(r.metric),
    value: r.value != null ? Number(r.value) : null,
    metadata: r.metadata,
    recordedAt: r.recorded_at as Date,
  }));
}

/**
 * Wraps a query with a try/catch that returns an empty array on failure.
 * Per-tile error isolation: one bad query shouldn't break the page.
 */
export async function safe<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[observability] ${label} failed`, e);
    return [];
  }
}
