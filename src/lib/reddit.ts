/**
 * Reddit Integration Module
 *
 * Implements a resilient tiered approach to avoid GummySearch's fate:
 * 1. Serper (Google Search) - Primary, cheap ($50/mo for 50k searches)
 * 2. Apify - Backup when Serper fails
 * 3. Public JSON - Last resort (risky, can be blocked)
 *
 * Cost optimizations:
 * - Query caching with 2-4hr TTL (saves 60-80% of API calls)
 * - Cross-user deduplication (same keywords = shared cache)
 * - Smart TTL based on subreddit activity
 *
 * We skip Reddit's official API because:
 * - Reddit is hostile to developers (rate limits even app creation)
 * - Third-party search is more reliable and won't be subject to Reddit's whims
 */

import { cachedQuery, getRedditCacheTTL, CACHE_TTL } from "@/lib/cache";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";

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
  }
  circuitBreakers[source] = cb;
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
    const searchQuery = keywords.length > 0
      ? `site:reddit.com/r/${subreddit} ${keywords.join(" OR ")}`
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
    // Start the Reddit scraper actor
    const runResponse = await fetch(
      "https://api.apify.com/v2/acts/trudax~reddit-scraper/runs?token=" + apiKey,
      {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url: `https://www.reddit.com/r/${subreddit}/new/` }],
          maxItems: limit,
          maxPostCount: limit,
          scrollTimeout: 40,
          proxy: { useApifyProxy: true },
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

    return results.map((item: {
      id: string;
      title: string;
      body: string;
      author: string;
      subreddit: string;
      permalink: string;
      url: string;
      score: number;
      numberOfComments: number;
      createdAt: string;
    }) => ({
      id: item.id,
      title: item.title,
      selftext: item.body || "",
      author: item.author,
      subreddit: item.subreddit,
      permalink: item.permalink,
      url: item.url,
      score: item.score,
      num_comments: item.numberOfComments,
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
  limit: number = 50
): Promise<RedditPost[]> {
  const maxRetries = 3;
  const baseDelayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
      {
        headers: { "User-Agent": "Kaulby/1.0" },
        signal: AbortSignal.timeout(30000),
      }
    );

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
 * Search Reddit with automatic fallback between providers
 * Includes caching to reduce API costs by 60-80%
 *
 * Tries in order:
 * 1. Cache - Check if we have recent results
 * 2. Serper (Google Search) - Primary, best value ($50/mo for 50k searches)
 * 3. Apify - Backup
 * 4. Public JSON API - Last resort (risky)
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

  // Try Serper first (PRIMARY - best value) with caching
  const hasSerper = process.env.SERPER_API_KEY;
  if (hasSerper && !isCircuitOpen("serper")) {
    try {
      const { data: posts, cached } = await cachedQuery<RedditPost[]>(
        "serper:reddit",
        cacheParams,
        () => searchRedditSerper(subreddit, keywords, limit),
        cacheTTL
      );

      if (cached) {
        logger.debug("[Reddit] Cache hit", { subreddit, provider: "serper" });
      }

      recordSuccess("serper");
      return { posts, source: "serper" };
    } catch (error) {
      recordFailure("serper");
      logger.warn("[Reddit] Serper failed, trying Apify", { error: error instanceof Error ? error.message : String(error) });
    }
  } else if (hasSerper && isCircuitOpen("serper")) {
    logger.debug("[Reddit] Skipping Serper — circuit breaker open", { subreddit });
  }

  // Try Apify as backup with caching
  const hasApify = process.env.APIFY_API_KEY;
  if (hasApify && !isCircuitOpen("apify")) {
    try {
      const { data: posts, cached } = await cachedQuery<RedditPost[]>(
        "apify:reddit",
        cacheParams,
        () => searchRedditApify(subreddit, limit),
        CACHE_TTL.REDDIT_SEARCH
      );

      if (cached) {
        logger.debug("[Reddit] Cache hit", { subreddit, provider: "apify" });
      }

      recordSuccess("apify");
      return { posts, source: "apify" };
    } catch (error) {
      recordFailure("apify");
      logger.warn("[Reddit] Apify failed, falling back to public API", { error: error instanceof Error ? error.message : String(error) });
    }
  } else if (hasApify && isCircuitOpen("apify")) {
    logger.debug("[Reddit] Skipping Apify — circuit breaker open", { subreddit });
  }

  // Last resort: Public JSON API (risky but works for now) - shorter cache
  if (!isCircuitOpen("public")) {
    try {
      logger.warn("[Reddit] Using public JSON API - NOT RECOMMENDED for production", { subreddit });

      const { data: posts, cached } = await cachedQuery<RedditPost[]>(
        "public:reddit",
        cacheParams,
        () => searchRedditPublic(subreddit, limit),
        CACHE_TTL.REDDIT_HOT // Shorter TTL for public API since it's risky
      );

      if (cached) {
        logger.debug("[Reddit] Cache hit", { subreddit, provider: "public" });
      }

      recordSuccess("public");
      return {
        posts,
        source: "public",
        error: "Using risky public API - configure SERPER_API_KEY for reliability"
      };
    } catch (error) {
      recordFailure("public");
      logger.error("[Reddit] All providers failed", { subreddit, error: error instanceof Error ? error.message : String(error) });
      return {
        posts: [],
        source: "public",
        error: `All Reddit providers failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  logger.error("[Reddit] All providers have open circuit breakers", { subreddit });
  return {
    posts: [],
    source: "public",
    error: "All Reddit providers temporarily unavailable (circuit breakers open)",
  };
}
