import { describe, it, expect } from "vitest";
import { PLANS, getPlanLimits, ALL_PLATFORMS, type PlanKey } from "../plans";

describe("plans", () => {
  describe("PLANS definition", () => {
    it("has exactly 4 plan tiers", () => {
      expect(Object.keys(PLANS)).toEqual(["free", "solo", "scale", "growth"]);
    });

    it("free plan has zero pricing", () => {
      expect(PLANS.free.price).toBe(0);
      expect(PLANS.free.annualPrice).toBe(0);
      expect(PLANS.free.priceId).toBeNull();
    });

    it("solo plan has correct pricing", () => {
      expect(PLANS.solo.price).toBe(39);
      expect(PLANS.solo.annualPrice).toBe(374); // 20% off $468 list
    });

    it("scale plan has correct pricing", () => {
      expect(PLANS.scale.price).toBe(79);
      expect(PLANS.scale.annualPrice).toBe(758); // 20% off $948 list
    });

    it("growth plan has correct pricing", () => {
      expect(PLANS.growth.price).toBe(149);
      expect(PLANS.growth.annualPrice).toBe(1430); // 20% off $1788 list
    });

    it("all paid tiers get 20% off annual", () => {
      for (const key of ["solo", "scale", "growth"] as const) {
        const list = PLANS[key].price * 12;
        const expected = Math.round(list * 0.8);
        expect(PLANS[key].annualPrice).toBeCloseTo(expected, -1); // within $10
      }
    });
  });

  describe("getPlanLimits", () => {
    it("returns free plan limits (zeroed — no active subscription, post-#316)", () => {
      const limits = getPlanLimits("free");
      expect(limits.monitors).toBe(0);
      expect(limits.keywordsPerMonitor).toBe(0);
      expect(limits.resultsVisible).toBe(0);
      expect(limits.refreshDelayHours).toBe(24); // kept as documented timing for any legacy comparisons
    });

    it("returns solo plan limits", () => {
      const limits = getPlanLimits("solo");
      expect(limits.monitors).toBe(10);
      expect(limits.keywordsPerMonitor).toBe(-1); // unlimited
      expect(limits.resultsVisible).toBe(-1);
      expect(limits.refreshDelayHours).toBe(6);
    });

    it("returns scale plan limits", () => {
      const limits = getPlanLimits("scale");
      expect(limits.monitors).toBe(20);
      expect(limits.keywordsPerMonitor).toBe(-1);
      expect(limits.resultsVisible).toBe(-1);
      expect(limits.refreshDelayHours).toBe(4);
    });

    it("returns growth plan limits", () => {
      const limits = getPlanLimits("growth");
      expect(limits.monitors).toBe(30);
      expect(limits.keywordsPerMonitor).toBe(-1);
      expect(limits.resultsVisible).toBe(-1);
      expect(limits.refreshDelayHours).toBe(2);
    });
  });

  describe("platform access", () => {
    it("free plan has zero platforms (post-#316 — no active subscription state)", () => {
      const limits = getPlanLimits("free");
      expect(limits.platforms).toEqual([]);
    });

    it("solo plan allows 8 platforms (X moved to Growth-only 2026-04-23)", () => {
      const limits = getPlanLimits("solo");
      expect(limits.platforms).toHaveLength(8);
      expect(limits.platforms).toContain("reddit");
      expect(limits.platforms).toContain("github");
      expect(limits.platforms).not.toContain("g2");
      expect(limits.platforms).not.toContain("devto");
      expect(limits.platforms).not.toContain("x");
    });

    it("scale plan adds review platforms (11 total: Solo + G2/Yelp/Amazon)", () => {
      const limits = getPlanLimits("scale");
      expect(limits.platforms).toHaveLength(11);
      expect(limits.platforms).toContain("g2");
      expect(limits.platforms).toContain("yelp");
      expect(limits.platforms).toContain("amazonreviews");
      expect(limits.platforms).not.toContain("devto");
      expect(limits.platforms).not.toContain("x");
    });

    it("growth plan allows all 16 platforms", () => {
      const limits = getPlanLimits("growth");
      expect(limits.platforms).toHaveLength(16);
      expect(limits.platforms).toEqual(ALL_PLATFORMS);
    });
  });

  describe("AI features", () => {
    it("free plan has no AI features (post-#316 — no active subscription)", () => {
      const limits = getPlanLimits("free");
      expect(limits.aiFeatures.sentiment).toBe(false);
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(false);
      expect(limits.aiFeatures.askFeature).toBe(false);
      expect(limits.aiFeatures.comprehensiveAnalysis).toBe(false);
    });

    it("solo plan has full AI + Ask but no comprehensive analysis", () => {
      const limits = getPlanLimits("solo");
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(true);
      expect(limits.aiFeatures.painPointCategories).toBe(true);
      expect(limits.aiFeatures.askFeature).toBe(true);
      expect(limits.aiFeatures.comprehensiveAnalysis).toBe(false);
    });

    it("growth plan has comprehensive analyst reports", () => {
      const limits = getPlanLimits("growth");
      expect(limits.aiFeatures.comprehensiveAnalysis).toBe(true);
    });
  });

  describe("alerts & exports", () => {
    it("webhooks + API access are Growth-exclusive", () => {
      expect(PLANS.solo.limits.alerts.webhooks).toBe(false);
      expect(PLANS.scale.limits.alerts.webhooks).toBe(false);
      expect(PLANS.growth.limits.alerts.webhooks).toBe(true);
      expect(PLANS.solo.limits.exports.api).toBe(false);
      expect(PLANS.scale.limits.exports.api).toBe(false);
      expect(PLANS.growth.limits.exports.api).toBe(true);
    });
  });

  it("PlanKey type covers all 4 tiers", () => {
    const keys: PlanKey[] = ["free", "solo", "scale", "growth"];
    expect(keys.length).toBe(4);
  });

  describe("getEffectiveTier (reverse trial)", () => {
    it("returns paid tier when no trial fields", async () => {
      const { getEffectiveTier } = await import("../plans");
      expect(getEffectiveTier({ subscriptionStatus: "solo" })).toBe("solo");
      expect(getEffectiveTier({ subscriptionStatus: "free" })).toBe("free");
    });

    it("returns trial tier when trial is active and higher than paid", async () => {
      const { getEffectiveTier } = await import("../plans");
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(
        getEffectiveTier({ subscriptionStatus: "solo", trialTier: "growth", trialEndsAt: future })
      ).toBe("growth");
    });

    it("returns paid tier when trial has expired", async () => {
      const { getEffectiveTier } = await import("../plans");
      const past = new Date(Date.now() - 1000);
      expect(
        getEffectiveTier({ subscriptionStatus: "solo", trialTier: "growth", trialEndsAt: past })
      ).toBe("solo");
    });

    it("never downgrades a user who upgraded mid-trial", async () => {
      const { getEffectiveTier } = await import("../plans");
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      // User on Growth with a trial of Scale → should stay Growth
      expect(
        getEffectiveTier({ subscriptionStatus: "growth", trialTier: "scale", trialEndsAt: future })
      ).toBe("growth");
    });

    it("normalizes legacy enum values in trial fields", async () => {
      const { getEffectiveTier } = await import("../plans");
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(
        getEffectiveTier({ subscriptionStatus: "pro", trialTier: "team", trialEndsAt: future })
      ).toBe("growth"); // pro→solo, team→growth, max=growth
    });

    it("treats invalid date strings as expired", async () => {
      const { getEffectiveTier } = await import("../plans");
      expect(
        getEffectiveTier({ subscriptionStatus: "solo", trialTier: "growth", trialEndsAt: "not-a-date" })
      ).toBe("solo");
    });
  });
});
