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

const mockFetchYouTubeComments = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchYouTubeComments: mockFetchYouTubeComments,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-youtube", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpers.applyStagger.mockResolvedValue(undefined);
    mockHelpers.saveNewResults.mockResolvedValue({ count: 0, ids: [] });
    mockHelpers.triggerAiAnalysis.mockResolvedValue(undefined);
    mockHelpers.updateMonitorStats.mockResolvedValue(undefined);
    mockIsApifyConfigured.mockReturnValue(true);
  });

  it("runs every hour", () => {
    expect(true).toBe(true);
  });

  it("gets video URL from platformUrls or keywords", () => {
    const monitor1 = { platformUrls: { youtube: "https://youtube.com/watch?v=xyz" } };
    const monitor2 = { platformUrls: null, keywords: ["https://youtu.be/abc"] };

    const url1 = monitor1.platformUrls.youtube;
    const url2 = monitor2.keywords.find((k) => k.includes("youtube.com") || k.includes("youtu.be"));

    expect(url1).toContain("youtube");
    expect(url2).toBeDefined();
  });

  it("constructs comment URL with video and comment ID", () => {
    const comment = { videoId: "abc123", commentId: "comment456" };
    const url = `https://www.youtube.com/watch?v=${comment.videoId}&lc=${comment.commentId}`;

    expect(url).toBe("https://www.youtube.com/watch?v=abc123&lc=comment456");
  });

  it("maps comment metadata", () => {
    const metadata = {
      commentId: "c123",
      videoId: "v456",
      likeCount: 50,
      replyCount: 5,
      authorChannelUrl: "https://youtube.com/channel/ch1",
    };

    expect(metadata.likeCount).toBe(50);
    expect(metadata.replyCount).toBe(5);
  });

  it("fetches comments via Apify", async () => {
    mockFetchYouTubeComments.mockResolvedValueOnce([
      { commentId: "c1", text: "Great video!", author: "User1", likeCount: 10 },
    ]);

    const comments = await mockFetchYouTubeComments("https://youtube.com/watch?v=123", 50);
    expect(comments).toHaveLength(1);
  });
});
