import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Ensure no Redis env vars so we use the in-memory fallback
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

// Mock Redis to prevent connection attempts
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

async function loadModule() {
  return import("../cache");
}

describe("cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("cache.get/set/delete (in-memory)", () => {
    it("returns null for a missing key", async () => {
      const { cache } = await loadModule();
      const result = await cache.get("nonexistent-key");
      expect(result).toBeNull();
    });

    it("stores and retrieves a value", async () => {
      const { cache } = await loadModule();
      const key = `test-set-get-${Date.now()}`;
      await cache.set(key, { foo: "bar" }, 60_000);
      const result = await cache.get(key);
      expect(result).toEqual({ foo: "bar" });
    });

    it("deletes a value", async () => {
      const { cache } = await loadModule();
      const key = `test-delete-${Date.now()}`;
      await cache.set(key, "value", 60_000);
      const deleted = await cache.delete(key);
      expect(deleted).toBe(true);
      const result = await cache.get(key);
      expect(result).toBeNull();
    });

    it("returns false when deleting a nonexistent key", async () => {
      const { cache } = await loadModule();
      const deleted = await cache.delete("does-not-exist-xyz");
      expect(deleted).toBe(false);
    });

    it("cache.has returns true for existing key", async () => {
      const { cache } = await loadModule();
      const key = `test-has-${Date.now()}`;
      await cache.set(key, "exists", 60_000);
      expect(await cache.has(key)).toBe(true);
    });

    it("cache.has returns false for missing key", async () => {
      const { cache } = await loadModule();
      expect(await cache.has("no-such-key-abc")).toBe(false);
    });
  });

  describe("TTL expiration", () => {
    it("returns null after TTL expires", async () => {
      const { cache } = await loadModule();
      const key = `test-ttl-${Date.now()}`;
      await cache.set(key, "temp-data", 5_000); // 5 second TTL

      // Still alive
      const before = await cache.get(key);
      expect(before).toBe("temp-data");

      // Advance past TTL
      vi.advanceTimersByTime(6_000);

      const after = await cache.get(key);
      expect(after).toBeNull();
    });

    it("cache.has returns false after TTL expires", async () => {
      const { cache } = await loadModule();
      const key = `test-has-ttl-${Date.now()}`;
      await cache.set(key, "data", 3_000);
      expect(await cache.has(key)).toBe(true);

      vi.advanceTimersByTime(4_000);
      expect(await cache.has(key)).toBe(false);
    });
  });

  describe("cache key generation", () => {
    it("generates deterministic keys for same params", async () => {
      const { cache } = await loadModule();
      const key1 = cache.generateKey("prefix", { a: 1, b: "two" });
      const key2 = cache.generateKey("prefix", { a: 1, b: "two" });
      expect(key1).toBe(key2);
    });

    it("generates different keys for different params", async () => {
      const { cache } = await loadModule();
      const key1 = cache.generateKey("prefix", { a: 1 });
      const key2 = cache.generateKey("prefix", { a: 2 });
      expect(key1).not.toBe(key2);
    });

    it("generates different keys for different prefixes", async () => {
      const { cache } = await loadModule();
      const key1 = cache.generateKey("alpha", { a: 1 });
      const key2 = cache.generateKey("beta", { a: 1 });
      expect(key1).not.toBe(key2);
    });

    it("key starts with kaulby: prefix", async () => {
      const { cache } = await loadModule();
      const key = cache.generateKey("test", { x: 1 });
      expect(key.startsWith("kaulby:")).toBe(true);
    });
  });

  describe("cachedQuery", () => {
    it("calls fetchFn on cache miss and returns cached:false", async () => {
      const { cachedQuery } = await loadModule();
      const fetchFn = vi.fn().mockResolvedValue({ results: [1, 2, 3] });

      const result = await cachedQuery(
        `query-miss-${Date.now()}`,
        { q: "test" },
        fetchFn,
        60_000
      );

      expect(result.cached).toBe(false);
      expect(result.data).toEqual({ results: [1, 2, 3] });
      expect(fetchFn).toHaveBeenCalledOnce();
    });

    it("returns cached data on cache hit without calling fetchFn again", async () => {
      const { cachedQuery } = await loadModule();
      const prefix = `query-hit-${Date.now()}`;
      const params = { q: "cached" };
      const fetchFn = vi.fn().mockResolvedValue("fresh-data");

      // First call - populates cache
      await cachedQuery(prefix, params, fetchFn, 60_000);
      expect(fetchFn).toHaveBeenCalledOnce();

      // Second call - should hit cache
      const fetchFn2 = vi.fn().mockResolvedValue("should-not-call");
      const result = await cachedQuery(prefix, params, fetchFn2, 60_000);

      expect(result.cached).toBe(true);
      expect(result.data).toBe("fresh-data");
      expect(fetchFn2).not.toHaveBeenCalled();
    });
  });

  describe("getRedditCacheTTL", () => {
    it("returns shorter TTL for high-activity subreddits", async () => {
      const { getRedditCacheTTL, CACHE_TTL } = await loadModule();
      expect(getRedditCacheTTL("startups")).toBe(CACHE_TTL.REDDIT_HOT);
    });

    it("returns standard TTL for low-activity subreddits", async () => {
      const { getRedditCacheTTL, CACHE_TTL } = await loadModule();
      expect(getRedditCacheTTL("obscuresubreddit")).toBe(CACHE_TTL.REDDIT_SEARCH);
    });

    it("is case-insensitive for subreddit names", async () => {
      const { getRedditCacheTTL, CACHE_TTL } = await loadModule();
      expect(getRedditCacheTTL("STARTUPS")).toBe(CACHE_TTL.REDDIT_HOT);
      expect(getRedditCacheTTL("JavaScript")).toBe(CACHE_TTL.REDDIT_HOT);
    });
  });

  describe("CACHE_TTL constants", () => {
    it("has expected TTL values", async () => {
      const { CACHE_TTL } = await loadModule();
      expect(CACHE_TTL.REDDIT_SEARCH).toBe(2 * 60 * 60 * 1000);
      expect(CACHE_TTL.REDDIT_HOT).toBe(1 * 60 * 60 * 1000);
      expect(CACHE_TTL.REVIEWS).toBe(6 * 60 * 60 * 1000);
      expect(CACHE_TTL.USER_DATA).toBe(5 * 60 * 1000);
      expect(CACHE_TTL.DEFAULT).toBe(2 * 60 * 60 * 1000);
    });
  });
});
