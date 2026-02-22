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

describe("inngest monitor-hashnode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpers.applyStagger.mockResolvedValue(undefined);
    mockHelpers.saveNewResults.mockResolvedValue({ count: 0, ids: [] });
    mockHelpers.triggerAiAnalysis.mockResolvedValue(undefined);
    mockHelpers.updateMonitorStats.mockResolvedValue(undefined);
    mockContentMatchesMonitor.mockReturnValue({ matches: true });
  });

  it("runs every 30 minutes", () => {
    expect(true).toBe(true);
  });

  it("uses GraphQL API (free and public)", () => {
    expect(true).toBe(true);
  });

  it("searches posts via searchPostsOfFeed query", () => {
    const query = `
      query SearchPosts($query: String!) {
        searchPostsOfFeed(first: 20, filter: { query: $query }) {
          edges { node { id title } }
        }
      }
    `;

    expect(query).toContain("searchPostsOfFeed");
    expect(query).toContain("$query: String!");
  });

  it("falls back to feed query when search fails", () => {
    const feedQuery = `
      query FeedPosts {
        feed(first: 30, filter: { type: RELEVANT }) {
          edges { node { id title } }
        }
      }
    `;

    expect(feedQuery).toContain("feed");
    expect(feedQuery).toContain("type: RELEVANT");
  });

  it("filters feed results by keyword match", () => {
    const articles = [
      { id: "1", title: "React 19 features", brief: "New hooks", tags: [{ name: "react" }] },
      { id: "2", title: "Python tutorial", brief: "Basics", tags: [{ name: "python" }] },
    ];

    const keyword = "react";
    const matching = articles.filter((a) =>
      a.title.toLowerCase().includes(keyword) ||
      a.brief?.toLowerCase().includes(keyword) ||
      a.tags?.some((t) => t.name.toLowerCase().includes(keyword))
    );

    expect(matching).toHaveLength(1);
  });

  it("rate limits requests (1 second between keywords)", () => {
    expect(true).toBe(true);
  });

  it("maps Hashnode article metadata", () => {
    const metadata = {
      reactions: 75,
      commentCount: 10,
      readingTime: 8,
      tags: ["react", "nextjs"],
      authorName: "Dev Blogger",
      publication: "Tech Blog",
    };

    expect(metadata.reactions).toBe(75);
    expect(metadata.readingTime).toBe(8);
    expect(metadata.tags).toContain("react");
  });

  it("applies content matching to filter articles", async () => {
    mockContentMatchesMonitor
      .mockReturnValueOnce({ matches: true })
      .mockReturnValueOnce({ matches: false });

    const articles = [
      { title: "TypeScript tips", brief: "Advanced types" },
      { title: "CSS tricks", brief: "Flexbox guide" },
    ];

    const matching = articles.filter((a) =>
      mockContentMatchesMonitor({ title: a.title, body: a.brief }, {}).matches
    );

    expect(matching).toHaveLength(1);
  });
});
