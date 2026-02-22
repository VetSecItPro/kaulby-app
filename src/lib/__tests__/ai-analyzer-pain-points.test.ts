import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();
const mockBuildAnalysisPrompt = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildAnalysisPrompt: (...args: unknown[]) => mockBuildAnalysisPrompt(...args),
}));

describe("ai/analyzers/pain-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildAnalysisPrompt.mockReturnValue({
      system: "Pain point detection system prompt",
      user: "Content to analyze",
    });
  });

  it("detects competitor_mention", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "competitor_mention",
        confidence: 0.9,
        keywords: ["Competitor X", "switching from"],
        summary: "User considering switch from Competitor X",
        businessAction: "respond",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.006,
        latencyMs: 1400,
        promptTokens: 250,
        completionTokens: 100,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("Thinking of switching from Competitor X");

    expect(result.result.category).toBe("competitor_mention");
    expect(result.result.keywords).toContain("Competitor X");
    expect(result.result.businessAction).toBe("respond");
  });

  it("detects pricing_concern", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "pricing_concern",
        confidence: 0.85,
        keywords: ["too expensive", "pricing"],
        summary: "User finds pricing too high",
        businessAction: "escalate",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.005,
        latencyMs: 1200,
        promptTokens: 220,
        completionTokens: 85,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("This tool is way too expensive for what it does");

    expect(result.result.category).toBe("pricing_concern");
    expect(result.result.keywords).toContain("too expensive");
  });

  it("detects feature_request", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "feature_request",
        confidence: 0.88,
        keywords: ["dark mode", "feature request"],
        summary: "User requesting dark mode feature",
        businessAction: "monitor",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0055,
        latencyMs: 1300,
        promptTokens: 235,
        completionTokens: 92,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("Would love to see dark mode added!");

    expect(result.result.category).toBe("feature_request");
    expect(result.result.summary).toContain("dark mode");
  });

  it("detects negative_experience", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "negative_experience",
        confidence: 0.92,
        keywords: ["bugs", "crashes", "terrible"],
        summary: "User experiencing frequent crashes and bugs",
        businessAction: "escalate",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0058,
        latencyMs: 1250,
        promptTokens: 240,
        completionTokens: 95,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("App crashes all the time, terrible experience");

    expect(result.result.category).toBe("negative_experience");
    expect(result.result.businessAction).toBe("escalate");
  });

  it("detects support_need", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "support_need",
        confidence: 0.87,
        keywords: ["help", "not working"],
        summary: "User needs help with feature not working",
        businessAction: "respond",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0052,
        latencyMs: 1150,
        promptTokens: 225,
        completionTokens: 88,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("Need help, export feature not working");

    expect(result.result.category).toBe("support_need");
    expect(result.result.keywords).toContain("not working");
  });

  it("detects positive_feedback", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "positive_feedback",
        confidence: 0.91,
        keywords: ["love", "amazing", "best"],
        summary: "User loves the product",
        businessAction: "log",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0048,
        latencyMs: 1100,
        promptTokens: 215,
        completionTokens: 82,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("Love this product, best tool I've used!");

    expect(result.result.category).toBe("positive_feedback");
    expect(result.result.businessAction).toBe("log");
  });

  it("detects general_discussion", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "general_discussion",
        confidence: 0.6,
        keywords: [],
        summary: "Generic discussion about industry",
        businessAction: "log",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.004,
        latencyMs: 950,
        promptTokens: 190,
        completionTokens: 70,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("Just discussing industry trends");

    expect(result.result.category).toBe("general_discussion");
    expect(result.result.confidence).toBeLessThan(0.7);
  });

  it("returns null category for no clear pain point", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: null,
        confidence: 0.3,
        keywords: [],
        summary: "No clear business relevance",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.003,
        latencyMs: 850,
        promptTokens: 170,
        completionTokens: 60,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("Random unrelated content");

    expect(result.result.category).toBeNull();
  });

  it("includes all metadata fields", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "feature_request",
        confidence: 0.8,
        keywords: ["api"],
        summary: "API request",
        businessAction: "monitor",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0051,
        latencyMs: 1180,
        promptTokens: 230,
        completionTokens: 87,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    const result = await analyzePainPoints("Need API access");

    expect(result.meta).toHaveProperty("model");
    expect(result.meta).toHaveProperty("cost");
    expect(result.meta).toHaveProperty("latencyMs");
    expect(result.meta).toHaveProperty("promptTokens");
    expect(result.meta).toHaveProperty("completionTokens");
  });

  it("calls buildAnalysisPrompt with correct type", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: "general_discussion",
        confidence: 0.5,
        keywords: [],
        summary: "Test",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.004,
        latencyMs: 1000,
        promptTokens: 200,
        completionTokens: 75,
      },
    });

    const { analyzePainPoints } = await import("@/lib/ai/analyzers/pain-points");

    await analyzePainPoints("Test content");

    expect(mockBuildAnalysisPrompt).toHaveBeenCalledWith("painPointDetection", "Test content");
  });
});
