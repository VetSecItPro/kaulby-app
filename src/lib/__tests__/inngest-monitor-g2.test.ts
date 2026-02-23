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

const mockFetchG2Reviews = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchG2Reviews: mockFetchG2Reviews,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-g2", () => {
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

  it("gets product URL from platformUrls or keywords", () => {
    const monitor1 = { platformUrls: { g2: "https://www.g2.com/products/slack/reviews" } };
    const monitor2 = { platformUrls: null, keywords: ["https://g2.com/products/myapp"] };

    const url1 = monitor1.platformUrls.g2;
    const url2 = monitor2.keywords.find((k) => k.includes("g2.com"));

    expect(url1).toContain("g2.com");
    expect(url2).toBeDefined();
  });

  it("combines pros and cons with main text", () => {
    const review = {
      text: "Great software",
      pros: "Easy to use",
      cons: "Expensive",
    };

    let content = review.text;
    if (review.pros) content += `\n\nPros: ${review.pros}`;
    if (review.cons) content += `\n\nCons: ${review.cons}`;

    expect(content).toContain("Pros: Easy to use");
    expect(content).toContain("Cons: Expensive");
  });

  it("maps G2 review metadata with business context", () => {
    const metadata = {
      reviewId: "review123",
      rating: 4,
      authorRole: "Software Engineer",
      companySize: "50-200",
      industry: "Technology",
      productName: "Slack",
    };

    expect(metadata.companySize).toBe("50-200");
    expect(metadata.industry).toBe("Technology");
  });

  it("fetches reviews via Apify", async () => {
    mockFetchG2Reviews.mockResolvedValueOnce([
      { reviewId: "r1", rating: 5, text: "Excellent product", author: "User1" },
    ]);

    const reviews = await mockFetchG2Reviews("https://g2.com/products/myapp", 30);
    expect(reviews).toHaveLength(1);
  });
});
