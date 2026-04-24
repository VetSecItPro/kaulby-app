import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRedditResilient } from "../reddit";

// Post-PR #241: Serper-Reddit path was deleted for legal-safety reasons
// (Oct 2025 Reddit v. SerpApi DMCA §1201 precedent). Priority chain is now:
//   1. Apify automation-lab/reddit-scraper (PRIMARY, requires APIFY_API_KEY)
//   2. Reddit public JSON endpoint (FALLBACK, no auth)

// Mock dependencies — cachedQuery passes through fn() by default; tests can override.
vi.mock("@/lib/cache", () => ({
  cachedQuery: vi.fn((_namespace, _params, fn) => fn().then((data: unknown) => ({ data, cached: false }))),
  getRedditCacheTTL: vi.fn(() => 7200),
  CACHE_TTL: {
    REDDIT_SEARCH: 7200,
    REDDIT_HOT: 3600,
  },
}));

// dedupedScan also passes through — same contract as cachedQuery for Apify path.
vi.mock("@/lib/shared-scan", () => ({
  dedupedScan: vi.fn((_platform, _key, _windowMin, fn) => fn().then((data: unknown) => ({ data, cached: false }))),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as never;

describe("reddit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SERPER_API_KEY", "");
    vi.stubEnv("APIFY_API_KEY", "");
  });

  describe("searchRedditResilient with public API fallback", () => {
    it("falls through to public JSON when Apify is not configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              children: [
                {
                  data: {
                    id: "abc123",
                    title: "Test Post",
                    selftext: "Content",
                    author: "testuser",
                    subreddit: "programming",
                    permalink: "/r/programming/comments/abc123/test/",
                    url: "https://reddit.com/r/programming/comments/abc123/test/",
                    score: 100,
                    num_comments: 50,
                    created_utc: 1704067200,
                  },
                },
              ],
            },
          }),
      });

      const result = await searchRedditResilient("programming", [], 50);

      expect(result.source).toBe("public");
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.posts[0].id).toBe("abc123");
    });
  });

  describe("error handling", () => {
    it("returns empty results when all providers fail", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Error"),
      });

      const result = await searchRedditResilient("test", [], 50);

      expect(result.posts).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it("logs warnings when public provider fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Error"),
      });

      await searchRedditResilient("test", [], 50);

      const { logger } = await import("@/lib/logger");
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
