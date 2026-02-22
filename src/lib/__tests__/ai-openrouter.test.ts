import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a shared mock for OpenAI's chat.completions.create
const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

vi.mock("langfuse", () => ({
  observeOpenAI: vi.fn((client: unknown) => client),
}));

vi.mock("../ai/langfuse", () => ({
  langfuse: {
    flushAsync: vi.fn(),
  },
}));

// Set env vars - no Langfuse to avoid wrapping
vi.stubEnv("OPENROUTER_API_KEY", "test-key");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
vi.stubEnv("LANGFUSE_SECRET_KEY", "");

describe("ai/openrouter", () => {
  let openrouterModule: typeof import("../ai/openrouter");

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    openrouterModule = await import("../ai/openrouter");
  });

  describe("MODELS", () => {
    it("has primary, fallback, and premium models defined", () => {
      expect(openrouterModule.MODELS.primary).toBeTruthy();
      expect(openrouterModule.MODELS.fallback).toBeTruthy();
      expect(openrouterModule.MODELS.premium).toBeTruthy();
    });

    it("uses Gemini Flash for all tiers", () => {
      expect(openrouterModule.MODELS.primary).toContain("gemini");
      expect(openrouterModule.MODELS.fallback).toContain("gemini");
      expect(openrouterModule.MODELS.premium).toContain("gemini");
    });
  });

  describe("calculateCost", () => {
    it("calculates cost for Gemini Flash model", () => {
      const cost = openrouterModule.calculateCost(
        "google/gemini-2.5-flash",
        1_000_000,
        1_000_000
      );
      expect(cost).toBeCloseTo(0.375, 3);
    });

    it("returns 0 for unknown model", () => {
      const cost = openrouterModule.calculateCost(
        "unknown/model" as never,
        1000,
        1000
      );
      expect(cost).toBe(0);
    });

    it("calculates proportional cost for partial tokens", () => {
      const cost = openrouterModule.calculateCost(
        "google/gemini-2.5-flash",
        500_000,
        500_000
      );
      expect(cost).toBeCloseTo(0.1875, 3);
    });

    it("returns 0 for zero tokens", () => {
      const cost = openrouterModule.calculateCost(
        "google/gemini-2.5-flash",
        0,
        0
      );
      expect(cost).toBe(0);
    });

    it("calculates legacy model costs correctly", () => {
      const cost = openrouterModule.calculateCost(
        "anthropic/claude-sonnet-4",
        1_000_000,
        1_000_000
      );
      expect(cost).toBeCloseTo(18.0, 1);
    });
  });

  describe("completion", () => {
    it("returns content and metadata on success", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "AI response here" } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      const result = await openrouterModule.completion({
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(result.content).toBe("AI response here");
      expect(result.promptTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.cost).toBe("number");
    });

    it("uses default model and temperature", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      await openrouterModule.completion({
        messages: [{ role: "user", content: "test" }],
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: openrouterModule.MODELS.primary,
          temperature: 0.7,
          max_tokens: 1024,
        })
      );
    });

    it("returns empty string when no content in response", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
      });

      const result = await openrouterModule.completion({
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.content).toBe("");
    });

    it("handles missing usage gracefully", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "ok" } }],
        usage: null,
      });

      const result = await openrouterModule.completion({
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.promptTokens).toBe(0);
      expect(result.completionTokens).toBe(0);
    });

    it("respects custom temperature and maxTokens", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      await openrouterModule.completion({
        messages: [{ role: "user", content: "test" }],
        temperature: 0.1,
        maxTokens: 2048,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.1,
          max_tokens: 2048,
        })
      );
    });

    it("throws when a non-primary model fails (no fallback)", async () => {
      mockCreate.mockRejectedValue(new Error("Model unavailable"));

      await expect(
        openrouterModule.completion({
          messages: [{ role: "user", content: "test" }],
          model: "some-custom/model",
        })
      ).rejects.toThrow("Model unavailable");
    });

    it("includes model name in returned metadata", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await openrouterModule.completion({
        messages: [{ role: "user", content: "test" }],
        model: "some/model",
      });

      expect(result.model).toBe("some/model");
    });
  });

  describe("jsonCompletion", () => {
    it("parses JSON from code block", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '```json\n{"sentiment": "positive", "score": 0.8}\n```',
            },
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 20 },
      });

      const result = await openrouterModule.jsonCompletion<{ sentiment: string; score: number }>({
        messages: [{ role: "user", content: "analyze" }],
      });

      expect(result.data.sentiment).toBe("positive");
      expect(result.data.score).toBe(0.8);
      expect(result.meta.promptTokens).toBe(50);
    });

    it("parses raw JSON without code block", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"category": "pain_point", "confidence": 0.9}',
            },
          },
        ],
        usage: { prompt_tokens: 30, completion_tokens: 15 },
      });

      const result = await openrouterModule.jsonCompletion<{ category: string }>({
        messages: [{ role: "user", content: "categorize" }],
      });

      expect(result.data.category).toBe("pain_point");
    });

    it("uses lower temperature (0.3) for structured output", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"ok": true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      await openrouterModule.jsonCompletion({
        messages: [{ role: "user", content: "test" }],
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        })
      );
    });

    it("returns meta without content field", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"test": true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      const result = await openrouterModule.jsonCompletion({
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.meta).toHaveProperty("model");
      expect(result.meta).toHaveProperty("promptTokens");
      expect(result.meta).toHaveProperty("completionTokens");
      expect(result.meta).toHaveProperty("latencyMs");
      expect(result.meta).toHaveProperty("cost");
      expect(result.meta).not.toHaveProperty("content");
    });
  });
});
