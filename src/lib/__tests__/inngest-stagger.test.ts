import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateStaggerDelay,
  formatStaggerDuration,
  addJitter,
  getStaggerWindow,
} from "@/lib/inngest/utils/stagger";

describe("inngest stagger utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateStaggerDelay", () => {
    it("returns 0 for first monitor (index 0)", () => {
      const delay = calculateStaggerDelay(0, 10, 60000); // 1 minute window
      expect(delay).toBe(0);
    });

    it("returns 0 when only one monitor exists", () => {
      const delay = calculateStaggerDelay(0, 1, 60000);
      expect(delay).toBe(0);
    });

    it("spreads monitors evenly across time window", () => {
      const windowMs = 10 * 60 * 1000; // 10 minutes
      const totalMonitors = 10;

      // Each monitor should get 1 minute delay increment
      const delay1 = calculateStaggerDelay(1, totalMonitors, windowMs);
      const delay2 = calculateStaggerDelay(2, totalMonitors, windowMs);
      const delay3 = calculateStaggerDelay(3, totalMonitors, windowMs);

      expect(delay1).toBe(60000); // 1 minute
      expect(delay2).toBe(120000); // 2 minutes
      expect(delay3).toBe(180000); // 3 minutes
    });

    it("uses default 10-minute window when not specified", () => {
      const delay = calculateStaggerDelay(5, 10); // No window specified
      expect(delay).toBe(5 * 60 * 1000); // 5 minutes
    });

    it("handles large number of monitors", () => {
      const windowMs = 10 * 60 * 1000;
      const totalMonitors = 100;

      const delay = calculateStaggerDelay(50, totalMonitors, windowMs);
      expect(delay).toBe(Math.floor((50 * windowMs) / totalMonitors));
    });

    it("returns floored integer values", () => {
      const delay = calculateStaggerDelay(1, 3, 1000);
      expect(Number.isInteger(delay)).toBe(true);
    });
  });

  describe("formatStaggerDuration", () => {
    it("formats 0 milliseconds as '0s'", () => {
      expect(formatStaggerDuration(0)).toBe("0s");
    });

    it("formats seconds correctly (< 60s)", () => {
      expect(formatStaggerDuration(5000)).toBe("5s");
      expect(formatStaggerDuration(30000)).toBe("30s");
      expect(formatStaggerDuration(59000)).toBe("59s");
    });

    it("formats minutes without seconds", () => {
      expect(formatStaggerDuration(60000)).toBe("1m");
      expect(formatStaggerDuration(120000)).toBe("2m");
      expect(formatStaggerDuration(600000)).toBe("10m");
    });

    it("formats minutes with remaining seconds", () => {
      expect(formatStaggerDuration(65000)).toBe("1m5s");
      expect(formatStaggerDuration(125000)).toBe("2m5s");
      expect(formatStaggerDuration(90000)).toBe("1m30s");
    });

    it("handles large durations", () => {
      expect(formatStaggerDuration(3661000)).toBe("61m1s");
    });
  });

  describe("addJitter", () => {
    it("adds random jitter within percentage range", () => {
      const baseDelay = 1000;
      const jitterPercent = 10;

      // Run multiple times to test randomness
      for (let i = 0; i < 10; i++) {
        const result = addJitter(baseDelay, jitterPercent);
        expect(result).toBeGreaterThanOrEqual(baseDelay);
        expect(result).toBeLessThanOrEqual(baseDelay + baseDelay * 0.1);
      }
    });

    it("uses default 10% jitter when not specified", () => {
      const baseDelay = 1000;
      const result = addJitter(baseDelay);
      expect(result).toBeGreaterThanOrEqual(baseDelay);
      expect(result).toBeLessThanOrEqual(baseDelay + 100); // 10% of 1000
    });

    it("returns floored integer", () => {
      const result = addJitter(1000, 5);
      expect(Number.isInteger(result)).toBe(true);
    });

    it("handles 0 base delay", () => {
      const result = addJitter(0, 10);
      expect(result).toBe(0);
    });

    it("handles 0 jitter percent", () => {
      const result = addJitter(1000, 0);
      expect(result).toBe(1000);
    });
  });

  describe("getStaggerWindow", () => {
    it("returns 5 minutes for low-volume platforms", () => {
      expect(getStaggerWindow("reddit")).toBe(5 * 60 * 1000);
      expect(getStaggerWindow("hackernews")).toBe(5 * 60 * 1000);
      expect(getStaggerWindow("producthunt")).toBe(5 * 60 * 1000);
      expect(getStaggerWindow("quora")).toBe(5 * 60 * 1000);
    });

    it("returns 8 minutes for medium-volume platforms", () => {
      expect(getStaggerWindow("trustpilot")).toBe(8 * 60 * 1000);
      expect(getStaggerWindow("googlereviews")).toBe(8 * 60 * 1000);
      expect(getStaggerWindow("g2")).toBe(8 * 60 * 1000);
      expect(getStaggerWindow("yelp")).toBe(8 * 60 * 1000);
      expect(getStaggerWindow("appstore")).toBe(8 * 60 * 1000);
      expect(getStaggerWindow("playstore")).toBe(8 * 60 * 1000);
    });

    it("returns 10 minutes for high-volume platforms", () => {
      expect(getStaggerWindow("youtube")).toBe(10 * 60 * 1000);
      expect(getStaggerWindow("amazonreviews")).toBe(10 * 60 * 1000);
    });

    it("returns 5 minutes for developer platforms", () => {
      expect(getStaggerWindow("indiehackers")).toBe(5 * 60 * 1000);
      expect(getStaggerWindow("github")).toBe(5 * 60 * 1000);
      expect(getStaggerWindow("devto")).toBe(5 * 60 * 1000);
      expect(getStaggerWindow("hashnode")).toBe(5 * 60 * 1000);
    });

    it("returns 5 minutes for social media platforms", () => {
      expect(getStaggerWindow("x")).toBe(5 * 60 * 1000);
    });

    it("returns default 5 minutes for unknown platform", () => {
      expect(getStaggerWindow("unknown" as never)).toBe(5 * 60 * 1000);
    });
  });

  describe("integration - full stagger flow", () => {
    it("calculates realistic stagger delays with jitter", () => {
      const totalMonitors = 20;
      const platform = "reddit";
      const window = getStaggerWindow(platform);

      for (let i = 0; i < totalMonitors; i++) {
        const baseDelay = calculateStaggerDelay(i, totalMonitors, window);
        const delayWithJitter = addJitter(baseDelay, 10);
        const formatted = formatStaggerDuration(delayWithJitter);

        // All delays should be valid
        expect(delayWithJitter).toBeGreaterThanOrEqual(baseDelay);
        expect(formatted).toMatch(/^\d+(m(\d+s)?|s)$/);
      }
    });
  });
});
