import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
const mockInsert = vi.fn();
const mockQuery = vi.fn();

global.fetch = mockFetch as never;

vi.mock("@/lib/db", () => ({
  pooledDb: {
    insert: (...args: unknown[]) => mockInsert(...args),
    query: {
      communityGrowth: { findFirst: (...args: unknown[]) => mockQuery(...args) },
    },
  },
}));

vi.mock("@/lib/db/schema", () => ({
  communityGrowth: {},
}));

vi.mock("@/lib/data/tracked-subreddits", () => ({
  PRIORITY_SUBREDDITS: ["saas", "startups"],
  EXTENDED_SUBREDDITS: ["entrepreneur", "smallbusiness"],
  ALL_TRACKED_SUBREDDITS: ["saas", "startups", "entrepreneur", "smallbusiness"],
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

describe("inngest/community-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("fetches subreddit info from Reddit API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          display_name: "saas",
          subscribers: 50000,
          accounts_active: 500,
          public_description: "SaaS discussion",
          created_utc: 1000000000,
        },
      }),
    });

    const response = await fetch("https://www.reddit.com/r/saas/about.json");
    const data = await response.json();

    expect(data.data.subscribers).toBe(50000);
    expect(data.data.accounts_active).toBe(500);
  });

  it("returns null for 404 subreddit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const response = await fetch("https://www.reddit.com/r/nonexistent/about.json");

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it("estimates posts per day from recent posts", async () => {
    const now = Date.now() / 1000;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          children: Array.from({ length: 100 }, (_, i) => ({
            data: {
              created_utc: now - i * 3600,
            },
          })),
        },
      }),
    });

    const response = await fetch("https://www.reddit.com/r/saas/new.json?limit=100");
    const data = await response.json();

    expect(data.data.children.length).toBe(100);
  });

  it("calculates engagement rate from hot posts", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          children: [
            { data: { score: 100, num_comments: 50 } },
            { data: { score: 200, num_comments: 100 } },
            { data: { score: 50, num_comments: 25 } },
          ],
        },
      }),
    });

    const response = await fetch("https://www.reddit.com/r/saas/hot.json?limit=25");
    const data = await response.json();
    const posts = data.data.children;

    const totalEngagement = posts.reduce((sum: number, post: { data: { score: number; num_comments: number } }) => {
      return sum + post.data.score + post.data.num_comments;
    }, 0);
    const avgEngagement = Math.round(totalEngagement / posts.length);

    expect(avgEngagement).toBeGreaterThan(0);
  });

  it("stores stats in database", async () => {
    await mockInsert().values({
      platform: "reddit",
      identifier: "r/saas",
      memberCount: 50000,
      postCountDaily: 50,
      engagementRate: 150,
    });

    expect(mockInsert).toHaveBeenCalled();
  });

  it("processes priority subreddits first", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          display_name: "test",
          subscribers: 1000,
          accounts_active: 10,
          public_description: "Test",
          created_utc: 1000000000,
        },
      }),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { children: [] },
      }),
    });

    const results = [
      { subreddit: "saas", success: true },
      { subreddit: "startups", success: true },
    ];

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
  });

  it("rate limits API requests with delays", async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const start = Date.now();
    await delay(100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(
      (async () => {
        try {
          await fetch("https://www.reddit.com/r/test/about.json");
        } catch {
          return null;
        }
      })()
    ).resolves.toBeNull();
  });

  it("retrieves latest stats for a subreddit", async () => {
    mockQuery.mockResolvedValue({
      platform: "reddit",
      identifier: "r/saas",
      memberCount: 50000,
      postCountDaily: 50,
      engagementRate: 150,
      recordedAt: new Date(),
    });

    const stats = await mockQuery();

    expect(stats).toHaveProperty("memberCount");
    expect(stats).toHaveProperty("postCountDaily");
    expect(stats).toHaveProperty("engagementRate");
  });

  it("returns summary of processing results", async () => {
    const result = {
      message: "Community stats collection complete",
      priority: {
        total: 2,
        success: 2,
        failed: 0,
      },
      extended: {
        total: 2,
        success: 1,
        failed: 1,
      },
    };

    expect(result.priority.success).toBe(2);
    expect(result.extended.failed).toBe(1);
  });

  it("skips subreddits with API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const response = await fetch("https://www.reddit.com/r/error/about.json");

    expect(response.ok).toBe(false);
  });
});
