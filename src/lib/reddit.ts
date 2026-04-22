/**
 * Reddit Integration Module
 *
 * Resilient priority chain — re-ordered 2026-04-21 via PR #195 in response to
 * the Oct 2025 Reddit v. SerpApi DMCA §1201 precedent:
 *   1. Apify `automation-lab/reddit-scraper` (PRIMARY) — $1.15/1K posts at FREE plan
 *   2. Reddit Public JSON API (FALLBACK) — free, anonymous, rate-limited, posts-only
 *   3. Serper `site:reddit.com` (LEGACY OPT-IN) — disabled by default, gated by
 *      `KAULBY_ALLOW_SERPER_REDDIT=true`. Carries direct DMCA §1201 risk.
 *
 * Before editing this file, read `.github/runbooks/reddit-safety.md` (R12). It
 * documents the hard rules, cease-and-desist playbook, and the GummySearch lesson.
 *
 * Cost optimizations:
 * - Query caching with 2-4hr TTL (saves 60-80% of API calls)
 * - Cross-user deduplication (same keywords = shared cache)
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
import { randomBytes } from "crypto";
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
  source: "serper" | "apify" | "public";
  error?: string;
}

// ============================================================================
// TIER 1: Google Search APIs (Serper or SerpAPI) - PRIMARY
// ============================================================================

/**
 * Search Reddit via Serper (Google Search API)
 * Best value: $50/month for 50,000 searches
 *
 * To set up:
 * 1. Go to https://serper.dev
 * 2. Sign up (2,500 free searches to start)
 * 3. Get your API key
 * 4. Add SERPER_API_KEY to .env.local
 */
