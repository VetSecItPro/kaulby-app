/**
 * Reddit Integration Module
 *
 * Resilient priority chain — current state after dead-code cleanup 2026-04-23:
 *   1. Apify `automation-lab/reddit-scraper` (PRIMARY) — per-subreddit, keyword-agnostic
 *   2. Reddit Public JSON API (FALLBACK) — per-subreddit search or /new, free, rate-limited
 *   3. `searchRedditPublicSiteWide` — cross-subreddit keyword search via
 *      reddit.com/search.json. Used by monitor-reddit/scan-on-demand when the
 *      subreddit-picker finds zero matches. DMCA-safe (Reddit's own API).
 *
 * The legacy Serper-based path was deleted 2026-04-23 — it had been disabled
 * behind `KAULBY_ALLOW_SERPER_REDDIT=true` since PR #195 (2026-04-21) in response
 * to the Oct 2025 Reddit v. SerpApi DMCA §1201 precedent. Keeping disabled dead
 * code was a footgun risk; the public search.json endpoint is Reddit's own API
 * and covers the same use case without DMCA exposure.
 *
 * Before editing this file, read `.github/runbooks/reddit-safety.md` (R12). It
 * documents the hard rules, cease-and-desist playbook, and the GummySearch lesson.
 *
 * Cost optimizations:
 * - Query caching with 2-4hr TTL (saves 60-80% of API calls)
 * - Cross-user deduplication via shared-scan dedup (see src/lib/shared-scan.ts)
 * - Smart TTL based on subreddit activity
 * - Circuit breaker per source (5-min cooldown after 3 consecutive failures)
 *
 * We skip Reddit's official paid Data API because:
 * - Terms require commercial sign-off most small operators don't get ($35K MRR
 *   GummySearch couldn't reach agreement and responsibly shut down Nov 2025)
 * - Apify absorbs ToS risk contractually on our behalf
 * - OAuth rate limits (100 req/min free self-service) don't fit workspace scale
 */

import { cachedQuery, getRedditCacheTTL, CACHE_TTL } from "@/lib/cache";
import { dedupedScan } from "@/lib/shared-scan";
import { logger } from "@/lib/logger";
import { captureEvent } from "@/lib/posthog";
import { Redis } from "@upstash/redis";

// Circuit breaker for Reddit data sources
const circuitBreakers: Record<string, { failures: number; openUntil: number }> = {};
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function isCircuitOpen(source: string): boolean {
  const cb = circuitBreakers[source];
  if (!cb || cb.failures < CIRCUIT_THRESHOLD) return false;
  if (Date.now() > cb.openUntil) {
    // Half-open: allow one probe
    return false;
  }
  return true;
}

function recordSuccess(source: string): void {
  circuitBreakers[source] = { failures: 0, openUntil: 0 };
}

function recordFailure(source: string): void {
  const cb = circuitBreakers[source] || { failures: 0, openUntil: 0 };
  cb.failures++;
  if (cb.failures >= CIRCUIT_THRESHOLD) {
    cb.openUntil = Date.now() + CIRCUIT_COOLDOWN;
    logger.warn(`[Reddit] Circuit breaker OPEN for ${source} — skipping for 5 minutes`);
    // COA 4 W2.2: emit degraded event on circuit-open transition so dashboards
    // can show reliability dips and alerting can page on sustained degradation.
    // Using a synthetic distinctId because this is a system-level signal, not
    // per-user. Only Apify degradation is flagged — Public JSON/Serper hitting
    // their breakers isn't as operationally urgent (they're fallbacks).
    if (source === "apify") {
      captureEvent({
        distinctId: "kaulby-system",
        event: "reddit.apify_degraded",
        properties: {
          consecutive_failures: cb.failures,
          cooldown_until: new Date(cb.openUntil).toISOString(),
        },
      });
    }
  }
  circuitBreakers[source] = cb;
}

// ============================================================================
// COA 4 W2.1 — Reddit watermark (Redis-backed per-(workspace, subreddit) marker
// of the most recent post URL we've already ingested). Used by monitor-reddit to
// short-circuit post-processing work once we hit a seen post. Falls back safely
// when Redis isn't configured (dev) — short-circuit simply doesn't fire.
// ============================================================================

