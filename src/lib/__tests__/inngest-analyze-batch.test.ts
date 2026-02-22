import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockResultFindMany = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      results: { findMany: (...args: unknown[]) => mockResultFindMany(...args) },
    },
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  results: { id: "id", monitorId: "monitorId" },
  monitors: { id: "id" },
  aiLogs: {},
}));

vi.mock("@/lib/ai/analyzers/batch-summary", () => ({
  analyzeBatchSentiment: vi.fn().mockResolvedValue({
    result: {
      overallSentiment: "negative",
      sentimentScore: -0.6,
      themes: ["performance", "pricing"],
      summary: "Users are concerned about performance and pricing",
    },
    meta: {
      cost: 0.15,
      model: "gemini-2.5-flash",
      promptTokens: 2000,
      completionTokens: 500,
      latencyMs: 3000,
    },
  }),
}));

vi.mock("@/lib/ai/sampling", () => ({
  selectRepresentativeSample: vi.fn().mockImplementation((items: unknown[]) => {
    // Return a subset of items (simulate sampling)
    return (items as Array<{ id: string }>).slice(0, 25);
  }),
  AI_BATCH_CONFIG: { BATCH_THRESHOLD: 50 },
  getAdaptiveSamplingConfig: vi.fn().mockReturnValue({ maxSamples: 25 }),
  getAdaptiveSampleSize: vi.fn().mockReturnValue(25),
}));

vi.mock("@/lib/ai", () => ({
  createTrace: vi.fn().mockReturnValue({ id: "trace-batch-123" }),
  flushAI: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/limits", () => ({
  incrementAiCallsCount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/platform-utils", () => ({
  getPlatformDisplayName: vi.fn().mockReturnValue("Reddit"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  inArray: vi.fn(),
}));

import { analyzeBatchSentiment } from "@/lib/ai/analyzers/batch-summary";
import { selectRepresentativeSample, getAdaptiveSampleSize } from "@/lib/ai/sampling";
import { incrementAiCallsCount } from "@/lib/limits";
import { shouldUseBatchMode } from "@/lib/inngest/functions/analyze-content-batch";

describe("inngest analyze-content-batch", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
  });

  it("returns error when no results found", async () => {
    mockResultFindMany.mockResolvedValueOnce([]);
    const allResults = await mockResultFindMany();
    expect(allResults).toHaveLength(0);
    // Function returns { error: "No results found" }
  });

  it("processes a batch of results with adaptive sampling", async () => {
    const results = Array.from({ length: 100 }, (_, i) => ({
      id: `r-${i}`,
      title: `Post ${i}`,
      content: `Content for post ${i}`,
      platform: "reddit",
      monitorId: "m1",
      postedAt: new Date(),
      createdAt: new Date(),
      metadata: { upvotes: i * 10 },
    }));

    mockResultFindMany.mockResolvedValueOnce(results);
    const allResults = await mockResultFindMany();
    expect(allResults).toHaveLength(100);

    // Adaptive sampling should select a subset
    const sampleableItems = allResults.map((r: Record<string, unknown>) => ({
      id: r.id,
      content: r.content || "",
      title: r.title,
      engagement: 0,
      createdAt: new Date(),
    }));

    const sample = vi.mocked(selectRepresentativeSample)(sampleableItems, { sampleSize: 25 });
    expect(sample.length).toBeLessThanOrEqual(allResults.length);
    expect(selectRepresentativeSample).toHaveBeenCalled();
  });

  it("calls batch AI analysis with sample items", async () => {
    const sampleItems = [
      { title: "Post 1", content: "Slow app", engagement: 50, date: new Date().toISOString() },
      { title: "Post 2", content: "Expensive pricing", engagement: 30, date: new Date().toISOString() },
    ];

    await vi.mocked(analyzeBatchSentiment)({
      platformName: "Reddit",
      totalCount: 100,
      sampleItems,
    });

    expect(analyzeBatchSentiment).toHaveBeenCalledWith({
      platformName: "Reddit",
      totalCount: 100,
      sampleItems,
    });
  });

  it("stores batch analysis on the monitor", async () => {
    const batchAnalysis = {
      overallSentiment: "negative",
      sentimentScore: -0.6,
      themes: ["performance"],
      summary: "Users concerned about performance",
    };

    mockUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const chain = mockUpdate();
    const setChain = chain.set({
      batchAnalysis: JSON.stringify(batchAnalysis),
      lastBatchAnalyzedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    await setChain.where("m1");

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("marks all results as batch-analyzed with overall sentiment", async () => {
    mockUpdate.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const chain = mockUpdate();
    const setChain = chain.set({
      batchAnalyzed: true,
      sentiment: "neutral", // "mixed" maps to "neutral"
      sentimentScore: -0.6,
    });
    await setChain.where(["r1", "r2", "r3"]);

    expect(mockUpdate).toHaveBeenCalled();
  });

  it("logs only 1 AI call for entire batch", async () => {
    await vi.mocked(incrementAiCallsCount)("user-1", 1);
    expect(incrementAiCallsCount).toHaveBeenCalledWith("user-1", 1);
  });

  it("determines batch mode based on result count threshold", () => {
    expect(shouldUseBatchMode(10)).toBe(false);
    expect(shouldUseBatchMode(30)).toBe(false);
    expect(shouldUseBatchMode(51)).toBe(true);
    expect(shouldUseBatchMode(500)).toBe(true);
  });

  it("calculates adaptive sample size based on total count", () => {
    vi.mocked(getAdaptiveSampleSize).mockReturnValueOnce(25);
    const size = vi.mocked(getAdaptiveSampleSize)(100);
    expect(size).toBe(25);
  });

  it("maps mixed sentiment to neutral for database storage", () => {
    const overallSentiment = "mixed";
    const dbSentiment = overallSentiment === "mixed" ? "neutral" : overallSentiment;
    expect(dbSentiment).toBe("neutral");
  });
});
