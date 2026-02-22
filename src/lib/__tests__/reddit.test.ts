import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRedditResilient } from "../reddit";

// Mock dependencies
vi.mock("@/lib/cache", () => ({
  cachedQuery: vi.fn((namespace, params, fn) => fn().then((data: unknown) => ({ data, cached: false }))),
  getRedditCacheTTL: vi.fn(() => 7200),
  CACHE_TTL: {
    REDDIT_SEARCH: 7200,
    REDDIT_HOT: 3600,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as never;

// Mock crypto for randomBytes
vi.mock("crypto", () => ({
  randomBytes: vi.fn(() => ({ toString: () => "mockrandom123" })),
}));

describe("reddit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SERPER_API_KEY", "");
    vi.stubEnv("APIFY_API_KEY", "");
  });

  describe("searchRedditResilient with Serper", () => {
    it("uses Serper as primary when configured", async () => {
      vi.stubEnv("SERPER_API_KEY", "test_serper_key");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            organic: [
              {
                link: "https://www.reddit.com/r/programming/comments/abc123/test/",
                title: "Test Post : programming",
                snippet: "Test content",
              },
            ],
          }),
      });

      const result = await searchRedditResilient("programming", ["javascript"], 50);

      expect(result.source).toBe("serper");
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it("builds correct search query for Serper", async () => {
      vi.stubEnv("SERPER_API_KEY", "test_key");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ organic: [] }),
      });

      await searchRedditResilient("startups", ["saas", "growth"], 50);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.q).toContain("site:reddit.com/r/startups");
      expect(callBody.q).toContain("saas");
      expect(callBody.q).toContain("growth");
    });
  });

  describe("searchRedditResilient with public API fallback", () => {
    it("uses public API as last resort when no providers configured", async () => {
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
                    url: "https://reddit.com/...",
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
      expect(result.error).toContain("public API");
    });
  });

  describe("error handling", () => {
    it("returns empty results when all providers fail", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await searchRedditResilient("test", [], 50);

      expect(result.posts).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it("logs warnings when providers fail", async () => {
      vi.stubEnv("SERPER_API_KEY", "test_key");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Error"),
      });

      await searchRedditResilient("test", [], 50);

      const { logger } = await import("@/lib/logger");
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("caching", () => {
    it("uses cached results when available", async () => {
      const { cachedQuery } = await import("@/lib/cache");

      // Mock cache hit
      vi.mocked(cachedQuery).mockResolvedValueOnce({
        data: [
          {
            id: "cached_post",
            title: "Cached",
            selftext: "",
            author: "test",
            subreddit: "test",
            permalink: "/test",
            url: "https://reddit.com/test",
            score: 1,
            num_comments: 0,
            created_utc: 1704067200,
          },
        ],
        cached: true,
      } as never);

      vi.stubEnv("SERPER_API_KEY", "test_key");

      const result = await searchRedditResilient("test", [], 50);

      expect(result.posts.length).toBeGreaterThan(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("result transformation", () => {
    it("transforms Serper results correctly", async () => {
      vi.stubEnv("SERPER_API_KEY", "test_key");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            organic: [
              {
                link: "https://www.reddit.com/r/startups/comments/xyz789/my-post/",
                title: "My Post - Reddit",
                snippet: "This is the content",
              },
            ],
          }),
      });

      const result = await searchRedditResilient("startups", [], 10);

      expect(result.posts[0].id).toBe("xyz789");
      expect(result.posts[0].subreddit).toBe("startups");
      expect(result.posts[0].title).not.toContain(" - Reddit");
    });
  });
});
