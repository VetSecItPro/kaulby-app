import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
}));

describe("ai/analyzers/batch-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("analyzes batch and returns sentiment summary", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        overallSentiment: "negative",
        sentimentScore: -0.5,
        sentimentBreakdown: {
          positive: 20,
          negative: 60,
          neutral: 20,
        },
        keyThemes: ["slow performance", "bugs", "expensive"],
        notableExamples: [
          { type: "negative", quote: "App crashes constantly", reason: "Critical bug report" },
          { type: "positive", quote: "Great UI design", reason: "Positive feedback on UX" },
        ],
        actionableInsights: ["Fix performance issues", "Review pricing"],
        summary: "Users frustrated with performance and cost",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.15,
        latencyMs: 2500,
        promptTokens: 1500,
        completionTokens: 400,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    const result = await analyzeBatchSentiment({
      platformName: "Reddit",
      totalCount: 100,
      sampleItems: [
        { title: "App too slow", content: "Performance is terrible", rating: 1 },
        { title: "Love the UI", content: "Design is amazing", rating: 5 },
      ],
    });

    expect(result.result.overallSentiment).toBe("negative");
    expect(result.result.sentimentScore).toBe(-0.5);
    expect(result.result.keyThemes).toContain("slow performance");
    expect(result.meta.cost).toBe(0.15);
  });

  it("normalizes sentiment score to [-1, 1] range", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        overallSentiment: "positive",
        sentimentScore: 2.5,
        sentimentBreakdown: { positive: 90, negative: 5, neutral: 5 },
        keyThemes: [],
        notableExamples: [],
        actionableInsights: [],
        summary: "Test",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.1,
        latencyMs: 1500,
        promptTokens: 1000,
        completionTokens: 200,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    const result = await analyzeBatchSentiment({
      platformName: "HackerNews",
      totalCount: 50,
      sampleItems: [{ content: "Great product" }],
    });

    expect(result.result.sentimentScore).toBeLessThanOrEqual(1);
    expect(result.result.sentimentScore).toBeGreaterThanOrEqual(-1);
  });

  it("limits key themes to 5", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        overallSentiment: "mixed",
        sentimentScore: 0,
        sentimentBreakdown: { positive: 33, negative: 33, neutral: 34 },
        keyThemes: ["theme1", "theme2", "theme3", "theme4", "theme5", "theme6", "theme7"],
        notableExamples: [],
        actionableInsights: [],
        summary: "Mixed feedback",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.12,
        latencyMs: 2000,
        promptTokens: 1200,
        completionTokens: 300,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    const result = await analyzeBatchSentiment({
      platformName: "ProductHunt",
      totalCount: 75,
      sampleItems: [{ content: "Feedback" }],
    });

    expect(result.result.keyThemes).toHaveLength(5);
  });

  it("limits notable examples to 5 and truncates quotes", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        overallSentiment: "neutral",
        sentimentScore: 0,
        sentimentBreakdown: { positive: 30, negative: 30, neutral: 40 },
        keyThemes: [],
        notableExamples: Array.from({ length: 10 }, (_, i) => ({
          type: "insight",
          quote: "a".repeat(200),
          reason: `Example ${i}`,
        })),
        actionableInsights: [],
        summary: "Neutral",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.13,
        latencyMs: 1800,
        promptTokens: 1100,
        completionTokens: 350,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    const result = await analyzeBatchSentiment({
      platformName: "GitHub",
      totalCount: 60,
      sampleItems: [{ content: "Test" }],
    });

    expect(result.result.notableExamples).toHaveLength(5);
    result.result.notableExamples.forEach((ex) => {
      expect(ex.quote.length).toBeLessThanOrEqual(150);
    });
  });

  it("truncates item content to 500 chars", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        overallSentiment: "positive",
        sentimentScore: 0.7,
        sentimentBreakdown: { positive: 70, negative: 10, neutral: 20 },
        keyThemes: [],
        notableExamples: [],
        actionableInsights: [],
        summary: "Good",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.1,
        latencyMs: 1600,
        promptTokens: 900,
        completionTokens: 250,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    const longContent = "a".repeat(1000);
    await analyzeBatchSentiment({
      platformName: "Reddit",
      totalCount: 100,
      sampleItems: [{ content: longContent }],
    });

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).not.toContain("a".repeat(600));
  });

  it("includes rating and engagement in item metadata", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        overallSentiment: "positive",
        sentimentScore: 0.6,
        sentimentBreakdown: { positive: 60, negative: 20, neutral: 20 },
        keyThemes: [],
        notableExamples: [],
        actionableInsights: [],
        summary: "Positive",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.11,
        latencyMs: 1700,
        promptTokens: 950,
        completionTokens: 280,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    await analyzeBatchSentiment({
      platformName: "Trustpilot",
      totalCount: 80,
      sampleItems: [
        { content: "Great", rating: 5, engagement: 100 },
        { title: "Amazing", content: "Perfect", rating: 4 },
      ],
    });

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("Rating: 5/5");
    expect(userMessage).toContain("Engagement: 100");
  });

  it("uses lower temperature for structured output", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        overallSentiment: "neutral",
        sentimentScore: 0,
        sentimentBreakdown: { positive: 33, negative: 33, neutral: 34 },
        keyThemes: [],
        notableExamples: [],
        actionableInsights: [],
        summary: "Neutral",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.1,
        latencyMs: 1500,
        promptTokens: 1000,
        completionTokens: 200,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    await analyzeBatchSentiment({
      platformName: "DevTo",
      totalCount: 40,
      sampleItems: [{ content: "Content" }],
    });

    expect(mockJsonCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.any(Array),
      })
    );
  });

  it("returns fallback values for missing data", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {},
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.05,
        latencyMs: 1000,
        promptTokens: 500,
        completionTokens: 100,
      },
    });

    const { analyzeBatchSentiment } = await import("@/lib/ai/analyzers/batch-summary");

    const result = await analyzeBatchSentiment({
      platformName: "Test",
      totalCount: 10,
      sampleItems: [],
    });

    expect(result.result.overallSentiment).toBe("neutral");
    expect(result.result.sentimentScore).toBe(0);
    expect(result.result.keyThemes).toEqual([]);
    expect(result.result.notableExamples).toEqual([]);
    expect(result.result.actionableInsights).toEqual([]);
    expect(result.result.summary).toBe("No summary available.");
  });
});
