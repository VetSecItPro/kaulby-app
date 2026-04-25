/**
 * Daily cron: roll up yesterday's raw observability data into daily_metrics.
 *
 * Why: trend charts (Phase 6) shouldn't aggregate aiLogs/results/vendor_metrics
 * on every render — that's slow and gets slower as data grows. This cron writes
 * one row per (date, metric_key, dimensions) so charts read with a single
 * index scan.
 *
 * Cadence: 00:05 America/Chicago daily — runs ~5 min after midnight CT to
 * roll up the calendar day that just ended.
 *
 * Idempotency: ON CONFLICT DO UPDATE on the unique index (date, metric_key,
 * dimensions). Re-running the cron for the same date overwrites the previous
 * rollup safely — useful if the cron fails partway and we manually retrigger.
 *
 * Source tables:
 * - aiLogs       → ai_cost_usd per (tier, model, analysisType)
 * - results      → scan_count per (tier, platform)
 * - vendor_metrics → vendor_value_max/avg per (vendor, metric)
 */

import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb } from "@/lib/db";
import { aiLogs, results, monitors, users, vendorMetrics, dailyMetrics } from "@/lib/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";

interface RollupRow {
  metricKey: string;
  dimensions: Record<string, unknown>;
  value: number;
  metadata?: Record<string, unknown> | null;
}

/**
 * Compute the (start, end, label) for "yesterday in Central Time".
 * Returns the day's start/end as UTC Date objects + the YYYY-MM-DD label
 * for the daily_metrics.date column.
 */
function getYesterdayCT(): { start: Date; end: Date; dateLabel: string } {
  // Compute "now in CT" by formatting; subtract 1 day; floor to midnight CT.
  const now = new Date();
  const ctNowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => ctNowParts.find((p) => p.type === t)?.value ?? "00";
  const ctYear = Number(get("year"));
  const ctMonth = Number(get("month"));
  const ctDay = Number(get("day"));
  // "yesterday in CT" — subtract one day from today CT, then build midnight CT
  // as a UTC Date. We construct it via a known-offset string and let JS parse.
  const todayCt = new Date(`${ctYear}-${String(ctMonth).padStart(2, "0")}-${String(ctDay).padStart(2, "0")}T00:00:00`);
  // Note: the above parses as local-time relative to the server. We instead
  // compute boundaries via offset-aware math below.
  // Build YYYY-MM-DD for yesterday CT:
  const yesterdayCt = new Date(todayCt.getTime() - 24 * 60 * 60 * 1000);
  const y = yesterdayCt.getFullYear();
  const m = String(yesterdayCt.getMonth() + 1).padStart(2, "0");
  const d = String(yesterdayCt.getDate()).padStart(2, "0");
  const dateLabel = `${y}-${m}-${d}`;
  // Convert "midnight CT yesterday" and "midnight CT today" into UTC. CT is
  // UTC-5 (CDT) or UTC-6 (CST). Use Intl to figure the offset on that date.
  const offsetMs = getCtOffsetMs(yesterdayCt);
  const start = new Date(yesterdayCt.getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateLabel };
}

/**
 * Returns CT's UTC offset for the given local-CT date, in milliseconds.
 * CDT is -5h (-18000000), CST is -6h (-21600000). We probe via Intl.
 */
function getCtOffsetMs(localDate: Date): number {
  const utcMs = Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    0, 0, 0,
  );
  // Format that UTC instant as CT and read the resulting hour to derive offset.
  const ctHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(utcMs)),
  );
  // If CT shows "18:00" for UTC 00:00, offset is -6h (CST). If "19:00", -5h (CDT).
  // Inverse: offsetHours = ctHour - 24 (when ctHour > 12).
  const offsetHours = ctHour > 12 ? ctHour - 24 : -ctHour;
  return offsetHours * 60 * 60 * 1000;
}

/**
 * Roll up aiLogs spend grouped by tier (subscriptionStatus).
 */
async function rollupAiCostByTier(start: Date, end: Date): Promise<RollupRow[]> {
  const rows = await pooledDb
    .select({
      tier: users.subscriptionStatus,
      totalCost: sql<number>`COALESCE(SUM(${aiLogs.costUsd}), 0)`,
      callCount: sql<number>`COUNT(*)`,
    })
    .from(aiLogs)
    .leftJoin(users, eq(aiLogs.userId, users.id))
    .where(and(gte(aiLogs.createdAt, start), lt(aiLogs.createdAt, end)))
    .groupBy(users.subscriptionStatus);

  return rows.map((r) => ({
    metricKey: "ai_cost_usd",
    dimensions: { tier: r.tier ?? "unknown" },
    value: Number(r.totalCost ?? 0),
    metadata: { callCount: Number(r.callCount ?? 0) },
  }));
}

