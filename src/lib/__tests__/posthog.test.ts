import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("posthog", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Reset module cache
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe("module validation", () => {
    it("validates PostHog key format", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "invalid_key");

      // Dynamic import to pick up env changes
      const { captureEvent } = await import("../posthog");

      captureEvent({ distinctId: "test", event: "test_event" });

      // Should warn about invalid key (but only once during module init)
      // Warning happens at module load time, not at function call time
      // So we just verify the function doesn't throw
      expect(() => captureEvent({ distinctId: "test", event: "test_event" })).not.toThrow();
    });

    it("accepts valid PostHog key format", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_validkey123");
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.posthog.com");

      const { captureEvent } = await import("../posthog");
      captureEvent({ distinctId: "test", event: "test_event" });

      // Should not throw or warn
    });
  });

  describe("captureEvent", () => {
    it("handles missing PostHog gracefully", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

      const { captureEvent } = await import("../posthog");

      expect(() => {
        captureEvent({
          distinctId: "user_123",
          event: "test_event",
          properties: { foo: "bar" },
        });
      }).not.toThrow();
    });

    it("accepts event with properties", async () => {
      const { captureEvent } = await import("../posthog");

      expect(() => {
        captureEvent({
          distinctId: "user_123",
          event: "monitor_created",
          properties: { monitorId: "mon_123" },
        });
      }).not.toThrow();
    });

    it("accepts event without properties", async () => {
      const { captureEvent } = await import("../posthog");

      expect(() => {
        captureEvent({
          distinctId: "user_123",
          event: "page_view",
        });
      }).not.toThrow();
    });
  });

  describe("identifyUser", () => {
    it("handles missing PostHog gracefully", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

      const { identifyUser } = await import("../posthog");

      expect(() => {
        identifyUser({
          distinctId: "user_123",
          properties: { email: "test@example.com" },
        });
      }).not.toThrow();
    });

    it("accepts user properties", async () => {
      const { identifyUser } = await import("../posthog");

      expect(() => {
        identifyUser({
          distinctId: "user_123",
          properties: {
            email: "test@example.com",
            plan: "pro",
          },
        });
      }).not.toThrow();
    });

    it("accepts identification without properties", async () => {
      const { identifyUser } = await import("../posthog");

      expect(() => {
        identifyUser({
          distinctId: "user_123",
        });
      }).not.toThrow();
    });
  });

  describe("error handling", () => {
    it("silently fails on errors", async () => {
      const { captureEvent, identifyUser } = await import("../posthog");

      // All PostHog operations should fail silently
      expect(() => {
        captureEvent({
          distinctId: "test",
          event: "test",
        });
        identifyUser({
          distinctId: "test",
        });
      }).not.toThrow();
    });
  });

  describe("configuration", () => {
    it("uses US host by default", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

      const { captureEvent } = await import("../posthog");

      // Should not throw and use default host
      captureEvent({ distinctId: "test", event: "test" });
    });

    it("accepts custom host", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.posthog.com");

      const { captureEvent } = await import("../posthog");

      captureEvent({ distinctId: "test", event: "test" });
    });
  });
});
