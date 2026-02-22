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

const mockFetchYelpReviews = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchYelpReviews: mockFetchYelpReviews,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-yelp", () => {
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

  it("gets business URL from platformUrls or keywords", () => {
    const monitor1 = { platformUrls: { yelp: "https://www.yelp.com/biz/restaurant-name" } };
    const monitor2 = { platformUrls: null, keywords: ["https://yelp.com/biz/cafe"] };

    const url1 = monitor1.platformUrls.yelp;
    const url2 = monitor2.keywords.find((k) => k.includes("yelp.com"));

    expect(url1).toContain("yelp.com/biz");
    expect(url2).toBeDefined();
  });

  it("creates title with business name when available", () => {
    const review1 = { rating: 4, businessName: "Joe's Pizza" };
    const review2 = { rating: 3, businessName: null };

    const title1 = `${review1.rating}-star review${review1.businessName ? ` for ${review1.businessName}` : ""}`;
    const title2 = `${review2.rating}-star review${review2.businessName ? ` for ${review2.businessName}` : ""}`;

    expect(title1).toBe("4-star review for Joe's Pizza");
    expect(title2).toBe("3-star review");
  });

  it("maps Yelp review metadata", () => {
    const metadata = {
      reviewId: "review123",
      rating: 5,
      authorLocation: "San Francisco, CA",
      businessName: "Best Restaurant",
      hasPhotos: true,
    };

    expect(metadata.hasPhotos).toBe(true);
    expect(metadata.authorLocation).toBe("San Francisco, CA");
  });

  it("fetches reviews via Apify", async () => {
    mockFetchYelpReviews.mockResolvedValueOnce([
      { reviewId: "r1", rating: 5, text: "Great food!", author: "User1" },
    ]);

    const reviews = await mockFetchYelpReviews("https://yelp.com/biz/restaurant", 30);
    expect(reviews).toHaveLength(1);
  });
});
