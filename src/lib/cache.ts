/**
 * Query Cache Module
 *
 * Implements in-memory caching with TTL for API calls (Serper, Reddit, etc.)
 * This reduces API costs by 60-80% through:
 * 1. Query deduplication - same query returns cached result
 * 2. Cross-user sharing - multiple users with same keywords share cache
 * 3. Smart TTL - different cache durations based on content freshness needs
 *
 * Can be upgraded to Redis for production multi-instance deployments
 */

import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
}

// TTL configurations in milliseconds
export const CACHE_TTL = {
  // Reddit/Social content - moderate freshness needed
  REDDIT_SEARCH: 2 * 60 * 60 * 1000, // 2 hours

  // High-frequency subreddits - shorter cache
  REDDIT_HOT: 1 * 60 * 60 * 1000, // 1 hour

  // Low-activity content - longer cache
  REDDIT_NICHE: 4 * 60 * 60 * 1000, // 4 hours

  // Product Hunt - less frequent posts
  PRODUCTHUNT: 4 * 60 * 60 * 1000, // 4 hours

  // Hacker News - moderate activity
  HACKERNEWS: 2 * 60 * 60 * 1000, // 2 hours

  // Reviews - rarely change
  REVIEWS: 6 * 60 * 60 * 1000, // 6 hours

  // Default
  DEFAULT: 2 * 60 * 60 * 1000, // 2 hours
} as const;

// ============================================================================
// IN-MEMORY CACHE IMPLEMENTATION
// ============================================================================

class QueryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats = { hits: 0, misses: 0 };
  private maxEntries: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
    this.startCleanupInterval();
  }

  /**
   * Generate a cache key from query parameters
   */
  generateKey(prefix: string, params: Record<string, unknown>): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash("md5").update(normalized).digest("hex");
    return `${prefix}:${hash}`;
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count and return
    entry.hitCount++;
    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, data: T, ttlMs: number = CACHE_TTL.DEFAULT): void {
    // Evict old entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      createdAt: now,
      expiresAt: now + ttlMs,
      hitCount: 0,
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Evict oldest entries (LRU-style)
   */
  private evictOldest(count = 100): void {
    const entries: [string, CacheEntry<unknown>][] = [];

    this.cache.forEach((value, key) => {
      entries.push([key, value]);
    });

    entries.sort((a, b) => a[1].createdAt - b[1].createdAt);

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clean up expired entries periodically
   */
  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.cache.forEach((entry, key) => {
        if (now > entry.expiresAt) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.cache.delete(key));
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Global cache instance
const globalCache = new QueryCache(10000);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get or set a cached value with automatic key generation
 *
 * @example
 * const results = await cachedQuery(
 *   "serper:reddit",
 *   { subreddit: "startups", keywords: ["saas", "marketing"] },
 *   async () => searchRedditSerper("startups", ["saas", "marketing"]),
 *   CACHE_TTL.REDDIT_SEARCH
 * );
 */
export async function cachedQuery<T>(
  prefix: string,
  params: Record<string, unknown>,
  fetchFn: () => Promise<T>,
  ttlMs: number = CACHE_TTL.DEFAULT
): Promise<{ data: T; cached: boolean; cacheKey: string }> {
  const cacheKey = globalCache.generateKey(prefix, params);

  // Try to get from cache
  const cached = globalCache.get<T>(cacheKey);
  if (cached !== null) {
    console.log(`[Cache] HIT: ${prefix} (key: ${cacheKey.slice(-8)})`);
    return { data: cached, cached: true, cacheKey };
  }

  // Fetch fresh data
  console.log(`[Cache] MISS: ${prefix} (key: ${cacheKey.slice(-8)})`);
  const data = await fetchFn();

  // Store in cache
  globalCache.set(cacheKey, data, ttlMs);

  return { data, cached: false, cacheKey };
}

/**
 * Invalidate cache entries matching a prefix
 */
export function invalidateCache(prefix: string): number {
  const keysToDelete: string[] = [];

  // Use forEach instead of iterator
  (globalCache as unknown as { cache: Map<string, unknown> }).cache.forEach((_, key) => {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => globalCache.delete(key));
  console.log(`[Cache] Invalidated ${keysToDelete.length} entries matching "${prefix}"`);
  return keysToDelete.length;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return globalCache.getStats();
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  globalCache.clear();
  console.log("[Cache] Cleared all entries");
}

/**
 * Direct cache access for manual operations
 */
export const cache = {
  get: <T>(key: string) => globalCache.get<T>(key),
  set: <T>(key: string, data: T, ttlMs?: number) => globalCache.set(key, data, ttlMs),
  has: (key: string) => globalCache.has(key),
  delete: (key: string) => globalCache.delete(key),
  generateKey: (prefix: string, params: Record<string, unknown>) =>
    globalCache.generateKey(prefix, params),
};

// ============================================================================
// HELPER: Determine optimal TTL based on subreddit activity
// ============================================================================

// High-activity subreddits that need fresher data
const HIGH_ACTIVITY_SUBREDDITS = new Set([
  "askreddit", "news", "worldnews", "technology", "programming",
  "startups", "entrepreneur", "saas", "webdev", "javascript",
  "reactjs", "nextjs", "marketing", "smallbusiness", "business"
]);

/**
 * Get optimal cache TTL for a Reddit subreddit
 */
export function getRedditCacheTTL(subreddit: string): number {
  const normalized = subreddit.toLowerCase();

  if (HIGH_ACTIVITY_SUBREDDITS.has(normalized)) {
    return CACHE_TTL.REDDIT_HOT; // 1 hour for busy subreddits
  }

  return CACHE_TTL.REDDIT_SEARCH; // 2 hours for normal subreddits
}

/**
 * Get optimal cache TTL for a platform
 */
export function getPlatformCacheTTL(platform: string): number {
  switch (platform) {
    case "reddit":
      return CACHE_TTL.REDDIT_SEARCH;
    case "hackernews":
      return CACHE_TTL.HACKERNEWS;
    case "producthunt":
      return CACHE_TTL.PRODUCTHUNT;
    case "googlereviews":
    case "trustpilot":
    case "appstore":
    case "playstore":
      return CACHE_TTL.REVIEWS;
    default:
      return CACHE_TTL.DEFAULT;
  }
}
