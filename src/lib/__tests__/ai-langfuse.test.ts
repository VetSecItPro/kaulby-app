import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrace = vi.fn().mockReturnValue({ id: "trace-456" });
const mockFlushAsync = vi.fn().mockResolvedValue(undefined);
const mockShutdownAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("langfuse", () => ({
  Langfuse: class MockLangfuse {
    trace = mockTrace;
    flushAsync = mockFlushAsync;
    shutdownAsync = mockShutdownAsync;
  },
}));

describe("ai/langfuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "pk_test");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "sk_test");
    vi.stubEnv("LANGFUSE_HOST", "https://cloud.langfuse.com");
  });

  it("creates trace with name and userId", async () => {
    const { createTrace } = await import("@/lib/ai/langfuse");

    const trace = createTrace({
      name: "sentiment-analysis",
      userId: "user-123",
      metadata: { platform: "reddit" },
      tags: ["production"],
    });

    expect(trace).toHaveProperty("id");
    expect(mockTrace).toHaveBeenCalledWith({
      name: "sentiment-analysis",
      userId: "user-123",
      metadata: { platform: "reddit" },
      tags: ["production"],
    });
  });

  it("returns mock trace when Langfuse not configured", async () => {
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "");

    const { createTrace } = await import("@/lib/ai/langfuse");

    const trace = createTrace({
      name: "test",
    });

    expect(trace.id).toMatch(/^mock-trace-/);
    expect(mockTrace).not.toHaveBeenCalled();
  });

  it("exports langfuse client with trace method", async () => {
    const { langfuse } = await import("@/lib/ai/langfuse");

    expect(langfuse).toHaveProperty("trace");
    expect(langfuse).toHaveProperty("flushAsync");
    expect(langfuse).toHaveProperty("shutdownAsync");
  });

  it("langfuse.flushAsync calls underlying client", async () => {
    const { langfuse } = await import("@/lib/ai/langfuse");

    await langfuse.flushAsync();

    expect(mockFlushAsync).toHaveBeenCalled();
  });

  it("creates trace without optional parameters", async () => {
    const { createTrace } = await import("@/lib/ai/langfuse");

    const trace = createTrace({ name: "minimal" });

    expect(trace).toHaveProperty("id");
    expect(mockTrace).toHaveBeenCalledWith({
      name: "minimal",
      userId: undefined,
      metadata: undefined,
      tags: undefined,
    });
  });
});
