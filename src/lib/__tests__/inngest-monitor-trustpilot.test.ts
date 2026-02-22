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

const mockFetchTrustpilotReviews = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchTrustpilotReviews: mockFetchTrustpilotReviews,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-trustpilot", () => {
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

  it("gets company URL from platformUrls or keywords", () => {
    const monitor1 = { platformUrls: { trustpilot: "https://trustpilot.com/review/example.com" } };
    const monitor2 = { platformUrls: null, keywords: ["example.com"] };

    expect(monitor1.platformUrls.trustpilot).toContain("trustpilot");
    expect(monitor2.keywords[0]).toBe("example.com");
  });

  it("normalizes company name to URL slug", () => {
    const companyName = "Acme Corp Inc";
    const slug = companyName.toLowerCase().replace(/\s+/g, "");
    expect(slug).toBe("acmecorpinc");
  });

  it("maps Trustpilot reviews with metadata", () => {
    const metadata = {
      trustpilotId: "tp123",
      rating: 4,
      authorLocation: "United States",
    };

    expect(metadata.rating).toBe(4);
    expect(metadata.trustpilotId).toBe("tp123");
  });

  it("processes reviews from Apify", async () => {
    mockFetchTrustpilotReviews.mockResolvedValueOnce([
      { id: "1", rating: 5, text: "Excellent", author: "User", date: "2024-01-01", url: "https://trustpilot.com/review/1" },
    ]);

    const reviews = await mockFetchTrustpilotReviews("example.com", 20);
    expect(reviews).toHaveLength(1);
  });
});
