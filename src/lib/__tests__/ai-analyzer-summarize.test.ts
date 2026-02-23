import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();
const mockBuildAnalysisPrompt = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildAnalysisPrompt: (...args: unknown[]) => mockBuildAnalysisPrompt(...args),
}));

describe("ai/analyzers/summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildAnalysisPrompt.mockReturnValue({
      system: "Summarization system prompt",
      user: "Content to summarize",
    });
  });

  it("generates summary with topics and urgency", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "User reports critical bug affecting data export",
        topics: ["bugs", "data export", "critical issue"],
        actionable: true,
        urgency: "high",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.004,
        latencyMs: 1100,
        promptTokens: 200,
        completionTokens: 85,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    const result = await summarizeContent(
      "The data export feature is completely broken and causing major issues for our team"
    );

    expect(result.result.summary).toContain("critical bug");
    expect(result.result.topics).toContain("bugs");
    expect(result.result.actionable).toBe(true);
    expect(result.result.urgency).toBe("high");
  });

  it("identifies non-actionable content", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "General discussion about industry trends",
        topics: ["trends", "discussion"],
        actionable: false,
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0035,
        latencyMs: 950,
        promptTokens: 180,
        completionTokens: 70,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    const result = await summarizeContent(
      "Just thinking about where the industry is heading"
    );

    expect(result.result.actionable).toBe(false);
    expect(result.result.urgency).toBeUndefined();
  });

  it("extracts key topics from content", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "Feature request for API access and better documentation",
        topics: ["API", "documentation", "feature request"],
        actionable: true,
        urgency: "medium",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0038,
        latencyMs: 1050,
        promptTokens: 190,
        completionTokens: 78,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    const result = await summarizeContent(
      "Would love to see API access and better docs for developers"
    );

    expect(result.result.topics).toContain("API");
    expect(result.result.topics).toContain("documentation");
    expect(result.result.topics.length).toBeGreaterThan(0);
  });

  it("assigns low urgency to non-critical issues", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "Minor UI improvement suggestion",
        topics: ["UI", "enhancement"],
        actionable: true,
        urgency: "low",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0033,
        latencyMs: 900,
        promptTokens: 170,
        completionTokens: 68,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    const result = await summarizeContent(
      "Would be nice to have a slightly larger font in the settings"
    );

    expect(result.result.urgency).toBe("low");
  });

  it("assigns medium urgency to moderate issues", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "Performance degradation in dashboard",
        topics: ["performance", "dashboard", "speed"],
        actionable: true,
        urgency: "medium",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0037,
        latencyMs: 1020,
        promptTokens: 185,
        completionTokens: 75,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    const result = await summarizeContent(
      "Dashboard is loading slower than usual lately"
    );

    expect(result.result.urgency).toBe("medium");
  });

  it("returns metadata with cost and timing", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "Test summary",
        topics: ["test"],
        actionable: false,
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0032,
        latencyMs: 880,
        promptTokens: 165,
        completionTokens: 65,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    const result = await summarizeContent("Test content");

    expect(result.meta).toHaveProperty("model");
    expect(result.meta).toHaveProperty("cost");
    expect(result.meta).toHaveProperty("latencyMs");
    expect(result.meta).toHaveProperty("promptTokens");
    expect(result.meta).toHaveProperty("completionTokens");
  });

  it("calls buildAnalysisPrompt with correct type", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "Summary",
        topics: [],
        actionable: false,
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.003,
        latencyMs: 850,
        promptTokens: 160,
        completionTokens: 60,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    await summarizeContent("Content to summarize");

    expect(mockBuildAnalysisPrompt).toHaveBeenCalledWith("summarize", "Content to summarize");
  });

  it("generates concise summaries", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        summary: "User needs help with billing",
        topics: ["billing", "support"],
        actionable: true,
        urgency: "high",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.0036,
        latencyMs: 980,
        promptTokens: 175,
        completionTokens: 72,
      },
    });

    const { summarizeContent } = await import("@/lib/ai/analyzers/summarize");

    const result = await summarizeContent(
      "I've been charged twice this month and can't get through to support. This is really frustrating and I need help ASAP."
    );

    expect(result.result.summary.length).toBeLessThan(200);
    expect(result.result.summary).toBeTruthy();
  });
});
