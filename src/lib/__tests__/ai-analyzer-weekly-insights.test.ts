import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
}));

vi.mock("@/lib/ai/prompts", () => ({
  SYSTEM_PROMPTS: {
    weeklyInsights: "You are a weekly insights analyzer...",
  },
}));

describe("ai/analyzers/weekly-insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates weekly insights with trends and recommendations", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        headline: "Performance concerns dominate user feedback",
        keyTrends: [
          {
            trend: "Increasing performance complaints",
            evidence: "15 mentions of slow loading",
            implication: "May impact retention",
          },
          {
            trend: "Pricing questions rising",
            evidence: "10 pricing inquiries",
          },
        ],
        sentimentBreakdown: {
          positive: 30,
          negative: 50,
          neutral: 20,
          dominantSentiment: "negative",
          change: "More negative than last week",
        },
        topPainPoints: ["Slow performance", "Confusing pricing", "Missing features"],
        opportunities: [
          {
            type: "product",
            description: "Optimize dashboard loading",
            suggestedAction: "Profile and fix slow queries",
          },
        ],
        recommendations: [
          "Address performance issues urgently",
          "Clarify pricing tiers",
        ],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.08,
        latencyMs: 5000,
      },
    });

    const { generateWeeklyInsights } = await import("@/lib/ai/analyzers/weekly-insights");

    const results = [
      {
        title: "App too slow",
        content: "Dashboard takes forever to load",
        platform: "reddit",
        sentiment: "negative",
        painPointCategory: "performance",
        aiSummary: "Performance complaint",
      },
      {
        title: "Pricing question",
        content: "How much does Pro cost?",
        platform: "twitter",
        sentiment: "neutral",
        painPointCategory: null,
        aiSummary: null,
      },
    ];

    const result = await generateWeeklyInsights(results);

    expect(result.result.headline).toContain("Performance");
    expect(result.result.keyTrends).toHaveLength(2);
    expect(result.result.sentimentBreakdown.dominantSentiment).toBe("negative");
    expect(result.result.topPainPoints).toContain("Slow performance");
    expect(result.result.recommendations.length).toBeGreaterThan(0);
  });

  it("supplements AI sentiment with actual counts", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        headline: "Mixed feedback",
        keyTrends: [],
        sentimentBreakdown: {
          positive: 999,
          negative: 999,
          neutral: 999,
          dominantSentiment: "mixed",
        },
        topPainPoints: [],
        opportunities: [],
        recommendations: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.05,
        latencyMs: 3000,
      },
    });

    const { generateWeeklyInsights } = await import("@/lib/ai/analyzers/weekly-insights");

    const results = [
      { title: "Great", content: "Love it", platform: "reddit", sentiment: "positive", painPointCategory: null, aiSummary: null },
      { title: "Great", content: "Love it", platform: "reddit", sentiment: "positive", painPointCategory: null, aiSummary: null },
      { title: "Bad", content: "Hate it", platform: "reddit", sentiment: "negative", painPointCategory: null, aiSummary: null },
      { title: "Okay", content: "Meh", platform: "reddit", sentiment: "neutral", painPointCategory: null, aiSummary: null },
    ];

    const result = await generateWeeklyInsights(results);

    expect(result.result.sentimentBreakdown.positive).toBe(2);
    expect(result.result.sentimentBreakdown.negative).toBe(1);
    expect(result.result.sentimentBreakdown.neutral).toBe(1);
  });

  it("includes platform distribution in analysis", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        headline: "Multi-platform feedback",
        keyTrends: [],
        sentimentBreakdown: {
          positive: 5,
          negative: 3,
          neutral: 2,
          dominantSentiment: "positive",
        },
        topPainPoints: [],
        opportunities: [],
        recommendations: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.06,
        latencyMs: 3500,
      },
    });

    const { generateWeeklyInsights } = await import("@/lib/ai/analyzers/weekly-insights");

    const results = [
      { title: "Reddit post", content: "Test", platform: "reddit", sentiment: "positive", painPointCategory: null, aiSummary: null },
      { title: "Reddit post", content: "Test", platform: "reddit", sentiment: "positive", painPointCategory: null, aiSummary: null },
      { title: "HN post", content: "Test", platform: "hackernews", sentiment: "positive", painPointCategory: null, aiSummary: null },
      { title: "Twitter", content: "Test", platform: "twitter", sentiment: "negative", painPointCategory: null, aiSummary: null },
    ];

    await generateWeeklyInsights(results);

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("reddit: 2");
    expect(userMessage).toContain("hackernews: 1");
    expect(userMessage).toContain("twitter: 1");
  });

  it("limits sample to top 15 results", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        headline: "Large dataset",
        keyTrends: [],
        sentimentBreakdown: {
          positive: 20,
          negative: 30,
          neutral: 50,
          dominantSentiment: "neutral",
        },
        topPainPoints: [],
        opportunities: [],
        recommendations: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.07,
        latencyMs: 4000,
      },
    });

    const { generateWeeklyInsights } = await import("@/lib/ai/analyzers/weekly-insights");

    const results = Array.from({ length: 100 }, (_, i) => ({
      title: `Post ${i}`,
      content: "Content",
      platform: "reddit",
      sentiment: i % 2 === 0 ? "positive" : "negative",
      painPointCategory: null,
      aiSummary: null,
    }));

    await generateWeeklyInsights(results);

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    const matches = userMessage.match(/^\d+\./gm);
    expect(matches?.length).toBeLessThanOrEqual(15);
  });

  it("handles empty results array", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        headline: "No activity this week",
        keyTrends: [],
        sentimentBreakdown: {
          positive: 0,
          negative: 0,
          neutral: 0,
          dominantSentiment: "neutral",
        },
        topPainPoints: [],
        opportunities: [],
        recommendations: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.02,
        latencyMs: 1500,
      },
    });

    const { generateWeeklyInsights } = await import("@/lib/ai/analyzers/weekly-insights");

    const result = await generateWeeklyInsights([]);

    expect(result.result.sentimentBreakdown.positive).toBe(0);
    expect(result.result.sentimentBreakdown.negative).toBe(0);
    expect(result.result.sentimentBreakdown.neutral).toBe(0);
  });

  it("includes pain point categories in summary", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        headline: "Feature requests dominate",
        keyTrends: [],
        sentimentBreakdown: {
          positive: 10,
          negative: 5,
          neutral: 5,
          dominantSentiment: "positive",
        },
        topPainPoints: ["Missing feature X"],
        opportunities: [],
        recommendations: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.055,
        latencyMs: 3200,
      },
    });

    const { generateWeeklyInsights } = await import("@/lib/ai/analyzers/weekly-insights");

    const results = [
      { title: "Feature req", content: "Need X", platform: "reddit", sentiment: "neutral", painPointCategory: "feature_request", aiSummary: null },
      { title: "Feature req", content: "Need X", platform: "reddit", sentiment: "neutral", painPointCategory: "feature_request", aiSummary: null },
      { title: "Feature req", content: "Need X", platform: "reddit", sentiment: "neutral", painPointCategory: "feature_request", aiSummary: null },
    ];

    await generateWeeklyInsights(results);

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("feature_request: 3");
  });

  it("returns metadata with model and cost", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        headline: "Test",
        keyTrends: [],
        sentimentBreakdown: {
          positive: 1,
          negative: 1,
          neutral: 1,
          dominantSentiment: "neutral",
        },
        topPainPoints: [],
        opportunities: [],
        recommendations: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.04,
        latencyMs: 2500,
      },
    });

    const { generateWeeklyInsights } = await import("@/lib/ai/analyzers/weekly-insights");

    const result = await generateWeeklyInsights([
      { title: "Test", content: "Test", platform: "reddit", sentiment: "neutral", painPointCategory: null, aiSummary: null },
    ]);

    expect(result.meta).toHaveProperty("model");
    expect(result.meta).toHaveProperty("cost");
    expect(result.meta).toHaveProperty("latencyMs");
  });
});
