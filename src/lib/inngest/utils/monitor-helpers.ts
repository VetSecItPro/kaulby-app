/**
 * Shared utilities for monitor cron functions.
 *
 * Extracts the ~80% identical boilerplate from 16 platform monitor files
 * into reusable helper functions. Platform files only need to implement:
 * 1. Content fetching (platform-specific API calls)
 * 2. Content filtering/matching
 * 3. Result field mapping (sourceUrl, title, content, metadata)
 */

import { pooledDb } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  incrementResultsCount,
  prefetchUserPlans,
  canAccessPlatformWithPlan,
  shouldProcessMonitorWithPlan,
} from "@/lib/limits";
import type { PlanKey, Platform } from "@/lib/plans";
import {
  calculateStaggerDelay,
  formatStaggerDuration,
  addJitter,
  getStaggerWindow,
} from "./stagger";
import { isMonitorScheduleActive } from "@/lib/monitor-schedule";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";
import { inngest } from "../client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Inngest step interface for helper functions */
export interface MonitorStep {
  run<T>(id: string, callback: () => Promise<T>): Promise<T>;
  sleep(id: string, duration: string): Promise<void>;
}

/** Monitor row type from database (dates may be serialized as strings after step.run) */
export type MonitorRow = NonNullable<
  Awaited<ReturnType<typeof pooledDb.query.monitors.findFirst>>
>;

/** Type for result insert values */
export type ResultInsertValues = typeof results.$inferInsert;

// ---------------------------------------------------------------------------
// Initialization Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all active monitors for a specific platform.
 */
export async function getActiveMonitors(
  platform: string,
  step: MonitorStep
): Promise<MonitorRow[]> {
  return step.run("get-monitors", async () => {
    return pooledDb.query.monitors.findMany({
      where: and(
        eq(monitors.isActive, true),
        sql`${platform} = ANY(${monitors.platforms})`
      ),
    });
  });
}

/**
 * Pre-fetch user plans for a list of monitors.
 * Returns a serialized map of userId -> planKey.
 */
export async function prefetchPlans(
  monitorList: { userId: string }[],
  step: MonitorStep
): Promise<Record<string, string>> {
  return step.run("prefetch-plans", async () => {
    const userIds = monitorList.map((m) => m.userId);
    const map = await prefetchUserPlans(userIds);
    return Object.fromEntries(map);
  });
}

/**
 * Get the user's plan from the pre-fetched plan map.
 */
export function getPlan(
  userId: string,
  planMap: Record<string, string>
): PlanKey {
  return (planMap[userId] ?? "free") as PlanKey;
}

// ---------------------------------------------------------------------------
// Per-Monitor Loop Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a monitor should be skipped (plan access, refresh delay, schedule).
 * Returns true if the monitor should be SKIPPED.
 */
export function shouldSkipMonitor(
  monitor: MonitorRow,
  planMap: Record<string, string>,
  platform: Platform
): boolean {
  const plan = getPlan(monitor.userId, planMap);
  if (!canAccessPlatformWithPlan(plan, platform)) return true;
  if (
    !shouldProcessMonitorWithPlan(
      plan,
      monitor.lastCheckedAt as Date | null
    )
  )
    return true;
  if (!isMonitorScheduleActive(monitor)) return true;
  return false;
}

/**
 * Apply stagger delay between monitors to prevent thundering herd.
 */
export async function applyStagger(
  index: number,
  total: number,
  platform: string,
  monitorId: string,
  step: MonitorStep
): Promise<void> {
  if (index > 0 && total > 3) {
    const staggerWindow = getStaggerWindow(
      platform as Parameters<typeof getStaggerWindow>[0]
    );
    const baseDelay = calculateStaggerDelay(index, total, staggerWindow);
    const delayWithJitter = addJitter(baseDelay, 10);
    const delayStr = formatStaggerDuration(delayWithJitter);
    await step.sleep(`stagger-${monitorId}`, delayStr);
  }
}

// ---------------------------------------------------------------------------
// Result Persistence Helpers
// ---------------------------------------------------------------------------

/**
 * Batch duplicate-check, insert new results, and increment usage.
 * Returns the count and IDs of newly inserted results.
 *
 * @param items - Raw items to process
 * @param monitorId - Monitor ID for step naming
 * @param userId - User ID for usage tracking
 * @param getSourceUrl - Extract source URL from item (for dedup)
 * @param mapToResult - Map item to database insert values
 * @param step - Inngest step tools
 * @param stepSuffix - Optional suffix for step name (e.g., subreddit name for Reddit)
 */
export async function saveNewResults<T>(params: {
  items: T[];
  monitorId: string;
  userId: string;
  getSourceUrl: (item: T) => string;
  mapToResult: (item: T) => ResultInsertValues;
  step: MonitorStep;
  stepSuffix?: string;
}): Promise<{ count: number; ids: string[] }> {
  const {
    items,
    monitorId,
    userId,
    getSourceUrl,
    mapToResult,
    step,
    stepSuffix,
  } = params;

  if (items.length === 0) return { count: 0, ids: [] };

  return step.run(
    `save-results-${monitorId}${stepSuffix ? `-${stepSuffix}` : ""}`,
    async () => {
      // Batch check for existing results
      const urls = items.map(getSourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map((r) => r.sourceUrl));

      // Filter to only new items
      const newItems = items.filter(
        (item) => !existingUrls.has(getSourceUrl(item))
      );

      if (newItems.length === 0) return { ids: [] as string[], count: 0 };

      // Batch insert
      const inserted = await pooledDb
        .insert(results)
        .values(newItems.map(mapToResult))
        .returning({ id: results.id });

      // Increment usage
      await incrementResultsCount(userId, inserted.length);

      return { ids: inserted.map((r) => r.id), count: inserted.length };
    }
  );
}

// ---------------------------------------------------------------------------
// Post-Save Helpers
// ---------------------------------------------------------------------------

/**
 * Trigger AI analysis for new results.
 * Uses batch mode for large volumes, individual for small.
 */
export async function triggerAiAnalysis(
  newResultIds: string[],
  monitorId: string,
  userId: string,
  platform: string,
  step: MonitorStep
): Promise<void> {
  if (newResultIds.length === 0) return;

  await step.run(`trigger-analysis-${monitorId}`, async () => {
    if (newResultIds.length > AI_BATCH_CONFIG.BATCH_THRESHOLD) {
      await inngest.send({
        name: "content/analyze-batch",
        data: {
          monitorId,
          userId,
          platform,
          resultIds: newResultIds,
          totalCount: newResultIds.length,
        },
      });
    } else {
      await inngest.send(
        newResultIds.map((resultId) => ({
          name: "content/analyze" as const,
          data: { resultId, userId },
        }))
      );
    }
  });
}

/**
 * Update monitor's lastCheckedAt and newMatchCount.
 */
export async function updateMonitorStats(
  monitorId: string,
  matchCount: number,
  step: MonitorStep
): Promise<void> {
  await step.run(`update-monitor-stats-${monitorId}`, async () => {
    await pooledDb
      .update(monitors)
      .set({
        lastCheckedAt: new Date(),
        newMatchCount: matchCount,
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, monitorId));
  });
}
