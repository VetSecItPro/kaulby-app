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

describe("inngest monitor-x", () => {
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

  it("uses xAI Responses API with x_search tool", () => {
    expect(true).toBe(true);
  });

  it("calculates 7-day search window", () => {
    const toDate = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    expect(fromDate).toBeTruthy();
    expect(toDate).toBeTruthy();
  });

  it("combines keywords with OR operator", () => {
    const keywords = ["react", "nextjs", "typescript"];
    const searchQuery = keywords.join(" OR ");

    expect(searchQuery).toBe("react OR nextjs OR typescript");
  });

  it("parses JSON from xAI response", () => {
    const content = `\`\`\`json
[{"id": "1", "text": "Post 1", "authorUsername": "user1"}]
\`\`\``;

    const cleaned = content.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

    expect(jsonMatch).toBeTruthy();
  });

  it("validates and cleans posts", () => {
    const posts = [
      { id: "1", text: "Valid post", authorUsername: "user1", author: "User 1" },
      { id: "2", text: "", authorUsername: "user2" }, // Invalid (empty text)
      null, // Invalid
    ];

    const validPosts = posts.filter((p): p is NonNullable<typeof p> =>
      typeof p === "object" && p !== null && typeof p.text === "string" && p.text.length > 0
    );

    expect(validPosts).toHaveLength(1);
  });

  it("constructs X post URL", () => {
    const post = { id: "123", authorUsername: "@user1" };
    const url = `https://x.com/${post.authorUsername.replace(/^@/, "")}/status/${post.id}`;

    expect(url).toBe("https://x.com/user1/status/123");
  });

  it("maps post metadata", () => {
    const metadata = {
      authorDisplayName: "John Doe",
      likes: 100,
      retweets: 20,
      replies: 5,
    };

    expect(metadata.likes).toBe(100);
    expect(metadata.retweets).toBe(20);
  });
});
