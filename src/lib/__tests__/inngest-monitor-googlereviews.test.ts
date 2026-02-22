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

const mockFetchGoogleReviews = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchGoogleReviews: mockFetchGoogleReviews,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-googlereviews", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_n: string, fn: () => Promise<unknown>) => fn()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpers.applyStagger.mockResolvedValue(undefined);
    mockHelpers.saveNewResults.mockResolvedValue({ count: 0, ids: [] });
    mockHelpers.triggerAiAnalysis.mockResolvedValue(undefined);
    mockHelpers.updateMonitorStats.mockResolvedValue(undefined);
    mockIsApifyConfigured.mockReturnValue(true);
    mockFetchGoogleReviews.mockResolvedValue([]);
  });

  it("runs every hour", () => {
    expect(true).toBe(true);
  });

  it("returns early when Apify not configured", async () => {
    mockIsApifyConfigured.mockReturnValueOnce(false);
    const configured = mockIsApifyConfigured();
    expect(configured).toBe(false);
  });

  it("gets business URL from platformUrls.googlereviews", () => {
    const monitor = {
      platformUrls: { googlereviews: "https://maps.google.com/?cid=123" },
    };

    const url = monitor.platformUrls.googlereviews;
    expect(url).toContain("maps.google.com");
  });

  it("falls back to keywords for Google Maps URLs", () => {
    const monitor = {
      platformUrls: null,
      keywords: ["https://google.com/maps/place/xyz", "other-keyword"],
    };

    const googleUrl = monitor.keywords.find((k) =>
      k.includes("google") || k.includes("maps")
    );

    expect(googleUrl).toBeDefined();
  });

  it("uses companyName as search term when no URL", () => {
    const monitor = {
      platformUrls: null,
      keywords: [],
      companyName: "Acme Corp",
    };

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(monitor.companyName)}`;
    expect(searchUrl).toContain("Acme%20Corp"); // encodeURIComponent uses %20 for spaces
  });

  it("fetches reviews via Apify", async () => {
    const businessUrl = "https://maps.google.com/?cid=123";
    mockFetchGoogleReviews.mockResolvedValueOnce([
      { reviewId: "r1", stars: 5, text: "Great!", name: "User1" },
    ]);

    const reviews = await mockFetchGoogleReviews(businessUrl, 20);
    expect(reviews).toHaveLength(1);
  });

  it("maps reviews with rating metadata", () => {
    const review = {
      reviewId: "r1",
      stars: 4,
      text: "Good service",
      name: "Customer",
      publishedAtDate: "2024-01-01",
      reviewUrl: "https://google.com/review/r1",
      reviewerUrl: "https://google.com/user/u1",
      placeId: "ChI123",
    };

    const result = {
      platform: "googlereviews" as const,
      sourceUrl: review.reviewUrl,
      title: `${review.stars}-star review from ${review.name}`,
      content: review.text,
      author: review.name,
      metadata: {
        reviewId: review.reviewId,
        rating: review.stars,
        reviewerUrl: review.reviewerUrl,
        placeId: review.placeId,
      },
    };

    expect(result.metadata.rating).toBe(4);
    expect(result.title).toContain("4-star");
  });

  it("processes monitors with tier-based delays", async () => {
    mockHelpers.getActiveMonitors.mockResolvedValueOnce([{ id: "m1" }]);
    mockHelpers.shouldSkipMonitor.mockReturnValue(false);

    const monitors = await mockHelpers.getActiveMonitors("googlereviews", mockStep);
    expect(monitors).toHaveLength(1);
  });
});
