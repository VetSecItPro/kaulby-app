/**
 * Quota tracker — per-source daily usage counters for silent-failure observability.
 *
 * COA 4 W1.9: Kaulby consumes external quotas (Serper queries/day, Apify actor
 * runs/month, YouTube Data API units/day, Reddit public-JSON requests/min).
 * This module centralizes the counting so an admin dashboard widget and alerting
 * can read a single source of truth.
 *
 * Design notes:
 * - Redis-first (Upstash) with atomic INCR + daily TTL. No DB schema change.
 * - Keys are namespaced `kaulby:quota:<source>:<YYYY-MM-DD>` (UTC day boundary).
 * - Gracefully degrades when Redis isn't configured: writes are no-ops, reads
 *   return 0. Never throws — quota tracking must NOT break the critical path.
 * - Circuit-breaker intentionally omitted here; the underlying Upstash client
 *   has its own retry behavior and transient failures should not block scans.
 */

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

export type QuotaSource = "serper" | "apify" | "youtube" | "reddit_public";

// Counter lives for 36 hours so end-of-day rollover doesn't lose data
// if read right before the :00:00 UTC boundary.
const COUNTER_TTL_SECONDS = 36 * 3600;

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

function todayKey(source: QuotaSource): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `kaulby:quota:${source}:${y}-${m}-${d}`;
}

function monthKey(source: QuotaSource): string {
  // Apify is billed monthly — a separate monthly rollup is useful for
  // "are we about to cross a plan threshold?" dashboards.
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `kaulby:quota:${source}:month:${y}-${m}`;
}

/**
 * Increment a source's daily + monthly counter by `amount`.
 * Never throws. If Redis is unavailable, logs once at debug and no-ops.
 */
export async function incrementQuota(source: QuotaSource, amount = 1): Promise<void> {
  if (amount <= 0) return;
  const r = getRedis();
  if (!r) return; // silent in dev without Redis

  try {
    const dayK = todayKey(source);
    const monthK = monthKey(source);
    // INCRBY is atomic; EXPIRE is only applied on first write of the window.
    await Promise.all([
      r.incrby(dayK, amount).then((val) => {
        // Lazy TTL: set the first time the key is created (count === amount).
        if (val === amount) {
          return r.expire(dayK, COUNTER_TTL_SECONDS);
        }
      }),
      r.incrby(monthK, amount).then((val) => {
        if (val === amount) {
          // Monthly keys live for 40 days — covers month-end edge cases.
          return r.expire(monthK, 40 * 86400);
        }
      }),
    ]);
  } catch (error) {
    logger.warn("[quota-tracker] increment failed (non-fatal)", {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Read today's counter for a source. Returns 0 if Redis unavailable. */
export async function getDailyQuota(source: QuotaSource): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  try {
    const val = await r.get<number>(todayKey(source));
    return Number(val ?? 0);
  } catch (error) {
    logger.warn("[quota-tracker] read failed", {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/** Read this month's counter for a source. Returns 0 if Redis unavailable. */
export async function getMonthlyQuota(source: QuotaSource): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  try {
    const val = await r.get<number>(monthKey(source));
    return Number(val ?? 0);
  } catch (error) {
    logger.warn("[quota-tracker] read failed", {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Bulk read used by the admin dashboard widget. Returns all sources in one call.
 */
export async function getAllQuotas(): Promise<
  Record<QuotaSource, { daily: number; monthly: number }>
> {
  const sources: QuotaSource[] = ["serper", "apify", "youtube", "reddit_public"];
  const entries = await Promise.all(
    sources.map(async (s) => [s, { daily: await getDailyQuota(s), monthly: await getMonthlyQuota(s) }] as const)
  );
  return Object.fromEntries(entries) as Record<QuotaSource, { daily: number; monthly: number }>;
}