async function searchRedditSerper(
  subreddit: string,
  keywords: string[],
  limit: number = 50
): Promise<RedditPost[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("Serper not configured");
  }

  try {
    // Search for Reddit posts in the specific subreddit
    // Include all search terms: keywords + company name (passed as first element when present)
    const searchTerms = keywords.length > 0
      ? keywords.map(k => k.includes(" ") ? `"${k}"` : k).join(" OR ")
      : "";
    const searchQuery = searchTerms
      ? `site:reddit.com/r/${subreddit} ${searchTerms}`
      : `site:reddit.com/r/${subreddit}`;

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: searchQuery,
        num: Math.min(limit, 100),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Transform Serper results to our format
    return (data.organic || []).map((result: {
      link: string;
      title: string;
      snippet: string;
    }) => transformSerperResult(result, subreddit));
  } catch (error) {
    logger.error("[Serper] Reddit search failed", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Transform Serper result to RedditPost format
 */
function transformSerperResult(
  result: { link: string; title: string; snippet: string },
  defaultSubreddit: string
): RedditPost {
  const urlMatch = result.link.match(/\/comments\/([a-z0-9]+)\//);
  const subredditMatch = result.link.match(/\/r\/([^/]+)\//);

  // SECURITY: Cryptographic randomness — FIX-002
  return {
    id: urlMatch?.[1] || `serper-${Date.now()}-${randomBytes(8).toString('hex')}`,
    title: result.title.replace(/ : \w+$/, "").replace(/ - Reddit$/, ""),
    selftext: result.snippet || "",
    author: "unknown",
    subreddit: subredditMatch?.[1] || defaultSubreddit,
    permalink: result.link.replace("https://www.reddit.com", ""),
    url: result.link,
    score: 0,
    num_comments: 0,
    created_utc: Date.now() / 1000,
  };
}

// ============================================================================
// TIER 3: Apify (Backup)
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

  // PRIMARY: Apify automation-lab/reddit-scraper. Measured $0.003/25 items 2026-04-21.
  const hasApify = process.env.APIFY_API_KEY;
  if (hasApify && !isCircuitOpen("apify")) {
    try {
      const { data: posts, cached } = await cachedQuery<RedditPost[]>(
        "apify:reddit",
        cacheParams,
        () => searchRedditApify(subreddit, limit),
        cacheTTL
      );

      if (cached) {
        logger.debug("[Reddit] Cache hit", { subreddit, provider: "apify" });
      }

      recordSuccess("apify");
      return { posts, source: "apify" };
    } catch (error) {
      recordFailure("apify");
      logger.warn("[Reddit] Apify failed, falling back to public JSON", { error: error instanceof Error ? error.message : String(error) });
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

  // LEGACY SAFETY NET: Serper site:reddit.com — disabled by default due to Reddit's Oct 2025
  // DMCA §1201 suit against SerpAPI for this exact technique. Opt-in via env var only.
  const allowSerperReddit = process.env.KAULBY_ALLOW_SERPER_REDDIT === "true";
  const hasSerper = process.env.SERPER_API_KEY;
  if (allowSerperReddit && hasSerper && !isCircuitOpen("serper")) {
    try {
      logger.warn("[Reddit] Using LEGACY Serper path — Oct 2025 DMCA risk, remove ASAP", { subreddit });
      const { data: posts, cached } = await cachedQuery<RedditPost[]>(
        "serper:reddit",
        cacheParams,
        () => searchRedditSerper(subreddit, keywords, limit),
        cacheTTL
      );
      if (cached) logger.debug("[Reddit] Cache hit", { subreddit, provider: "serper" });
      recordSuccess("serper");
      return { posts, source: "serper", error: "Used legacy Serper path — disable KAULBY_ALLOW_SERPER_REDDIT ASAP" };
    } catch (error) {
      recordFailure("serper");
      logger.error("[Reddit] All providers failed", { subreddit, error: error instanceof Error ? error.message : String(error) });
      return {
        posts: [],
        source: "serper",
        error: `All Reddit providers failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  logger.error("[Reddit] All providers exhausted (Apify primary + Public JSON fallback both unavailable or circuits open)", { subreddit });
  return {
    posts: [],
    source: "public",
    error: "Apify + Public JSON unavailable. Set APIFY_API_KEY, or opt into legacy Serper via KAULBY_ALLOW_SERPER_REDDIT=true (not recommended).",
  };
}

/**
 * Site-wide Reddit search via Serper (no subreddit restriction).
 *
 * Used as a fallback when subreddit-specific searches return 0 results.
 * Searches across ALL of Reddit for the given keywords.
 */
export async function searchRedditSiteWide(
  keywords: string[],
  limit: number = 50
): Promise<RedditSearchResult> {
  // Disabled 2026-04-21 — this used `site:reddit.com` Serper queries which is the exact technique
  // Reddit sued SerpAPI over in Oct 2025 (DMCA §1201). Re-enable only with legal sign-off by
  // setting KAULBY_ALLOW_SERPER_REDDIT=true.
  if (process.env.KAULBY_ALLOW_SERPER_REDDIT !== "true") {
    logger.debug("[Reddit] Site-wide Serper search disabled (set KAULBY_ALLOW_SERPER_REDDIT=true to force-enable)", {
      keywordCount: keywords.length,
    });
    return { posts: [], source: "serper", error: "Site-wide Serper disabled (DMCA risk)" };
  }
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    return { posts: [], source: "serper", error: "Serper not configured" };
  }

  try {
    const searchTerms = keywords
      .map(k => k.includes(" ") ? `"${k}"` : k)
      .join(" OR ");
    const searchQuery = `site:reddit.com ${searchTerms}`;

    const { data: posts, cached } = await cachedQuery<RedditPost[]>(
      "serper:reddit-sitewide",
      { keywords: keywords.map(k => k.toLowerCase()).sort(), limit },
      async () => {
        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          signal: AbortSignal.timeout(30000),
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: searchQuery,
            num: Math.min(limit, 100),
          }),
        });

        if (!response.ok) {
          throw new Error(`Serper error: ${response.status}`);
        }

        const data = await response.json();
        return (data.organic || []).map((result: {
          link: string;
          title: string;
          snippet: string;
        }) => transformSerperResult(result, "unknown"));
      },
      CACHE_TTL.REDDIT_SEARCH
    );

    if (cached) {
      logger.debug("[Reddit] Site-wide cache hit");
    }

    return { posts, source: "serper" };
  } catch (error) {
    logger.error("[Reddit] Site-wide search failed", { error: error instanceof Error ? error.message : String(error) });
    return { posts: [], source: "serper", error: error instanceof Error ? error.message : "Site-wide search failed" };
  }
}
