import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

vi.mock("@/lib/server-cache", () => ({
  getCachedUserPlan: vi.fn(),
}));

import {
  checkKeywordsLimit,
  canAccessPlatformWithPlan,
  shouldProcessMonitorWithPlan,
  getUpgradePrompt,
} from "../limits";
import { getPlanLimits } from "@/lib/plans";
import type { Platform } from "@/lib/plans";

describe("limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // checkKeywordsLimit (synchronous, no DB)
  // =========================================================================
  describe("checkKeywordsLimit", () => {
    it("allows keywords within free plan limit (3)", () => {
      const result = checkKeywordsLimit(["foo", "bar"], "free");
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(3);
    });

    it("allows exactly at the free plan limit", () => {
      const result = checkKeywordsLimit(["a", "b", "c"], "free");
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(3);
    });

    it("rejects keywords exceeding free plan limit", () => {
      const result = checkKeywordsLimit(["a", "b", "c", "d"], "free");
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(4);
      expect(result.limit).toBe(3);
      expect(result.message).toContain("Maximum 3");
    });

    it("allows 10 keywords on pro plan", () => {
      const keywords = Array.from({ length: 10 }, (_, i) => `kw${i}`);
      const result = checkKeywordsLimit(keywords, "pro");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
    });

    it("rejects 11 keywords on pro plan", () => {
      const keywords = Array.from({ length: 11 }, (_, i) => `kw${i}`);
      const result = checkKeywordsLimit(keywords, "pro");
      expect(result.allowed).toBe(false);
    });

    it("allows 20 keywords on enterprise plan", () => {
      const keywords = Array.from({ length: 20 }, (_, i) => `kw${i}`);
      const result = checkKeywordsLimit(keywords, "enterprise");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(20);
    });

    it("returns remaining count in message when under limit", () => {
      const result = checkKeywordsLimit(["a"], "pro");
      expect(result.message).toContain("9 keywords remaining");
    });

    it("handles empty keywords array", () => {
      const result = checkKeywordsLimit([], "free");
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
    });
  });

  // =========================================================================
  // canAccessPlatformWithPlan (synchronous, no DB)
  // =========================================================================
  describe("canAccessPlatformWithPlan", () => {
    it("allows reddit on free plan", () => {
      expect(canAccessPlatformWithPlan("free", "reddit")).toBe(true);
    });

    it("denies hackernews on free plan", () => {
      expect(canAccessPlatformWithPlan("free", "hackernews")).toBe(false);
    });

    it("allows hackernews on pro plan", () => {
      expect(canAccessPlatformWithPlan("pro", "hackernews")).toBe(true);
    });

    it("denies devto on pro plan (team-only)", () => {
      expect(canAccessPlatformWithPlan("pro", "devto")).toBe(false);
    });

    it("allows devto on enterprise plan", () => {
      expect(canAccessPlatformWithPlan("enterprise", "devto")).toBe(true);
    });

    it("allows all 17 platforms on enterprise plan", () => {
      const allPlatforms: Platform[] = [
        "reddit", "hackernews", "indiehackers", "producthunt",
        "googlereviews", "youtube", "github", "trustpilot", "x",
        "devto", "hashnode", "appstore", "playstore",
        "quora", "g2", "yelp", "amazonreviews",
      ];
      for (const p of allPlatforms) {
        expect(canAccessPlatformWithPlan("enterprise", p)).toBe(true);
      }
    });

    it("free plan only has reddit", () => {
      const limits = getPlanLimits("free");
      expect(limits.platforms).toEqual(["reddit"]);
    });
  });

  // =========================================================================
  // shouldProcessMonitorWithPlan (synchronous, no DB)
  // =========================================================================
  describe("shouldProcessMonitorWithPlan", () => {
    it("returns true when lastCheckedAt is null", () => {
      expect(shouldProcessMonitorWithPlan("free", null)).toBe(true);
    });

    it("returns false when checked recently (within free 24h delay)", () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("free", oneHourAgo)).toBe(false);
    });

    it("returns true when free delay has elapsed (>24h)", () => {
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("free", thirtyHoursAgo)).toBe(true);
    });

    it("returns true for pro plan after 4+ hours", () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("pro", fiveHoursAgo)).toBe(true);
    });

    it("returns false for pro plan within 4 hours", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("pro", twoHoursAgo)).toBe(false);
    });

    it("handles string dates", () => {
      const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(shouldProcessMonitorWithPlan("free", recent)).toBe(false);
    });

    it("returns true for enterprise after 2+ hours", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("enterprise", threeHoursAgo)).toBe(true);
    });
  });

  // =========================================================================
  // Monitor limits per plan
  // =========================================================================
  describe("plan monitor limits", () => {
    it("free plan allows 1 monitor", () => {
      expect(getPlanLimits("free").monitors).toBe(1);
    });

    it("pro plan allows 10 monitors", () => {
      expect(getPlanLimits("pro").monitors).toBe(10);
    });

    it("enterprise plan allows 30 monitors", () => {
      expect(getPlanLimits("enterprise").monitors).toBe(30);
    });
  });

  // =========================================================================
  // Refresh delay per plan
  // =========================================================================
  describe("refresh delay per plan", () => {
    it("free plan has 24-hour refresh delay", () => {
      expect(getPlanLimits("free").refreshDelayHours).toBe(24);
    });

    it("pro plan has 4-hour refresh delay", () => {
      expect(getPlanLimits("pro").refreshDelayHours).toBe(4);
    });

    it("enterprise plan has 2-hour refresh delay", () => {
      expect(getPlanLimits("enterprise").refreshDelayHours).toBe(2);
    });
  });

  // =========================================================================
  // getUpgradePrompt (synchronous)
  // =========================================================================
  describe("getUpgradePrompt", () => {
    it("suggests pro when current plan is free", () => {
      const prompt = getUpgradePrompt("free", "monitors");
      expect(prompt.show).toBe(true);
      expect(prompt.suggestedPlan).toBe("pro");
      expect(prompt.currentPlan).toBe("free");
    });

    it("suggests enterprise when current plan is pro", () => {
      const prompt = getUpgradePrompt("pro", "monitors");
      expect(prompt.suggestedPlan).toBe("enterprise");
    });

    it("includes platform name in context", () => {
      const prompt = getUpgradePrompt("free", "platform", { platformName: "Hacker News" });
      expect(prompt.title).toContain("Hacker News");
    });

    it("includes hidden count for results_hidden trigger", () => {
      const prompt = getUpgradePrompt("free", "results_hidden", { hiddenCount: 15 });
      expect(prompt.title).toContain("15");
    });
  });
});
