import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();
const mockBuildAnalysisPrompt = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildAnalysisPrompt: (...args: unknown[]) => mockBuildAnalysisPrompt(...args),
}));

describe("ai/analyzers/conversation-category", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildAnalysisPrompt.mockReturnValue({
      system: "System prompt for categorization",
      user: "User content",
    });
  });

  it("categorizes as solution_request", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "solution_request",
        confidence: 0.9,
        signals: ["looking for", "recommendations", "best tool"],
        reasoning: "User actively seeking product recommendations",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.005,
        latencyMs: 1200,
        promptTokens: 200,
        completionTokens: 80,
      },
    });

    const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");

    const result = await categorizeConversation("Looking for the best project management tool");

    expect(result.result.category).toBe("solution_request");
    expect(result.result.confidence).toBe(0.9);
    expect(result.result.signals).toContain("looking for");
  });

  it("categorizes as pain_point", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "pain_point",
        confidence: 0.85,
        signals: ["frustrated", "broken", "doesn't work"],
        reasoning: "User expressing frustration with current solution",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.004,
        latencyMs: 1000,
        promptTokens: 180,
        completionTokens: 70,
      },
    });

    const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");

    const result = await categorizeConversation("Frustrated with my current tool, it's always broken");

    expect(result.result.category).toBe("pain_point");
    expect(result.result.signals).toContain("frustrated");
  });

  it("categorizes as money_talk", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "money_talk",
        confidence: 0.8,
        signals: ["budget", "pricing", "affordable"],
        reasoning: "Discussion about budget and pricing concerns",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0045,
        latencyMs: 1100,
        promptTokens: 190,
        completionTokens: 75,
      },
    });

    const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");

    const result = await categorizeConversation("Need something affordable, budget is tight");

    expect(result.result.category).toBe("money_talk");
  });

  it("categorizes as hot_discussion with high engagement", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "hot_discussion",
        confidence: 0.95,
        signals: ["trending", "viral", "high engagement"],
        reasoning: "High upvotes and comments indicate trending discussion",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.006,
        latencyMs: 1300,
        promptTokens: 220,
        completionTokens: 90,
      },
    });

    const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");

    const result = await categorizeConversation("Discussion about AI", {
      upvotes: 1500,
      commentCount: 250,
    });

    expect(result.result.category).toBe("hot_discussion");
    expect(result.result.confidence).toBeGreaterThan(0.9);
  });

  it("includes engagement metadata in context", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "advice_request",
        confidence: 0.75,
        signals: ["how to", "tips"],
        reasoning: "Seeking advice",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.004,
        latencyMs: 950,
        promptTokens: 170,
        completionTokens: 65,
      },
    });

    const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");

    await categorizeConversation("How to improve SEO?", {
      upvotes: 50,
      commentCount: 10,
    });

    expect(mockBuildAnalysisPrompt).toHaveBeenCalledWith(
      "conversationCategorization",
      expect.stringContaining("[Engagement:")
    );
  });

  it("defaults to advice_request for invalid category", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "invalid_category",
        confidence: 0.5,
        signals: [],
        reasoning: "Unknown",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.003,
        latencyMs: 800,
        promptTokens: 150,
        completionTokens: 50,
      },
    });

    const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");

    const result = await categorizeConversation("Random text");

    expect(result.result.category).toBe("advice_request");
    expect(result.result.confidence).toBe(0.3);
  });

  it("returns all expected metadata fields", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "solution_request",
        confidence: 0.88,
        signals: ["recommend"],
        reasoning: "Seeking recommendations",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0048,
        latencyMs: 1150,
        promptTokens: 195,
        completionTokens: 78,
      },
    });

    const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");

    const result = await categorizeConversation("Any recommendations?");

    expect(result.meta).toHaveProperty("model");
    expect(result.meta).toHaveProperty("cost");
    expect(result.meta).toHaveProperty("latencyMs");
    expect(result.meta).toHaveProperty("promptTokens");
    expect(result.meta).toHaveProperty("completionTokens");
  });

  it("validates all category types", async () => {
    const validCategories = ["pain_point", "solution_request", "advice_request", "money_talk", "hot_discussion"];

    for (const category of validCategories) {
      mockJsonCompletion.mockResolvedValue({
        data: {
          category,
          confidence: 0.8,
          signals: [],
          reasoning: "Test",
        },
        meta: {
          model: "google/gemini-2.5-flash",
          cost: 0.004,
          latencyMs: 1000,
          promptTokens: 180,
          completionTokens: 70,
        },
      });

      const { categorizeConversation } = await import("@/lib/ai/analyzers/conversation-category");
      const result = await categorizeConversation("Test");

      expect(result.result.category).toBe(category);
    }
  });
});
