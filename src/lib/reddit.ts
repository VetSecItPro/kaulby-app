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
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
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
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}`
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
 */
async function searchRedditPublic(
  subreddit: string,
  limit: number = 50
): Promise<RedditPost[]> {
  const response = await fetch(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
    {
      headers: { "User-Agent": "Kaulby/1.0" },
    }
  );

  if (!response.ok) {
    throw new Error(`Public Reddit API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.children.map((child: { data: RedditPost }) => child.data);
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
  if (hasSerper) {
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

      return { posts, source: "serper" };
    } catch (error) {
      logger.warn("[Reddit] Serper failed, trying Apify", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Try Apify as backup with caching
  const hasApify = process.env.APIFY_API_KEY;
  if (hasApify) {
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

      return { posts, source: "apify" };
    } catch (error) {
      logger.warn("[Reddit] Apify failed, falling back to public API", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Last resort: Public JSON API (risky but works for now) - shorter cache
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

    return {
      posts,
      source: "public",
      error: "Using risky public API - configure SERPER_API_KEY for reliability"
    };
  } catch (error) {
    logger.error("[Reddit] All providers failed", { subreddit, error: error instanceof Error ? error.message : String(error) });
    return {
      posts: [],
      source: "public",
      error: `All Reddit providers failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
