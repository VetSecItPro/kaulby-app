import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
  MODELS: { primary: "google/gemini-2.5-flash" },
}));

vi.mock("@/lib/ai/prompts", () => ({
  SYSTEM_PROMPTS: {
    aiDiscovery: "You are an AI discovery analyzer...",
  },
}));

describe("ai/analyzers/ai-discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns match result with relevance score", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: true,
        relevanceScore: 0.85,
        matchType: "semantic",
        reasoning: "Content discusses alternative solutions",
        signals: ["looking for", "recommendation"],
        suggestedKeywords: ["alternatives", "comparison"],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.001,
        latencyMs: 1200,
        promptTokens: 300,
        completionTokens: 100,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    const result = await checkAIDiscoveryMatch(
      { title: "Looking for project management tool", body: "Any recommendations?" },
      "Find discussions about people searching for project management software",
      "Acme Corp"
    );

    expect(result.result.isMatch).toBe(true);
    expect(result.result.relevanceScore).toBe(0.85);
    expect(result.result.matchType).toBe("semantic");
    expect(result.meta.model).toBeTruthy();
  });

  it("truncates long body content to prevent token overflow", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: false,
        relevanceScore: 0.2,
        matchType: "none",
        reasoning: "Not relevant",
        signals: [],
        suggestedKeywords: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.001,
        latencyMs: 800,
        promptTokens: 200,
        completionTokens: 50,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    const longBody = "a".repeat(3000);
    await checkAIDiscoveryMatch(
      { title: "Test", body: longBody },
      "Test prompt",
      null
    );

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage.length).toBeLessThan(3000);
  });

  it("includes company name in context when provided", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: true,
        relevanceScore: 0.9,
        matchType: "direct",
        reasoning: "Mentions company by name",
        signals: ["Acme Corp"],
        suggestedKeywords: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.001,
        latencyMs: 1000,
        promptTokens: 250,
        completionTokens: 80,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    await checkAIDiscoveryMatch(
      { title: "Acme Corp alternatives", body: "Looking for something better" },
      "Find people unhappy with Acme Corp",
      "Acme Corp"
    );

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("Acme Corp");
  });

  it("works without company name", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: true,
        relevanceScore: 0.7,
        matchType: "contextual",
        reasoning: "Discusses pain points",
        signals: ["frustrated", "slow"],
        suggestedKeywords: ["performance"],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.001,
        latencyMs: 900,
        promptTokens: 220,
        completionTokens: 70,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    await checkAIDiscoveryMatch(
      { title: "Software too slow", body: "Really frustrated" },
      "Find people frustrated with performance",
      null
    );

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).not.toContain("Company/Brand");
  });

  it("includes platform and author metadata", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: false,
        relevanceScore: 0.3,
        matchType: "none",
        reasoning: "Off-topic",
        signals: [],
        suggestedKeywords: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.001,
        latencyMs: 700,
        promptTokens: 180,
        completionTokens: 40,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    await checkAIDiscoveryMatch(
      { title: "Test", body: "Content", platform: "reddit", author: "user123" },
      "Test",
      null
    );

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("Platform: reddit");
    expect(userMessage).toContain("Author: user123");
  });

  it("handles missing body gracefully", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: true,
        relevanceScore: 0.6,
        matchType: "direct",
        reasoning: "Title matches",
        signals: ["keyword"],
        suggestedKeywords: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.001,
        latencyMs: 600,
        promptTokens: 150,
        completionTokens: 60,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    await checkAIDiscoveryMatch(
      { title: "Keyword match" },
      "Find keyword",
      null
    );

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("Body: (no body)");
  });

  it("uses primary model for discovery matching", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: true,
        relevanceScore: 0.8,
        matchType: "semantic",
        reasoning: "Test",
        signals: [],
        suggestedKeywords: [],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.001,
        latencyMs: 1100,
        promptTokens: 280,
        completionTokens: 90,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    await checkAIDiscoveryMatch(
      { title: "Test" },
      "Test",
      null
    );

    const call = mockJsonCompletion.mock.calls[0][0];
    expect(call.model).toBe("google/gemini-2.5-flash");
  });

  it("returns all expected fields in result", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        isMatch: true,
        relevanceScore: 0.75,
        matchType: "contextual",
        reasoning: "Context matches discovery intent",
        signals: ["signal1", "signal2"],
        suggestedKeywords: ["keyword1", "keyword2"],
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0012,
        latencyMs: 1300,
        promptTokens: 320,
        completionTokens: 110,
      },
    });

    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");

    const result = await checkAIDiscoveryMatch(
      { title: "Test", body: "Content" },
      "Discovery prompt",
      null
    );

    expect(result.result).toHaveProperty("isMatch");
    expect(result.result).toHaveProperty("relevanceScore");
    expect(result.result).toHaveProperty("matchType");
    expect(result.result).toHaveProperty("reasoning");
    expect(result.result).toHaveProperty("signals");
    expect(result.result).toHaveProperty("suggestedKeywords");
    expect(result.meta).toHaveProperty("model");
    expect(result.meta).toHaveProperty("cost");
    expect(result.meta).toHaveProperty("latencyMs");
    expect(result.meta).toHaveProperty("promptTokens");
    expect(result.meta).toHaveProperty("completionTokens");
  });
});
