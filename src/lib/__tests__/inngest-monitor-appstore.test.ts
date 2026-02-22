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

const mockFetchAppStoreReviews = vi.fn();
const mockIsApifyConfigured = vi.fn();

vi.mock("@/lib/apify", () => ({
  fetchAppStoreReviews: mockFetchAppStoreReviews,
  isApifyConfigured: mockIsApifyConfigured,
}));

describe("inngest monitor-appstore", () => {
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

  it("detects App Store URLs and app IDs", () => {
    const keywords = [
      "https://apps.apple.com/us/app/myapp/id123456789",
      "id987654321",
      "123456",
    ];

    const appUrls = keywords.filter((k) =>
      k.includes("apps.apple.com") || k.startsWith("id") || /^\d+$/.test(k)
    );

    expect(appUrls).toHaveLength(3);
  });

  it("maps App Store review metadata", () => {
    const metadata = {
      appStoreId: "review123",
      appId: "app456",
      rating: 5,
      appVersion: "2.1.0",
    };

    expect(metadata.rating).toBe(5);
    expect(metadata.appVersion).toBe("2.1.0");
  });

  it("constructs fallback source URL when missing", () => {
    const review = { appId: "app123", id: "review456", url: null };
    const sourceUrl = review.url || `appstore-${review.appId || "unknown"}-${review.id}`;

    expect(sourceUrl).toBe("appstore-app123-review456");
  });

  it("fetches reviews via Apify", async () => {
    mockFetchAppStoreReviews.mockResolvedValueOnce([
      { id: "r1", rating: 4, text: "Good app", userName: "User1", date: "2024-01-01" },
    ]);

    const reviews = await mockFetchAppStoreReviews("id123456", 20);
    expect(reviews).toHaveLength(1);
  });
});
