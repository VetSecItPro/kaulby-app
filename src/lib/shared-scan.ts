/**
 * Shared-scan dedup infrastructure — PR-E.1.
 *
 * When two users monitor the same platform resource (e.g. r/SaaS on Reddit,
 * the `nodejs/node` repo on GitHub, `programming` on Hacker News), the
 * scraper call is identical — only the post-fetch keyword filtering differs
 * per user. This module provides a windowed read-through cache keyed by
 * (platform, resource) so all overlapping users share a single scrape per
 * window.
 *
 * Why this matters (unit economics):
 * - Apify reddit-scraper: $0.003 per 25-item run × 30+ popular subs × many
 *   users = real money at Growth-tier scale. Measured ratio: at 100 Team
 *   users the top-20 subs have 5-8x overlap.
 * - Projected savings: 3-5x infrastructure cost on high-volume platforms.
 *   See docs/planning/kaulby-backlog.md PR-E.1.
 *
 * Why "windowed" not TTL:
 * - Users should see fresh scans aligned to natural cadence, not arbitrary
 *   "last 15 min" drift that happens with pure TTL.
 * - Window = floor(now / windowMinutes). Two users within the same window
 *   share; the next window forces a fresh scrape.
 *
 * Non-goals:
 * - Per-keyword filter pushdown (that's cheap — do it client-side after hit)
 * - Cross-account data leakage (enforced by the consumer filtering by the
 *   user's own monitor keywords after reading from shared cache)
 */

import { cache } from "@/lib/cache";
import { captureEvent } from "@/lib/posthog";
import { logger } from "@/lib/logger";

export type SharedScanResult<T> = {
  data: T;
  cached: boolean;
  windowStartMs: number;
};

/**
 * Read-through shared-scan cache. The fetchFn is keyword-agnostic — it
 * fetches whatever the scraper pulls for the entire resource, and the
 * consumer filters client-side.
 *
 * @param platform Scanner identifier: "reddit", "github", "hackernews", etc.
 * @param resource Platform-specific resource ID: subreddit name, repo slug,
 *                 subdomain, etc. Normalized to lowercase.
 * @param windowMinutes Size of the dedup window. Smaller = fresher but less
 *                      savings. Default 30 aligns with Growth-tier refresh.
 * @param fetchFn The actual scraper call. Must be keyword-agnostic.
 */
export async function dedupedScan<T>(
  platform: string,
  resource: string,
  windowMinutes: number,
  fetchFn: () => Promise<T>,
): Promise<SharedScanResult<T>> {
  const windowMs = windowMinutes * 60 * 1000;
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `shared-scan:${platform}:${resource.toLowerCase()}:${windowStartMs}`;

  // TTL: remainder of window + 60s buffer so a scrape fired at window-end
  // doesn't immediately re-scrape for the next window's first consumer.
  const ttlMs = windowMs - (Date.now() - windowStartMs) + 60_000;

  const cached = await cache.get<T>(key);
  if (cached !== null) {
    // Emit observability event so PostHog dashboards can track hit rate.
    // distinctId is the shared-scan key itself — distinct scans show as
    // distinct rows, and hit-count-per-scan is the savings multiplier.
    captureEvent({
      distinctId: `shared-scan:${platform}:${resource.toLowerCase()}`,
      event: "shared_scan_hit",
      properties: { platform, resource: resource.toLowerCase(), windowStartMs, windowMinutes },
    });
    logger.debug("[shared-scan] HIT", { platform, resource, windowMinutes });
    return { data: cached, cached: true, windowStartMs };
  }

  const data = await fetchFn();
  await cache.set(key, data, ttlMs);

  captureEvent({
    distinctId: `shared-scan:${platform}:${resource.toLowerCase()}`,
    event: "shared_scan_miss",
    properties: { platform, resource: resource.toLowerCase(), windowStartMs, windowMinutes },
  });
  logger.debug("[shared-scan] MISS", { platform, resource, windowMinutes });

  return { data, cached: false, windowStartMs };
}
