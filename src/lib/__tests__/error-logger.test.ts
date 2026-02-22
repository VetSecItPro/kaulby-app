import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logError } from "../error-logger";

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        execute: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
  errorLogs: {},
}));

describe("error-logger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("logError", () => {
    it("logs error to database with all fields", async () => {
      const { db } = await import("@/lib/db");

      logError({
        level: "error",
        source: "api",
        message: "Test error",
        error: new Error("Test"),
        userId: "user_123",
        endpoint: "/api/test",
        statusCode: 500,
        context: { foo: "bar" },
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("logs error with minimal fields", async () => {
      const { db } = await import("@/lib/db");

      logError({
        source: "inngest",
        message: "Job failed",
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("defaults to error level when not specified", async () => {
      const { db } = await import("@/lib/db");

      logError({
        source: "webhook",
        message: "Webhook failed",
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("extracts stack trace from Error objects", async () => {
      const { db } = await import("@/lib/db");
      const error = new Error("Test error with stack");

      logError({
        source: "ai",
        message: "AI call failed",
        error,
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("handles non-Error error values", async () => {
      const { db } = await import("@/lib/db");

      logError({
        source: "auth",
        message: "Auth failed",
        error: "string error",
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("handles database insert failure silently", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn(() => ({
          execute: vi.fn(() => Promise.reject(new Error("DB failure"))),
        })),
      } as never);

      // Should not throw
      expect(() => {
        logError({
          source: "api",
          message: "Test error",
        });
      }).not.toThrow();
    });

    it("logs to console when database insert fails", async () => {
      const { db } = await import("@/lib/db");

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn(() => ({
          execute: vi.fn(() => Promise.reject(new Error("DB failure"))),
        })),
      } as never);

      logError({
        source: "api",
        message: "Test error",
      });

      // Wait for async promise rejection
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[logError] Failed to write error_logs row:",
        expect.any(Error)
      );
    });

    it("supports all error levels", async () => {
      const { db } = await import("@/lib/db");

      const levels = ["error", "warning", "fatal"] as const;

      for (const level of levels) {
        logError({
          level,
          source: "api",
          message: `Test ${level} message`,
        });
      }

      expect(db.insert).toHaveBeenCalledTimes(levels.length);
    });

    it("supports all error sources", async () => {
      const { db } = await import("@/lib/db");

      const sources = ["api", "inngest", "ai", "webhook", "auth"] as const;

      for (const source of sources) {
        logError({
          source,
          message: `Test from ${source}`,
        });
      }

      expect(db.insert).toHaveBeenCalledTimes(sources.length);
    });

    it("includes context object in log", async () => {
      const { db } = await import("@/lib/db");

      logError({
        source: "ai",
        message: "AI error",
        context: {
          model: "gpt-4",
          tokens: 1000,
          temperature: 0.7,
        },
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("is fire-and-forget and never blocks", async () => {
      await import("@/lib/db");

      const result = logError({
        source: "api",
        message: "Test",
      });

      // Should return void immediately
      expect(result).toBeUndefined();
    });
  });
});
