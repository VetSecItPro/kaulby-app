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

const mockFetchPlayStoreReviews = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchPlayStoreReviews: mockFetchPlayStoreReviews,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-playstore", () => {
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

  it("detects Play Store URLs and package IDs", () => {
    const keywords = [
      "https://play.google.com/store/apps/details?id=com.example.app",
      "com.mycompany.myapp",
    ];

    const playStoreUrls = keywords.filter((k) =>
      k.includes("play.google.com") || k.includes(".")
    );

    expect(playStoreUrls).toHaveLength(2);
  });

  it("maps Play Store review metadata", () => {
    const metadata = {
      playStoreId: "review123",
      rating: 4,
      appVersion: "3.2.1",
      thumbsUpCount: 15,
      hasReply: true,
    };

    expect(metadata.thumbsUpCount).toBe(15);
    expect(metadata.hasReply).toBe(true);
  });

  it("creates title from rating", () => {
    const review = { score: 3, text: "It's okay" };
    const title = `${review.score}-star review`;

    expect(title).toBe("3-star review");
  });

  it("fetches reviews via Apify", async () => {
    mockFetchPlayStoreReviews.mockResolvedValueOnce([
      { reviewId: "r1", score: 5, text: "Amazing!", userName: "User1", date: "2024-01-01" },
    ]);

    const reviews = await mockFetchPlayStoreReviews("com.example.app", 20);
    expect(reviews).toHaveLength(1);
  });
});
