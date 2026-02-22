import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOG_LEVEL", "debug");
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  // Dynamic import to pick up env changes
  async function loadLogger() {
    // Force module reload by clearing cache
    vi.resetModules();
    const mod = await import("../logger");
    return mod.logger;
  }

  describe("debug", () => {
    it("logs debug messages in development", async () => {
      const logger = await loadLogger();
      logger.debug("Debug message");
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it("logs debug messages with context", async () => {
      const logger = await loadLogger();
      logger.debug("Debug with context", { foo: "bar" });
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "Debug with context",
        expect.objectContaining({ foo: "bar" })
      );
    });
  });

  describe("info", () => {
    it("logs info messages", async () => {
      const logger = await loadLogger();
      logger.info("Info message");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("logs info messages with context", async () => {
      const logger = await loadLogger();
      logger.info("Info with context", { userId: "123" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        "Info with context",
        expect.objectContaining({ userId: "123" })
      );
    });
  });

  describe("warn", () => {
    it("logs warning messages", async () => {
      const logger = await loadLogger();
      logger.warn("Warning message");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("logs warning messages with context", async () => {
      const logger = await loadLogger();
      logger.warn("Warning with context", { issue: "deprecated" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        "Warning with context",
        expect.objectContaining({ issue: "deprecated" })
      );
    });
  });

  describe("error", () => {
    it("logs error messages", async () => {
      const logger = await loadLogger();
      logger.error("Error message");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("logs error messages with context", async () => {
      const logger = await loadLogger();
      logger.error("Error with context", { errorCode: 500 });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        "Error with context",
        expect.objectContaining({ errorCode: 500 })
      );
    });
  });

  describe("PII redaction", () => {
    it("redacts email addresses", async () => {
      const logger = await loadLogger();
      logger.info("User login", { email: "user@example.com" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ email: "us***@example.com" })
      );
    });

    it("redacts passwords", async () => {
      const logger = await loadLogger();
      logger.info("Auth attempt", { password: "secret123" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ password: "sec***" })
      );
    });

    it("redacts tokens", async () => {
      const logger = await loadLogger();
      logger.info("API call", { token: "sk_live_1234567890" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ token: "sk_***" })
      );
    });

    it("redacts api keys", async () => {
      const logger = await loadLogger();
      logger.info("API configured", { apiKey: "key_abc123xyz" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ apiKey: "key***" })
      );
    });

    it("preserves non-sensitive fields", async () => {
      const logger = await loadLogger();
      logger.info("User action", { userId: "user_123", action: "login" });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ userId: "user_123", action: "login" })
      );
    });
  });

  describe("log injection prevention", () => {
    it("sanitizes newlines in messages", async () => {
      const logger = await loadLogger();
      logger.info("Message with\nnewline");
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).not.toContain("\n");
    });

    it("sanitizes control characters", async () => {
      const logger = await loadLogger();
      logger.info("Message with\rcontrol\tchars");
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("production mode", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("outputs JSON in production", async () => {
      const logger = await loadLogger();
      logger.info("Production message");

      const call = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(call)).not.toThrow();
    });

    it("includes timestamp in production JSON", async () => {
      const logger = await loadLogger();
      logger.info("Production message");

      const call = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(call);
      expect(parsed).toHaveProperty("timestamp");
    });

    it("includes level in production JSON", async () => {
      const logger = await loadLogger();
      logger.info("Production message");

      const call = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(call);
      expect(parsed.level).toBe("info");
    });

    it("includes message in production JSON", async () => {
      const logger = await loadLogger();
      logger.info("Production message");

      const call = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(call);
      expect(parsed.message).toBe("Production message");
    });

    it("includes context in production JSON", async () => {
      const logger = await loadLogger();
      logger.info("Production message", { foo: "bar" });

      const call = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(call);
      expect(parsed.context).toEqual({ foo: "bar" });
    });
  });

  describe("context sanitization", () => {
    it("recursively sanitizes nested objects", async () => {
      const logger = await loadLogger();
      logger.info("Nested context", {
        user: {
          email: "test@example.com",
          name: "Test User",
        },
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          user: expect.objectContaining({
            email: "te***@example.com",
            name: "Test User",
          }),
        })
      );
    });

    it("handles null values", async () => {
      const logger = await loadLogger();
      logger.info("Null value", { value: null });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ value: null })
      );
    });

    it("handles undefined values", async () => {
      const logger = await loadLogger();
      logger.info("Undefined value", { value: undefined });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("preserves numbers", async () => {
      const logger = await loadLogger();
      logger.info("Number value", { count: 42 });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ count: 42 })
      );
    });

    it("preserves booleans", async () => {
      const logger = await loadLogger();
      logger.info("Boolean value", { active: true });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ active: true })
      );
    });

    it("preserves arrays", async () => {
      const logger = await loadLogger();
      logger.info("Array value", { items: [1, 2, 3] });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ items: [1, 2, 3] })
      );
    });
  });
});
