import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
const mockJsonCompletion = vi.fn();

global.fetch = mockFetch as never;

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ai/analyzers/subreddit-finder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds subreddits using Reddit API and AI enhancement", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          children: [
            {
              data: {
                display_name: "saas",
                subscribers: 50000,
                public_description: "SaaS discussion",
                title: "SaaS",
              },
            },
            {
              data: {
                display_name: "startups",
                subscribers: 100000,
                public_description: "Startup community",
                title: "Startups",
              },
            },
          ],
        },
      }),
    });

    mockJsonCompletion.mockResolvedValue({
      data: {
        subreddits: [
          { name: "Entrepreneur", relevance: "high", reason: "Business discussions" },
          { name: "smallbusiness", relevance: "high", reason: "SMB focus" },
          { name: "business", relevance: "medium", reason: "General business" },
        ],
      },
    });

    const { findRelevantSubreddits } = await import("@/lib/ai/analyzers/subreddit-finder");

    const result = await findRelevantSubreddits("Acme Corp", ["saas", "startup"], 5);

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("filters subreddits with low subscriber count", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          children: [
            {
              data: {
                display_name: "popular",
                subscribers: 50000,
                public_description: "Popular",
                title: "Popular",
              },
            },
            {
              data: {
                display_name: "tiny",
                subscribers: 500,
                public_description: "Small sub",
                title: "Tiny",
              },
            },
          ],
        },
      }),
    });

    mockJsonCompletion.mockResolvedValue({
      data: { subreddits: [] },
    });

    const { findRelevantSubreddits } = await import("@/lib/ai/analyzers/subreddit-finder");

    const result = await findRelevantSubreddits("Test Corp", [], 10);

    expect(result).toContain("popular");
    expect(result).not.toContain("tiny");
  });

  it("handles Reddit API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    mockJsonCompletion.mockResolvedValue({
      data: {
        subreddits: [
          { name: "technology", relevance: "high", reason: "Tech focus" },
        ],
      },
    });

    const { findRelevantSubreddits } = await import("@/lib/ai/analyzers/subreddit-finder");

    const result = await findRelevantSubreddits("Tech Corp", [], 5);

    expect(result).toContain("technology");
  });

  it("prioritizes high relevance AI suggestions over medium", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { children: [] } }),
    });

    mockJsonCompletion.mockResolvedValue({
      data: {
        subreddits: [
          { name: "high1", relevance: "high", reason: "Perfect fit" },
          { name: "medium1", relevance: "medium", reason: "Okay fit" },
          { name: "high2", relevance: "high", reason: "Great match" },
        ],
      },
    });

    const { findRelevantSubreddits } = await import("@/lib/ai/analyzers/subreddit-finder");

    const result = await findRelevantSubreddits("Company", [], 10);

    const high1Index = result.indexOf("high1");
    const medium1Index = result.indexOf("medium1");

    if (high1Index !== -1 && medium1Index !== -1) {
      expect(high1Index).toBeLessThan(medium1Index);
    }
  });

  it("searches for multiple keywords", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  display_name: "keyword1sub",
                  subscribers: 5000,
                  public_description: "First keyword",
                  title: "Keyword 1",
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  display_name: "keyword2sub",
                  subscribers: 6000,
                  public_description: "Second keyword",
                  title: "Keyword 2",
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  display_name: "keyword3sub",
                  subscribers: 7000,
                  public_description: "Third keyword",
                  title: "Keyword 3",
                },
              },
            ],
          },
        }),
      });

    mockJsonCompletion.mockResolvedValue({
      data: { subreddits: [] },
    });

    const { findRelevantSubreddits } = await import("@/lib/ai/analyzers/subreddit-finder");

    await findRelevantSubreddits("Company", ["key1", "key2", "key3"], 10);

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("caches results for same company and keywords", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { children: [] } }),
    });

    mockJsonCompletion.mockResolvedValue({
      data: {
        subreddits: [{ name: "cached", relevance: "high", reason: "Test" }],
      },
    });

    const { findRelevantSubredditsCached } = await import("@/lib/ai/analyzers/subreddit-finder");

    const result1 = await findRelevantSubredditsCached("Company", ["key"], 5);
    const result2 = await findRelevantSubredditsCached("Company", ["key"], 5);

    expect(result1).toEqual(result2);
  });

  it("respects maxSubreddits limit", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: Array.from({ length: 20 }, (_, i) => ({
            data: {
              display_name: `sub${i}`,
              subscribers: 5000,
              public_description: "Test",
              title: `Sub ${i}`,
            },
          })),
        },
      }),
    });

    mockJsonCompletion.mockResolvedValue({
      data: {
        subreddits: Array.from({ length: 10 }, (_, i) => ({
          name: `aisub${i}`,
          relevance: "high",
          reason: "AI suggestion",
        })),
      },
    });

    const { findRelevantSubreddits } = await import("@/lib/ai/analyzers/subreddit-finder");

    const result = await findRelevantSubreddits("Company", [], 5);

    expect(result).toHaveLength(5);
  });

  it("handles AI suggestion errors", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: [
            {
              data: {
                display_name: "reddit_sub",
                subscribers: 10000,
                public_description: "From Reddit",
                title: "Reddit Sub",
              },
            },
          ],
        },
      }),
    });

    mockJsonCompletion.mockRejectedValue(new Error("AI error"));

    const { findRelevantSubreddits } = await import("@/lib/ai/analyzers/subreddit-finder");

    const result = await findRelevantSubreddits("Company", [], 5);

    expect(result).toContain("reddit_sub");
  });
});
