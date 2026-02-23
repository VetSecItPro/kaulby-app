import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();
const mockBuildAnalysisPrompt = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildAnalysisPrompt: (...args: unknown[]) => mockBuildAnalysisPrompt(...args),
}));

describe("ai/analyzers/sentiment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildAnalysisPrompt.mockReturnValue({
      system: "Sentiment analysis system prompt",
      user: "Content to analyze",
    });
  });

  it("detects positive sentiment", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: "positive",
        score: 0.85,
        reasoning: "Expresses satisfaction and enthusiasm",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.003,
        latencyMs: 800,
        promptTokens: 150,
        completionTokens: 60,
      },
    });

    const { analyzeSentiment } = await import("@/lib/ai/analyzers/sentiment");

    const result = await analyzeSentiment("This product is amazing! Love it!");

    expect(result.result.sentiment).toBe("positive");
    expect(result.result.score).toBe(0.85);
    expect(result.result.reasoning).toContain("satisfaction");
  });

  it("detects negative sentiment", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: "negative",
        score: -0.7,
        reasoning: "Expresses frustration and dissatisfaction",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0032,
        latencyMs: 850,
        promptTokens: 160,
        completionTokens: 65,
      },
    });

    const { analyzeSentiment } = await import("@/lib/ai/analyzers/sentiment");

    const result = await analyzeSentiment("Terrible experience, totally disappointed");

    expect(result.result.sentiment).toBe("negative");
    expect(result.result.score).toBeLessThan(0);
  });

  it("detects neutral sentiment", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: "neutral",
        score: 0.05,
        reasoning: "Factual statement without strong emotion",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0028,
        latencyMs: 750,
        promptTokens: 140,
        completionTokens: 55,
      },
    });

    const { analyzeSentiment } = await import("@/lib/ai/analyzers/sentiment");

    const result = await analyzeSentiment("The app has a dark mode feature");

    expect(result.result.sentiment).toBe("neutral");
    expect(Math.abs(result.result.score)).toBeLessThan(0.3);
  });

  it("returns metadata with model and costs", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: "positive",
        score: 0.6,
        reasoning: "Positive tone",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0031,
        latencyMs: 820,
        promptTokens: 155,
        completionTokens: 62,
      },
    });

    const { analyzeSentiment } = await import("@/lib/ai/analyzers/sentiment");

    const result = await analyzeSentiment("Pretty good product");

    expect(result.meta).toHaveProperty("model");
    expect(result.meta).toHaveProperty("cost");
    expect(result.meta).toHaveProperty("latencyMs");
    expect(result.meta).toHaveProperty("promptTokens");
    expect(result.meta).toHaveProperty("completionTokens");
    expect(result.meta.model).toBe("google/gemini-2.5-flash");
    expect(result.meta.cost).toBeGreaterThan(0);
  });

  it("calls buildAnalysisPrompt with correct type", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: "neutral",
        score: 0,
        reasoning: "Neutral",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.003,
        latencyMs: 800,
        promptTokens: 150,
        completionTokens: 60,
      },
    });

    const { analyzeSentiment } = await import("@/lib/ai/analyzers/sentiment");

    await analyzeSentiment("Test content for sentiment");

    expect(mockBuildAnalysisPrompt).toHaveBeenCalledWith(
      "sentimentAnalysis",
      "Test content for sentiment"
    );
  });

  it("handles mixed sentiment", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: "neutral",
        score: 0.1,
        reasoning: "Contains both positive and negative elements",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0033,
        latencyMs: 880,
        promptTokens: 165,
        completionTokens: 68,
      },
    });

    const { analyzeSentiment } = await import("@/lib/ai/analyzers/sentiment");

    const result = await analyzeSentiment(
      "Good features but poor customer support"
    );

    expect(result.result.sentiment).toBe("neutral");
    expect(result.result.reasoning).toContain("positive and negative");
  });

  it("provides reasoning for sentiment classification", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: "positive",
        score: 0.9,
        reasoning: "Strong enthusiasm and recommendation",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0029,
        latencyMs: 790,
        promptTokens: 145,
        completionTokens: 58,
      },
    });

    const { analyzeSentiment } = await import("@/lib/ai/analyzers/sentiment");

    const result = await analyzeSentiment("Highly recommend! Best tool ever!");

    expect(result.result.reasoning).toBeTruthy();
    expect(result.result.reasoning.length).toBeGreaterThan(10);
  });
});