/**
 * Roll up scan results grouped by tier x platform.
 */
async function rollupScanVolumeByTierPlatform(start: Date, end: Date): Promise<RollupRow[]> {
  const rows = await pooledDb
    .select({
      tier: users.subscriptionStatus,
      platform: results.platform,
      scanCount: sql<number>`COUNT(*)`,
    })
    .from(results)
    .leftJoin(monitors, eq(results.monitorId, monitors.id))
    .leftJoin(users, eq(monitors.userId, users.id))
    .where(and(gte(results.createdAt, start), lt(results.createdAt, end)))
    .groupBy(users.subscriptionStatus, results.platform);

  return rows.map((r) => ({
    metricKey: "scan_count",
    dimensions: { tier: r.tier ?? "unknown", platform: r.platform ?? "unknown" },
    value: Number(r.scanCount ?? 0),
    metadata: null,
  }));
}

/**
 * Roll up vendor_metrics — for each (vendor, metric) take max + avg over the day.
 * Useful for "peak Apify usage" or "average OpenRouter remaining credit" charts.
 */
async function rollupVendorMetricsDaily(start: Date, end: Date): Promise<RollupRow[]> {
  const rows = await pooledDb
    .select({
      vendor: vendorMetrics.vendor,
      metric: vendorMetrics.metric,
      maxValue: sql<number>`MAX(${vendorMetrics.value})`,
      avgValue: sql<number>`AVG(${vendorMetrics.value})`,
      sampleCount: sql<number>`COUNT(*)`,
    })
    .from(vendorMetrics)
    .where(and(gte(vendorMetrics.recordedAt, start), lt(vendorMetrics.recordedAt, end)))
    .groupBy(vendorMetrics.vendor, vendorMetrics.metric);

  const out: RollupRow[] = [];
  for (const r of rows) {
    if (r.maxValue != null) {
      out.push({
        metricKey: "vendor_value_max",
        dimensions: { vendor: r.vendor, metric: r.metric },
        value: Number(r.maxValue),
        metadata: { sampleCount: Number(r.sampleCount ?? 0) },
      });
    }
    if (r.avgValue != null) {
      out.push({
        metricKey: "vendor_value_avg",
        dimensions: { vendor: r.vendor, metric: r.metric },
        value: Number(r.avgValue),
        metadata: { sampleCount: Number(r.sampleCount ?? 0) },
      });
    }
  }
  return out;
}

export const snapshotDailyMetrics = inngest.createFunction(
  {
    id: "snapshot-daily-metrics",
    name: "Snapshot Daily Metrics",
    retries: 2,
    timeouts: { finish: "10m" },
    concurrency: { limit: 1 },
  },
  // 00:05 America/Chicago — Inngest supports TZ= prefix for cron expressions.
  { cron: "TZ=America/Chicago 5 0 * * *" },
  async ({ step }) => {
    // Pure clock math — compute inline rather than wrapping in step.run.
    // Inngest steps serialize returns through JSON, which would coerce Date → string.
    const { start, end, dateLabel } = getYesterdayCT();

    const [aiCost, scanVolume, vendorRollup] = await Promise.all([
      step.run("rollup-ai-cost", () => rollupAiCostByTier(start, end)),
      step.run("rollup-scan-volume", () => rollupScanVolumeByTierPlatform(start, end)),
      step.run("rollup-vendor-metrics", () => rollupVendorMetricsDaily(start, end)),
    ]);

    const allRows = [...aiCost, ...scanVolume, ...vendorRollup];
    if (allRows.length === 0) {
      logger.info("[snapshot-daily-metrics] no data for window", { dateLabel });
      return { dateLabel, inserted: 0 };
    }

    await step.run("upsert-daily-metrics", async () => {
      // Single batch upsert — ON CONFLICT keys are (date, metric_key, dimensions).
      await pooledDb
        .insert(dailyMetrics)
        .values(
          allRows.map((r) => ({
            date: dateLabel,
            metricKey: r.metricKey,
            dimensions: r.dimensions,
            value: r.value,
            metadata: r.metadata ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: [dailyMetrics.date, dailyMetrics.metricKey, dailyMetrics.dimensions],
          set: {
            value: sql`EXCLUDED.value`,
            metadata: sql`EXCLUDED.metadata`,
            computedAt: sql`NOW()`,
          },
        });
    });

    return {
      dateLabel,
      inserted: allRows.length,
      aiCostRows: aiCost.length,
      scanVolumeRows: scanVolume.length,
      vendorRollupRows: vendorRollup.length,
    };
  },
);
