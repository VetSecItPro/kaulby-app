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

    it("allows unlimited keywords on solo plan", () => {
      const keywords = Array.from({ length: 100 }, (_, i) => `kw${i}`);
      const result = checkKeywordsLimit(keywords, "solo");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.message).toBe("Unlimited keywords");
    });

    it("allows unlimited keywords on scale plan", () => {
      const keywords = Array.from({ length: 500 }, (_, i) => `kw${i}`);
      const result = checkKeywordsLimit(keywords, "scale");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it("allows unlimited keywords on growth plan", () => {
      const keywords = Array.from({ length: 1000 }, (_, i) => `kw${i}`);
      const result = checkKeywordsLimit(keywords, "growth");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
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
      expect(canAccessPlatformWithPlan("solo", "hackernews")).toBe(true);
    });

    it("denies devto on pro plan (team-only)", () => {
      expect(canAccessPlatformWithPlan("solo", "devto")).toBe(false);
    });

    it("allows devto on team plan", () => {
      expect(canAccessPlatformWithPlan("growth", "devto")).toBe(true);
    });

    it("allows all 16 platforms on team plan", () => {
      const allPlatforms: Platform[] = [
        "reddit", "hackernews", "indiehackers", "producthunt",
        "googlereviews", "youtube", "github", "trustpilot", "x",
        "devto", "hashnode", "appstore", "playstore",
        "g2", "yelp", "amazonreviews",
      ];
      for (const p of allPlatforms) {
        expect(canAccessPlatformWithPlan("growth", p)).toBe(true);
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

    it("returns true for solo plan after 6+ hours", () => {
      const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("solo", sevenHoursAgo)).toBe(true);
    });

    it("returns false for solo plan within 6 hours", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("solo", twoHoursAgo)).toBe(false);
    });

    it("handles string dates", () => {
      const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(shouldProcessMonitorWithPlan("free", recent)).toBe(false);
    });

    it("returns true for growth after 2+ hours", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(shouldProcessMonitorWithPlan("growth", threeHoursAgo)).toBe(true);
    });
  });

  // =========================================================================
  // Monitor limits per plan
  // =========================================================================
  describe("plan monitor limits", () => {
    it("free plan allows 1 monitor", () => {
      expect(getPlanLimits("free").monitors).toBe(1);
    });

    it("solo plan allows 10 monitors", () => {
      expect(getPlanLimits("solo").monitors).toBe(10);
    });

    it("growth plan allows 30 monitors", () => {
      expect(getPlanLimits("growth").monitors).toBe(30);
    });
  });

  // =========================================================================
  // Refresh delay per plan
  // =========================================================================
  describe("refresh delay per plan", () => {
    it("free plan has 24-hour refresh delay", () => {
      expect(getPlanLimits("free").refreshDelayHours).toBe(24);
    });

    it("solo plan has 6-hour refresh delay", () => {
      expect(getPlanLimits("solo").refreshDelayHours).toBe(6);
    });

    it("scale plan has 4-hour refresh delay", () => {
      expect(getPlanLimits("scale").refreshDelayHours).toBe(4);
    });

    it("team plan has 2-hour refresh delay", () => {
      expect(getPlanLimits("growth").refreshDelayHours).toBe(2);
    });
  });

  // =========================================================================
  // getUpgradePrompt (synchronous)
  // =========================================================================
  describe("getUpgradePrompt", () => {
    it("suggests pro when current plan is free", () => {
      const prompt = getUpgradePrompt("free", "monitors");
      expect(prompt.show).toBe(true);
      expect(prompt.suggestedPlan).toBe("solo");
      expect(prompt.currentPlan).toBe("free");
    });

    it("suggests team when current plan is pro", () => {
      const prompt = getUpgradePrompt("solo", "monitors");
      expect(prompt.suggestedPlan).toBe("growth");
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
