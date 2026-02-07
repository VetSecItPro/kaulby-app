/**
 * Query Cache Module
 *
 * Implements caching with TTL for API calls (Serper, Reddit, etc.)
 * Uses Upstash Redis in production for cross-instance sharing,
 * falls back to in-memory cache in development or when Redis is not configured.
 *
 * This reduces API costs by 60-80% through:
 * 1. Query deduplication - same query returns cached result
 * 2. Cross-user sharing - multiple users with same keywords share cache
 * 3. Smart TTL - different cache durations based on content freshness needs
 */

import crypto from "crypto";
import { Redis } from "@upstash/redis";

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
  backend: "redis" | "memory";
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

  // User data - short cache with frequent invalidation
  USER_DATA: 5 * 60 * 1000, // 5 minutes

  // Rate limits - very short
  RATE_LIMIT: 60 * 1000, // 1 minute

  // Default
  DEFAULT: 2 * 60 * 60 * 1000, // 2 hours

  // Results - moderate freshness, user-specific
  RESULTS: 2 * 60 * 1000, // 2 minutes
  RESULTS_ANALYTICS: 5 * 60 * 1000, // 5 minutes for analytics data
} as const;

// ============================================================================
// CACHE INTERFACE
// ============================================================================

interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttlMs: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  getStats(): CacheStats;
}

// ============================================================================
// REDIS CACHE IMPLEMENTATION
// ============================================================================

class RedisCache implements CacheBackend {
  private redis: Redis;
  private stats = { hits: 0, misses: 0 };

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
    });
  }

  generateKey(prefix: string, params: Record<string, unknown>): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
    return `kaulby:cache:${prefix}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get<T>(key);
      if (data !== null) {
        this.stats.hits++;
        return data;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      console.error("[Redis Cache] Get error:", error);
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      // Upstash uses seconds for EX
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.redis.set(key, data, { ex: ttlSeconds });
    } catch (error) {
      console.error("[Redis Cache] Set error:", error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error("[Redis Cache] Exists error:", error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const deleted = await this.redis.del(key);
      return deleted === 1;
    } catch (error) {
      console.error("[Redis Cache] Delete error:", error);
      return false;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: -1, // Redis doesn't easily expose this
      hitRate: total > 0 ? this.stats.hits / total : 0,
      backend: "redis",
    };
  }
}

// ============================================================================
// IN-MEMORY CACHE IMPLEMENTATION
// ============================================================================

class MemoryCache implements CacheBackend {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats = { hits: 0, misses: 0 };
  private maxEntries: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
    this.startCleanupInterval();
  }

  generateKey(prefix: string, params: Record<string, unknown>): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
    return `kaulby:${prefix}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
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

  async set<T>(key: string, data: T, ttlMs: number = CACHE_TTL.DEFAULT): Promise<void> {
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

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      backend: "memory",
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
    // PERF: Skip interval in Vercel serverless — use lazy cleanup on read instead — FIX-009
    if (process.env.VERCEL) return;
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

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get internal cache map (for prefix invalidation)
   */
  getInternalCache(): Map<string, CacheEntry<unknown>> {
    return this.cache;
  }
}

// ============================================================================
// UNIFIED CACHE WRAPPER
// ============================================================================

class UnifiedCache {
  private backend: CacheBackend;
  private memoryCache: MemoryCache;
  private useRedis: boolean;

  constructor() {
    // Check if Redis is configured
    const hasRedisConfig = Boolean(
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    );

    this.useRedis = hasRedisConfig;
    this.memoryCache = new MemoryCache(10000);

    if (hasRedisConfig) {
      console.log("[Cache] Using Upstash Redis backend");
      this.backend = new RedisCache();
    } else {
      console.log("[Cache] Using in-memory backend (set UPSTASH_REDIS_* for Redis)");
      this.backend = this.memoryCache;
    }
  }

  generateKey(prefix: string, params: Record<string, unknown>): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
    return `kaulby:${prefix}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.backend.get<T>(key);
  }

  async set<T>(key: string, data: T, ttlMs: number = CACHE_TTL.DEFAULT): Promise<void> {
    return this.backend.set(key, data, ttlMs);
  }

  async has(key: string): Promise<boolean> {
    return this.backend.has(key);
  }

  async delete(key: string): Promise<boolean> {
    return this.backend.delete(key);
  }

  getStats(): CacheStats {
    return this.backend.getStats();
  }

  clear(): void {
    if (!this.useRedis) {
      this.memoryCache.clear();
    }
    // For Redis, we don't clear all - that would be dangerous in production
  }

  /**
   * Invalidate cache entries by prefix (memory only - Redis requires scan)
   */
  async invalidateByPrefix(prefix: string): Promise<number> {
    if (!this.useRedis) {
      const cache = this.memoryCache.getInternalCache();
      const keysToDelete: string[] = [];

      cache.forEach((_, key) => {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => cache.delete(key));
      return keysToDelete.length;
    }
    // Redis prefix invalidation would require SCAN - skip for now
    return 0;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Global cache instance
const globalCache = new UnifiedCache();

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
  const cached = await globalCache.get<T>(cacheKey);
  if (cached !== null) {
    console.log(`[Cache] HIT: ${prefix} (key: ${cacheKey.slice(-8)})`);
    return { data: cached, cached: true, cacheKey };
  }

  // Fetch fresh data
  console.log(`[Cache] MISS: ${prefix} (key: ${cacheKey.slice(-8)})`);
  const data = await fetchFn();

  // Store in cache
  await globalCache.set(cacheKey, data, ttlMs);

  return { data, cached: false, cacheKey };
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

