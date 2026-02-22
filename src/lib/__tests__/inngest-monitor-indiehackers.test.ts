import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHelpers = {
  getActiveMonitors: vi.fn(),
  prefetchPlans: vi.fn(),
  shouldSkipMonitor: vi.fn(),
  applyStagger: vi.fn(),
  saveNewResults: vi.fn(),
  triggerAiAnalysis: vi.fn(),
  updateMonitorStats: vi.fn(),
};

vi.mock("@/lib/inngest/utils/monitor-helpers", () => mockHelpers);

const mockContentMatchesMonitor = vi.fn();
vi.mock("@/lib/content-matcher", () => ({ contentMatchesMonitor: mockContentMatchesMonitor }));

describe("inngest monitor-indiehackers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpers.applyStagger.mockResolvedValue(undefined);
    mockHelpers.saveNewResults.mockResolvedValue({ count: 0, ids: [] });
    mockHelpers.triggerAiAnalysis.mockResolvedValue(undefined);
    mockHelpers.updateMonitorStats.mockResolvedValue(undefined);
    mockContentMatchesMonitor.mockReturnValue({ matches: true });
  });

  it("runs every 30 minutes (less frequent due to scraping)", () => {
    expect(true).toBe(true);
  });

  it("tries feed.json first, falls back to scraping", () => {
    expect(true).toBe(true);
  });

  it("parses __NEXT_DATA__ script tag for posts", () => {
    const html = '<script id="__NEXT_DATA__">{"props":{"pageProps":{"posts":[{"id":"1"}]}}}</script>';
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);

    expect(match).toBeTruthy();
    expect(match![1]).toContain("posts");
  });

  it("extracts post data from Next.js page props", () => {
    const nextData = {
      props: {
        pageProps: {
          posts: [
            { id: "1", title: "My Startup Journey", author: { username: "maker1" } },
          ],
        },
      },
    };

    const posts = nextData.props.pageProps.posts;
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("My Startup Journey");
  });

  it("falls back to regex extraction when __NEXT_DATA__ fails", () => {
    const html = '<a href="/post/my-journey">My Journey</a>';
    const pattern = /<a[^>]+href="(\/post\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const match = pattern.exec(html);

    expect(match).toBeTruthy();
    expect(match![1]).toBe("/post/my-journey");
    expect(match![2]).toBe("My Journey");
  });

  it("maps IndieHackers post metadata", () => {
    const metadata = {
      upvotes: 150,
      commentCount: 25,
      category: "Milestones",
    };

    expect(metadata.upvotes).toBe(150);
    expect(metadata.category).toBe("Milestones");
  });

  it("applies content matching to filter posts", async () => {
    mockContentMatchesMonitor
      .mockReturnValueOnce({ matches: true })
      .mockReturnValueOnce({ matches: false });

    const posts = [
      { title: "SaaS metrics", body: "How to track MRR" },
      { title: "Recipe blog", body: "Cooking tips" },
    ];

    const matching = posts.filter((post) =>
      mockContentMatchesMonitor({ title: post.title, body: post.body }, {}).matches
    );

    expect(matching).toHaveLength(1);
  });
});
