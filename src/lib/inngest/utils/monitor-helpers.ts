/**
 * Shared utilities for monitor cron functions.
 *
 * Extracts the ~80% identical boilerplate from 17 platform monitor files
 * into reusable helper functions. Platform files only need to implement:
 * 1. Content fetching (platform-specific API calls)
 * 2. Content filtering/matching
 * 3. Result field mapping (sourceUrl, title, content, metadata)
 */

import { pooledDb } from "@/lib/db";
import { monitors, results, monitorResults } from "@/lib/db/schema";
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
import { track } from "@/lib/analytics";

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
 * Fast global check: does the system have ANY active monitors?
 * Use as first gate in cron functions to skip entirely when idle.
 */
export async function hasAnyActiveMonitors(
  step: MonitorStep
): Promise<boolean> {
  return step.run("check-any-active", async () => {
    const row = await pooledDb.query.monitors.findFirst({
      where: eq(monitors.isActive, true),
      columns: { id: true },
    });
    return !!row;
  });
}

/**
 * Fetch all active monitors for a specific platform.
 */
export async function getActiveMonitors(
  platform: string,
  step: MonitorStep
): Promise<MonitorRow[]> {
  return step.run("get-monitors", async () => {
    // DB: Safety limit on monitor scan — FIX-103
    return pooledDb.query.monitors.findMany({
      where: and(
        eq(monitors.isActive, true),
        sql`${platform} = ANY(${monitors.platforms})`
      ),
      limit: 1000,
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
 * Update lastCheckedAt for a skipped monitor so the dashboard doesn't show stale times.
 */
export async function updateSkippedMonitor(
  monitorId: string,
  step: MonitorStep
): Promise<void> {
  await step.run(`update-skipped-${monitorId}`, async () => {
    await pooledDb
      .update(monitors)
      .set({ lastCheckedAt: new Date() })
      .where(eq(monitors.id, monitorId));
  });
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
 * Task 2.1 Phase A — cross-monitor dedup.
 *
 * Batch duplicate-check, insert new results, and increment usage. Returns the
 * count and IDs of results that are NEW for this monitor (the caller uses this
 * list to trigger AI analysis). A result is "new for this monitor" when the
 * `monitor_results` link row didn't exist before this call.
 *
 * Dedup scope is `(userId, sourceUrl)` across ALL of the user's monitors (not
 * just the calling monitor). If another monitor owned by the same user already
 * saved+analyzed the same URL:
 *   - we reuse the existing `results` row (no new `results` insert, no new AI
 *     call, no usage increment for that row),
 *   - we still insert a `monitor_results` link for the calling monitor so it
 *     shows up on that monitor's dashboard / alerts / digests.
 *
 * Net effect: a 5-monitor account tracking the same subreddit on overlapping
 * keywords pays for AI analysis once instead of 5x.
 *
 * Phase A keeps writing `results.monitor_id` on the canonical row (set to the
 * first monitor that discovered the URL) for read-path compatibility. Phase B
 * will remove that column and switch readers to `monitor_results`.
 *
 * Returned `count`/`ids` are strictly the monitor-scoped NEW items. If the
 * same saveNewResults call is retried by Inngest, the ON CONFLICT DO NOTHING
 * link insert plus a post-insert re-read means we return 0 new ids on replay
 * (idempotent) — AI won't be re-triggered.
 *
 * @param items - Raw items to process
 * @param monitorId - Monitor ID for step naming + link insertion
 * @param userId - User ID for dedup scope + usage tracking
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
      // Deduplicate incoming items by sourceUrl — upstream scrapers occasionally
      // emit the same post twice (e.g. Reddit "new" + "rising"). Keep first.
      const urls = Array.from(new Set(items.map(getSourceUrl)));
      const itemByUrl = new Map<string, T>();
      for (const item of items) {
        const url = getSourceUrl(item);
        if (!itemByUrl.has(url)) itemByUrl.set(url, item);
      }

      // Cross-monitor dedup: look up any existing `results` rows for this USER
      // that already cover these URLs. We join through the user's monitors so
      // the dedup scope is per-user (not per-monitor, not global).
      //
      // Phase A still relies on `results.monitor_id` → `monitors.user_id` for
      // ownership. Phase B will read user ownership off `monitor_results`.
      const existing = await pooledDb
        .select({
          id: results.id,
          sourceUrl: results.sourceUrl,
        })
        .from(results)
        .innerJoin(monitors, eq(results.monitorId, monitors.id))
        .where(
          and(
            eq(monitors.userId, userId),
            inArray(results.sourceUrl, urls)
          )
        );

      const existingByUrl = new Map<string, string>();
      for (const row of existing) {
        // Multiple rows per URL can exist transiently if older per-monitor
        // duplicates predate this migration; keep the first (any will do —
        // the link table collapses them going forward).
        if (!existingByUrl.has(row.sourceUrl)) {
          existingByUrl.set(row.sourceUrl, row.id);
        }
      }

      // Split URLs into "need new results row" vs "already exists for user".
      const urlsNeedingInsert = urls.filter((u) => !existingByUrl.has(u));
      const urlsExistingElsewhere = urls.filter((u) => existingByUrl.has(u));

      // Insert brand-new result rows (first time this user has seen the URL).
      // Keep monitor_id set on the canonical row for Phase A read-path compat.
      let insertedIds: { id: string; sourceUrl: string }[] = [];
      if (urlsNeedingInsert.length > 0) {
        const newInserts = urlsNeedingInsert
          .map((url) => itemByUrl.get(url))
          .filter((x): x is T => x !== undefined)
          .map(mapToResult);

        insertedIds = await pooledDb
          .insert(results)
          .values(newInserts)
          .returning({ id: results.id, sourceUrl: results.sourceUrl });

        // Usage counter counts canonical analyzable rows, not link rows — a
        // linked-only match didn't spend a fresh AI call or storage budget.
        await incrementResultsCount(userId, insertedIds.length);
      }

      // Build the full set of result ids this monitor should be linked to:
      // every URL from the scan, either newly inserted or previously existing.
      const allLinks: { monitorId: string; resultId: string }[] = [];
      for (const row of insertedIds) {
        allLinks.push({ monitorId, resultId: row.id });
      }
      for (const url of urlsExistingElsewhere) {
        const resultId = existingByUrl.get(url)!;
        allLinks.push({ monitorId, resultId });
      }

      if (allLinks.length === 0) {
        return { ids: [] as string[], count: 0 };
      }

      // Insert monitor_results links; the (monitorId, resultId) PK means a
      // replay of this step is idempotent — ON CONFLICT DO NOTHING skips links
      // that already exist, and `returning` gives us exactly the links that
      // were newly created. Those are the resultIds that should trigger AI for
      // THIS monitor (the canonical AI analysis may have already run for
      // linked-only results — analyze-content handles that check — but we do
      // still want per-monitor notifications + digest pickup).
      const insertedLinks = await pooledDb
        .insert(monitorResults)
        .values(allLinks)
        .onConflictDoNothing({
          target: [monitorResults.monitorId, monitorResults.resultId],
        })
        .returning({ resultId: monitorResults.resultId });

      const newResultIds = insertedLinks.map((r) => r.resultId);

      return { ids: newResultIds, count: newResultIds.length };
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

  // Create in-app notification for new results
  await step.run(`notify-scan-${monitorId}`, async () => {
    const { createScanNotification } = await import("./create-scan-notification");
    await createScanNotification({
      monitorId,
      userId,
      platform,
      resultCount: newResultIds.length,
    });
  });

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
 *
 * Task 1.4: when `userId` + `platform` are supplied, emits the typed
 * `scan.completed` PostHog event. Optional to preserve back-compat with any
 * future caller that predates the taxonomy; all 17 current platform scans
 * pass them so the activation/reliability funnels stay populated.
 */
export async function updateMonitorStats(
  monitorId: string,
  matchCount: number,
  step: MonitorStep,
  opts?: { userId: string; platform: string; startedAt?: number }
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

  if (opts) {
    track("scan.completed", {
      userId: opts.userId,
      monitorId,
      platform: opts.platform,
      resultsFound: matchCount,
      // durationMs is best-effort — callers that don't pass startedAt log 0
      // rather than omitting the field, so downstream dashboards can filter.
      durationMs: opts.startedAt ? Date.now() - opts.startedAt : 0,
    });
  }
}

/**
 * Task 1.4: emit `scan.failed` from a platform scan's outer catch. Keeps
 * failure analytics in the shared helper so every platform reports failures
 * with the same shape (errorType is the Error.name — e.g. "TimeoutError").
 */
export function trackScanFailed(params: {
  userId: string;
  monitorId: string;
  platform: string;
  error: unknown;
}): void {
  const errorType =
    params.error instanceof Error ? params.error.name || "Error" : "Unknown";
  track("scan.failed", {
    userId: params.userId,
    monitorId: params.monitorId,
    platform: params.platform,
    errorType,
  });
}
