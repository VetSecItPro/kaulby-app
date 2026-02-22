import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Langfuse before importing
const mockTrace = vi.fn().mockReturnValue({ id: "trace-123" });
const mockFlushAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("langfuse", () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: mockTrace,
    flushAsync: mockFlushAsync,
    shutdownAsync: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("ai/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("exports all expected functions and modules", async () => {
    const aiModule = await import("@/lib/ai");

    expect(aiModule).toHaveProperty("completion");
    expect(aiModule).toHaveProperty("jsonCompletion");
    expect(aiModule).toHaveProperty("MODELS");
    expect(aiModule).toHaveProperty("calculateCost");
    expect(aiModule).toHaveProperty("createTrace");
    expect(aiModule).toHaveProperty("langfuse");
    expect(aiModule).toHaveProperty("analyzeSentiment");
    expect(aiModule).toHaveProperty("analyzePainPoints");
    expect(aiModule).toHaveProperty("summarizeContent");
    expect(aiModule).toHaveProperty("categorizeConversation");
  });
});
