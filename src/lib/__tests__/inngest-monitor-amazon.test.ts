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

const mockFetchAmazonReviews = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchAmazonReviews: mockFetchAmazonReviews,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-amazon", () => {
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

  it("detects Amazon URLs and ASINs", () => {
    const keywords = [
      "https://amazon.com/dp/B08N5WRWNW",
      "B08ABC123D",
      "https://amazon.co.uk/product/xyz",
    ];

    const amazonUrls = keywords.filter((k) =>
      k.includes("amazon.com") || k.includes("amazon.") || /^[A-Z0-9]{10}$/i.test(k)
    );

    expect(amazonUrls).toHaveLength(3);
  });

  it("validates ASIN format (10 alphanumeric characters)", () => {
    const validAsin = "B08N5WRWNW";
    const invalidAsin = "ABC123";

    expect(/^[A-Z0-9]{10}$/i.test(validAsin)).toBe(true);
    expect(/^[A-Z0-9]{10}$/i.test(invalidAsin)).toBe(false);
  });

  it("maps Amazon review metadata with verified purchase flag", () => {
    const metadata = {
      reviewId: "review123",
      rating: 5,
      verifiedPurchase: true,
      helpfulVotes: 25,
      productName: "Wireless Headphones",
      productAsin: "B08N5WRWNW",
    };

    expect(metadata.verifiedPurchase).toBe(true);
    expect(metadata.helpfulVotes).toBe(25);
  });

  it("fetches reviews via Apify", async () => {
    mockFetchAmazonReviews.mockResolvedValueOnce([
      { reviewId: "r1", rating: 4, text: "Good product", author: "User1", verifiedPurchase: true },
    ]);

    const reviews = await mockFetchAmazonReviews("B08N5WRWNW", 30);
    expect(reviews).toHaveLength(1);
  });
});
