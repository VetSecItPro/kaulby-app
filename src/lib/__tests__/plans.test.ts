import { describe, it, expect } from "vitest";
import { PLANS, getPlanLimits, ALL_PLATFORMS, type PlanKey } from "../plans";

describe("plans", () => {
  describe("PLANS definition", () => {
    it("has exactly 3 plan tiers", () => {
      expect(Object.keys(PLANS)).toEqual(["free", "pro", "enterprise"]);
    });

    it("free plan has zero pricing", () => {
      expect(PLANS.free.price).toBe(0);
      expect(PLANS.free.annualPrice).toBe(0);
      expect(PLANS.free.priceId).toBeNull();
    });

    it("pro plan has correct pricing", () => {
      expect(PLANS.pro.price).toBe(29);
      expect(PLANS.pro.annualPrice).toBe(290);
    });

    it("enterprise plan has correct pricing", () => {
      expect(PLANS.enterprise.price).toBe(99);
      expect(PLANS.enterprise.annualPrice).toBe(990);
    });

    it("annual pricing gives 2 months free", () => {
      expect(PLANS.pro.annualPrice).toBe(PLANS.pro.price * 10);
      expect(PLANS.enterprise.annualPrice).toBe(PLANS.enterprise.price * 10);
    });
  });

  describe("getPlanLimits", () => {
    it("returns free plan limits", () => {
      const limits = getPlanLimits("free");
      expect(limits.monitors).toBe(1);
      expect(limits.keywordsPerMonitor).toBe(3);
      expect(limits.resultsVisible).toBe(3);
      expect(limits.refreshDelayHours).toBe(24);
    });

    it("returns pro plan limits", () => {
      const limits = getPlanLimits("pro");
      expect(limits.monitors).toBe(10);
      expect(limits.keywordsPerMonitor).toBe(10);
      expect(limits.resultsVisible).toBe(-1); // unlimited
      expect(limits.refreshDelayHours).toBe(4);
    });

    it("returns enterprise plan limits", () => {
      const limits = getPlanLimits("enterprise");
      expect(limits.monitors).toBe(30);
      expect(limits.keywordsPerMonitor).toBe(20);
      expect(limits.resultsVisible).toBe(-1); // unlimited
      expect(limits.refreshDelayHours).toBe(2);
    });
  });

  describe("platform access", () => {
    it("free plan only allows reddit", () => {
      const limits = getPlanLimits("free");
      expect(limits.platforms).toEqual(["reddit"]);
    });

    it("pro plan allows 8 platforms", () => {
      const limits = getPlanLimits("pro");
      expect(limits.platforms).toHaveLength(8);
      expect(limits.platforms).toContain("reddit");
      expect(limits.platforms).toContain("hackernews");
      expect(limits.platforms).toContain("producthunt");
      expect(limits.platforms).toContain("youtube");
      expect(limits.platforms).not.toContain("devto");
      expect(limits.platforms).not.toContain("g2");
    });

    it("enterprise plan allows all 16 platforms", () => {
      const limits = getPlanLimits("enterprise");
      expect(limits.platforms).toHaveLength(16);
      expect(limits.platforms).toEqual(ALL_PLATFORMS);
    });
  });

  describe("AI features", () => {
    it("free plan has limited AI", () => {
      const limits = getPlanLimits("free");
      expect(limits.aiFeatures.sentiment).toBe(true);
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(false);
      expect(limits.aiFeatures.askFeature).toBe(false);
      expect(limits.aiFeatures.comprehensiveAnalysis).toBe(false);
    });

    it("pro plan has full AI analysis but no comprehensive", () => {
      const limits = getPlanLimits("pro");
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(true);
      expect(limits.aiFeatures.painPointCategories).toBe(true);
      expect(limits.aiFeatures.comprehensiveAnalysis).toBe(false);
    });

    it("enterprise plan has comprehensive AI", () => {
      const limits = getPlanLimits("enterprise");
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(true);
      expect(limits.aiFeatures.comprehensiveAnalysis).toBe(true);
      expect(limits.aiFeatures.askFeature).toBe(true);
    });
  });

  describe("digest frequencies", () => {
    it("free plan has no digest", () => {
      const limits = getPlanLimits("free");
      expect(limits.digestFrequencies).toEqual([]);
    });

    it("pro plan has daily digest only", () => {
      const limits = getPlanLimits("pro");
      expect(limits.digestFrequencies).toEqual(["daily"]);
    });

    it("enterprise plan has all digest frequencies", () => {
      const limits = getPlanLimits("enterprise");
      expect(limits.digestFrequencies).toContain("daily");
      expect(limits.digestFrequencies).toContain("weekly");
      expect(limits.digestFrequencies).toContain("monthly");
      expect(limits.digestFrequencies).toContain("realtime");
    });
  });

  describe("exports and alerts", () => {
    it("free plan has no exports or alerts", () => {
      const limits = getPlanLimits("free");
      expect(limits.exports.csv).toBe(false);
      expect(limits.exports.api).toBe(false);
      expect(limits.alerts.email).toBe(false);
      expect(limits.alerts.slack).toBe(false);
      expect(limits.alerts.webhooks).toBe(false);
    });

    it("pro plan has CSV and email/slack alerts", () => {
      const limits = getPlanLimits("pro");
      expect(limits.exports.csv).toBe(true);
      expect(limits.exports.api).toBe(false);
      expect(limits.alerts.email).toBe(true);
      expect(limits.alerts.slack).toBe(true);
      expect(limits.alerts.webhooks).toBe(false);
    });

    it("enterprise plan has all exports and alerts", () => {
      const limits = getPlanLimits("enterprise");
      expect(limits.exports.csv).toBe(true);
      expect(limits.exports.api).toBe(true);
      expect(limits.alerts.email).toBe(true);
      expect(limits.alerts.webhooks).toBe(true);
    });
  });

  describe("ALL_PLATFORMS", () => {
    it("contains exactly 16 platforms", () => {
      expect(ALL_PLATFORMS).toHaveLength(16);
    });

    it("has no duplicates", () => {
      const unique = new Set(ALL_PLATFORMS);
      expect(unique.size).toBe(ALL_PLATFORMS.length);
    });
  });

  describe("tier hierarchy", () => {
    const plans: PlanKey[] = ["free", "pro", "enterprise"];

    it("monitors increase with tier", () => {
      const limits = plans.map(getPlanLimits);
      expect(limits[0].monitors).toBeLessThan(limits[1].monitors);
      expect(limits[1].monitors).toBeLessThan(limits[2].monitors);
    });

    it("refresh delay decreases with tier", () => {
      const limits = plans.map(getPlanLimits);
      expect(limits[0].refreshDelayHours).toBeGreaterThan(limits[1].refreshDelayHours);
      expect(limits[1].refreshDelayHours).toBeGreaterThan(limits[2].refreshDelayHours);
    });

    it("platforms increase with tier", () => {
      const limits = plans.map(getPlanLimits);
      expect(limits[0].platforms.length).toBeLessThan(limits[1].platforms.length);
      expect(limits[1].platforms.length).toBeLessThan(limits[2].platforms.length);
    });
  });
});