let _watermarkRedis: Redis | null = null;
function getWatermarkRedis(): Redis | null {
  if (_watermarkRedis) return _watermarkRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  _watermarkRedis = new Redis({ url, token });
  return _watermarkRedis;
}

const WATERMARK_TTL_SECONDS = 30 * 86400; // 30 days — long enough to survive cold monitors

function watermarkKey(workspaceId: string, subreddit: string): string {
  // Lowercase subreddit for stable keys regardless of casing in the monitor row.
  return `kaulby:reddit:watermark:${workspaceId}:${subreddit.toLowerCase()}`;
}

/**
 * Read the last-seen post URL for a (workspace, subreddit) pair. Returns null
 * if no watermark exists or Redis is unavailable. Callers should treat null as
 * "process everything" (no short-circuit).
 */
export async function getRedditWatermark(
  workspaceId: string,
  subreddit: string
): Promise<string | null> {
  const r = getWatermarkRedis();
  if (!r) return null;
  try {
    return await r.get<string>(watermarkKey(workspaceId, subreddit));
  } catch (err) {
    logger.warn("[Reddit] watermark read failed", {
      workspaceId,
      subreddit,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Update the watermark to the newest post URL just ingested. Best-effort —
 * if Redis is unavailable we silently skip so the scheduled scan still
 * completes.
 */
export async function setRedditWatermark(
  workspaceId: string,
  subreddit: string,
  postUrl: string
): Promise<void> {
  const r = getWatermarkRedis();
  if (!r) return;
  try {
    await r.set(watermarkKey(workspaceId, subreddit), postUrl, {
      ex: WATERMARK_TTL_SECONDS,
    });
  } catch (err) {
    logger.warn("[Reddit] watermark write failed", {
      workspaceId,
      subreddit,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  permalink: string;
  url: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

interface RedditSearchResult {
  posts: RedditPost[];
  source: "apify" | "public";
  error?: string;
}

// ============================================================================
// PRIMARY: Apify reddit-scraper
// ============================================================================

/**
 * Search Reddit via Apify's Reddit Scraper
 * Most reliable but most expensive
 *
 * Uses your existing APIFY_API_KEY
 */
async function searchRedditApify(
  subreddit: string,
  limit: number = 50
): Promise<RedditPost[]> {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error("Apify not configured");
  }

  try {
    // Actor: automation-lab/reddit-scraper — schema: { urls, maxPostsPerSource, sort }
    // Empirical cost: $0.003 for 25 items @ 2026-04-21 — see .mdmp/reddit-spike-results-2026-04-21.md
    // Note: this actor returns POSTS ONLY (no comments support). Comments must come from Public JSON fallback if needed.
    const runResponse = await fetch(
      "https://api.apify.com/v2/acts/automation-lab~reddit-scraper/runs?token=" + apiKey,
      {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [`https://www.reddit.com/r/${subreddit}/`],
          maxPostsPerSource: limit,
          sort: "new",
        }),
      }
    );

    if (!runResponse.ok) {
      throw new Error(`Apify run failed: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;

    // Wait for completion (poll every 2 seconds, max 60 seconds)
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`,
        { signal: AbortSignal.timeout(30000) }
      );
      const statusData = await statusResponse.json();

      if (statusData.data.status === "SUCCEEDED") {
        break;
      } else if (statusData.data.status === "FAILED") {
        throw new Error("Apify actor run failed");
      }

      attempts++;
    }

    // Get results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}`,
      { signal: AbortSignal.timeout(30000) }
    );
    const results = await resultsResponse.json();

    // automation-lab field mapping (measured): type/id/title/author/subreddit/score/numComments/selfText/createdAt (ISO)
    return results.map((item: {
      id: string;
      title: string;
      selfText?: string;
      author: string;
      subreddit: string;
      permalink: string;
      url: string;
      score: number;
      numComments?: number;
      createdAt: string;
    }) => ({
      id: item.id,
      title: item.title,
      selftext: item.selfText || "",
      author: item.author,
      subreddit: item.subreddit,
      permalink: item.permalink,
      url: item.url,
      score: item.score,
      num_comments: item.numComments ?? 0,
      created_utc: new Date(item.createdAt).getTime() / 1000,
    }));
  } catch (error) {
    logger.error("[Apify] Reddit search failed", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// ============================================================================
// TIER 4: Public JSON API (Last Resort / Legacy)
// ============================================================================

/**
 * Fetch from public Reddit JSON endpoint
 * WARNING: This is what GummySearch used - NOT recommended for production
 * Only use as absolute last resort
 *
 * Includes exponential backoff on 429 (rate limit) and 503 (overloaded) responses.
 */
async function searchRedditPublic(
  subreddit: string,
  limit: number = 50,
  keywords: string[] = []
): Promise<RedditPost[]> {
  const maxRetries = 3;
  const baseDelayMs = 1000;

  // Use Reddit's search endpoint when keywords are available (much more effective)
  // Falls back to /new only when no keywords provided
  const useSearch = keywords.length > 0;
  const searchQuery = keywords.join(" OR ");
  const url = useSearch
    ? `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(searchQuery)}&restrict_sr=on&sort=new&limit=${limit}`
    : `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "Kaulby/1.0" },
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const data = await response.json();
      return data.data.children.map((child: { data: RedditPost }) => child.data);
    }

    // Retry on rate limit or server overload
    if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s
      logger.warn("[Reddit] Public API rate limited, retrying", {
        status: response.status,
        attempt: attempt + 1,
        delayMs,
        subreddit,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    throw new Error(`Public Reddit API error: ${response.status}`);
  }

  throw new Error("Public Reddit API: max retries exceeded");
}

/**
 * Site-wide keyword search via Reddit's own public JSON API (no subreddit
 * restriction). Returns posts matching keywords across ALL of Reddit.
 *
 * DMCA-safe: uses reddit.com/search.json directly (Reddit's own API), NOT
 * the Serper/Google approach that was sued over in Oct 2025. Reddit
 * publishes this endpoint publicly and explicitly supports programmatic
 * access here.
 *
 * Why this exists: the platform-integration-test (2026-04-23) found that
 * monitor-reddit's subreddit-picker approach often returns generic subs
 * (r/technology, r/AskReddit) that don't contain brand-specific content.
 * Direct probe showed r/teslamotors had 7/10 Tesla matches; r/technology
 * had 0. Site-wide keyword search finds the right content directly.
 */
export async function searchRedditPublicSiteWide(
  keywords: string[],
  limit: number = 50,
): Promise<RedditSearchResult> {
  if (keywords.length === 0) {
    return { posts: [], source: "public", error: "no keywords provided" };
  }
  const query = keywords
    .map((k) => (k.includes(" ") ? `"${k}"` : k))
    .join(" OR ");
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${Math.min(limit, 100)}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Kaulby/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      return {
        posts: [],
        source: "public",
        error: `Reddit site-wide search error: ${response.status}`,
      };
    }
    const data = await response.json();
    const posts = (data.data?.children || []).map(
      (child: { data: RedditPost }) => child.data,
    );
    return { posts, source: "public" };
  } catch (error) {
    return {
      posts: [],
      source: "public",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// MAIN RESILIENT FUNCTION
// ============================================================================

/**
 * Search Reddit with automatic fallback between providers.
 * Re-ordered 2026-04-21 after spike measured costs + legal review.
 *
 * Tries in order:
 * 1. Cache (via cachedQuery wrapper)
 * 2. Apify automation-lab/reddit-scraper (PRIMARY) — measured $0.003/25 items; posts only
 * 3. Reddit Public JSON API (FALLBACK) — free, rate-limited, no auth, includes comments
 * 4. Serper site:reddit.com (LEGACY SAFETY NET, disabled-by-default) — Reddit sued SerpAPI Oct 2025
 *    for this exact technique under DMCA §1201. Kept behind KAULBY_ALLOW_SERPER_REDDIT=true for
 *    emergency only; do NOT enable without legal sign-off.
 */
export async function searchRedditResilient(
  subreddit: string,
  keywords: string[] = [],
  limit: number = 50
): Promise<RedditSearchResult> {
  // Generate cache key from search parameters
  const cacheParams = {
    subreddit: subreddit.toLowerCase(),
    keywords: keywords.map(k => k.toLowerCase()).sort(),
    limit,
  };

  // Get optimal TTL based on subreddit activity
  const cacheTTL = getRedditCacheTTL(subreddit);

  // TIER 1 (NEW 2026-04-24, Change 5 of apify-cost-optimization): Public JSON
  // keyword search. When the monitor has keywords, Reddit's own /search.json
  // endpoint pre-filters results by relevance — dramatically better signal
  // than scraping a full subreddit feed and matching client-side, AND it's
  // free (no Apify bill, no DMCA risk). We try this FIRST for keyword
  // monitors. Discovery monitors (no keywords) skip this and go to Apify.
  //
  // Quality note: Reddit's relevance ranking is strong; results here are
  // typically HIGHER quality for AI analysis than generic feed scraping.
  if (keywords.length > 0 && !isCircuitOpen("public")) {
    try {
      const { data: posts, cached } = await cachedQuery<RedditPost[]>(
        "public:reddit-kw",
        cacheParams,
        () => searchRedditPublic(subreddit, limit, keywords),
        cacheTTL,
      );
      if (cached) {
        logger.debug("[Reddit] Cache hit", { subreddit, provider: "public-kw" });
      }
      if (posts.length > 0) {
        recordSuccess("public");
        return { posts, source: "public" };
      }
      // Empty result — fall through to Apify which may find content the
      // keyword search missed (e.g. keyword in body but not title/rank).
      logger.debug("[Reddit] Public keyword search returned 0, falling through to Apify", { subreddit });
    } catch (error) {
      recordFailure("public");
      logger.warn("[Reddit] Public keyword search failed, falling through to Apify", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // TIER 2: Apify automation-lab/reddit-scraper. Measured $0.003/25 items
  // 2026-04-21. Used for discovery monitors (no keywords) and as fallback
  // when keyword search above returns 0 or errors.
  //
  // PR-E.1: the Apify actor fetches r/<subreddit> WITHOUT any keyword filter,
  // so all users monitoring the same subreddit can share one scrape via
  // dedupedScan (keyword-agnostic key). At 100 Team users with 5-8x overlap
  // this is a major cost lever.
  const hasApify = process.env.APIFY_API_KEY;
  if (hasApify && !isCircuitOpen("apify")) {
    try {
      const windowMinutes = Math.max(1, Math.floor(cacheTTL / 60_000));
      const { data: posts, cached } = await dedupedScan<RedditPost[]>(
        "reddit",
        subreddit,
        windowMinutes,
        () => searchRedditApify(subreddit, limit),
      );

      if (cached) {
        logger.debug("[Reddit] Shared-scan HIT", { subreddit, provider: "apify", windowMinutes });
      }

      recordSuccess("apify");
      return { posts, source: "apify" };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Apify quota-exhausted is a persistent signal (until monthly reset)
      // — open circuit for 1 hour to avoid wasting 10+ calls per scan burning
      // cold-start retries against the same dead endpoint.
      if (msg.startsWith("ApifyQuotaExhausted")) {
        circuitBreakers["apify"] = { failures: CIRCUIT_THRESHOLD, openUntil: Date.now() + 60 * 60 * 1000 };
        logger.warn("[Reddit] Apify quota exhausted — circuit open 1h", { subreddit });
      } else {
        recordFailure("apify");
        logger.warn("[Reddit] Apify failed, falling back to public JSON", { error: msg });
      }
    }
  } else if (hasApify && isCircuitOpen("apify")) {
    logger.debug("[Reddit] Skipping Apify — circuit breaker open", { subreddit });
  }

  // FALLBACK: Reddit Public JSON API (no auth, rate-limited).
  if (!isCircuitOpen("public")) {
    try {
      const { data: posts, cached } = await cachedQuery<RedditPost[]>(
        "public:reddit",
        cacheParams,
        () => searchRedditPublic(subreddit, limit, keywords),
        CACHE_TTL.REDDIT_HOT
      );

      if (cached) {
        logger.debug("[Reddit] Cache hit", { subreddit, provider: "public" });
      }

      recordSuccess("public");
      return { posts, source: "public" };
    } catch (error) {
      recordFailure("public");
      logger.warn("[Reddit] Public JSON failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  logger.error("[Reddit] All providers exhausted (Apify primary + Public JSON fallback both unavailable or circuits open)", { subreddit });
  return {
    posts: [],
    source: "public",
    error: "Apify + Public JSON unavailable. Set APIFY_API_KEY and ensure Upstash Redis + network access.",
  };
}

