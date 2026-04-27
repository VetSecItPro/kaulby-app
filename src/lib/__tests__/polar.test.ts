import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  POLAR_PLANS,
  getPlanFromProductId,
  getProductId,
  KAULBY_PRORATION_BEHAVIOR,
  isTeamSeatProduct,
  getTeamSeatProductId,
  getPolarServer,
} from "../polar";

describe("polar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("POLAR_ACCESS_TOKEN", "test_token");
    vi.stubEnv("POLAR_SOLO_MONTHLY_PRODUCT_ID", "solo_monthly_123");
    vi.stubEnv("POLAR_SOLO_ANNUAL_PRODUCT_ID", "solo_annual_123");
    vi.stubEnv("POLAR_SCALE_MONTHLY_PRODUCT_ID", "scale_monthly_123");
    vi.stubEnv("POLAR_SCALE_ANNUAL_PRODUCT_ID", "scale_annual_123");
    vi.stubEnv("POLAR_GROWTH_MONTHLY_PRODUCT_ID", "growth_monthly_123");
    vi.stubEnv("POLAR_GROWTH_ANNUAL_PRODUCT_ID", "growth_annual_123");
    vi.stubEnv("POLAR_DAY_PASS_PRODUCT_ID", "day_pass_123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("POLAR_PLANS", () => {
    it("contains free, solo, scale, and growth plans", () => {
      expect(POLAR_PLANS).toHaveProperty("free");
      expect(POLAR_PLANS).toHaveProperty("solo");
      expect(POLAR_PLANS).toHaveProperty("scale");
      expect(POLAR_PLANS).toHaveProperty("growth");
    });

    it("free plan has correct structure", () => {
      const free = POLAR_PLANS.free;
      expect(free.name).toBe("Free");
      expect(free.price).toBe(0);
      expect(free.annualPrice).toBe(0);
      expect(free.priceId).toBeNull();
      expect(free.annualPriceId).toBeNull();
      expect(free.trialDays).toBe(0);
    });

    it("solo plan is priced at $39 with 20% annual discount", () => {
      const solo = POLAR_PLANS.solo;
      expect(solo.name).toBe("Solo");
      expect(solo.price).toBe(39);
      expect(solo.annualPrice).toBe(374);
    });

    it("scale plan is priced at $79 with 20% annual discount", () => {
      const scale = POLAR_PLANS.scale;
      expect(scale.name).toBe("Scale");
      expect(scale.price).toBe(79);
      expect(scale.annualPrice).toBe(758);
    });

    it("growth plan is priced at $149 with 20% annual discount", () => {
      const growth = POLAR_PLANS.growth;
      expect(growth.name).toBe("Growth");
      expect(growth.price).toBe(149);
      expect(growth.annualPrice).toBe(1430);
    });

    it("prices strictly increase across paid tiers", () => {
      expect(POLAR_PLANS.solo.price).toBeLessThan(POLAR_PLANS.scale.price);
      expect(POLAR_PLANS.scale.price).toBeLessThan(POLAR_PLANS.growth.price);
    });

    it("free plan has most restrictions", () => {
      const free = POLAR_PLANS.free;
      expect(free.limits.monitors).toBe(1);
      expect(free.limits.platforms).toHaveLength(1);
      expect(free.limits.platforms).toContain("reddit");
    });

    it("growth plan has highest monitor limit + comprehensive AI", () => {
      const growth = POLAR_PLANS.growth;
      expect(growth.limits.monitors).toBeGreaterThan(POLAR_PLANS.scale.limits.monitors);
      expect(growth.limits.platforms.length).toBe(16);
      expect(growth.limits.aiFeatures.comprehensiveAnalysis).toBe(true);
    });
  });

  describe("getPlanFromProductId", () => {
    it("returns free when product ID is empty", () => {
      expect(getPlanFromProductId("")).toBe("free");
    });

    it("returns solo for solo monthly product ID", () => {
      expect(getPlanFromProductId("solo_monthly_123")).toBe("solo");
    });

    it("returns solo for solo annual product ID", () => {
      expect(getPlanFromProductId("solo_annual_123")).toBe("solo");
    });

    it("returns scale for scale monthly/annual product IDs", () => {
      expect(getPlanFromProductId("scale_monthly_123")).toBe("scale");
      expect(getPlanFromProductId("scale_annual_123")).toBe("scale");
    });

    it("returns growth for growth monthly/annual product IDs", () => {
      expect(getPlanFromProductId("growth_monthly_123")).toBe("growth");
      expect(getPlanFromProductId("growth_annual_123")).toBe("growth");
    });

    it("returns free for unknown product ID", () => {
      expect(getPlanFromProductId("unknown_product_123")).toBe("free");
    });
  });

  describe("getProductId", () => {
    it("returns null for free plan", () => {
      expect(getProductId("free", "monthly")).toBeNull();
      expect(getProductId("free", "annual")).toBeNull();
    });

    it("returns solo product IDs", () => {
      expect(getProductId("solo", "monthly")).toBe("solo_monthly_123");
      expect(getProductId("solo", "annual")).toBe("solo_annual_123");
    });

    it("returns scale product IDs", () => {
      expect(getProductId("scale", "monthly")).toBe("scale_monthly_123");
      expect(getProductId("scale", "annual")).toBe("scale_annual_123");
    });

    it("returns growth product IDs", () => {
      expect(getProductId("growth", "monthly")).toBe("growth_monthly_123");
      expect(getProductId("growth", "annual")).toBe("growth_annual_123");
    });

    it("returns null when env vars not set", () => {
      vi.stubEnv("POLAR_SOLO_MONTHLY_PRODUCT_ID", "");
      expect(getProductId("solo", "monthly")).toBeNull();
    });
  });

  describe("getPolarClient", () => {
    it("returns null when POLAR_ACCESS_TOKEN not set", async () => {
      vi.stubEnv("POLAR_ACCESS_TOKEN", "");
      const { getPolarClient } = await import("../polar");
      const client = await getPolarClient();
      expect(client).toBeNull();
    });
  });

  describe("cancelSubscription", () => {
    it("returns false when client not initialized", async () => {
      vi.stubEnv("POLAR_ACCESS_TOKEN", "");
      const { cancelSubscription } = await import("../polar");
      const result = await cancelSubscription("sub_123");
      expect(result).toBe(false);
    });
  });

  describe("plan limits", () => {
    it("free plan is tightly restricted", () => {
      const { limits } = POLAR_PLANS.free;
      expect(limits.monitors).toBe(1);
      expect(limits.keywordsPerMonitor).toBe(3);
      expect(limits.resultsVisible).toBe(3);
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(false);
      expect(limits.alerts.email).toBe(false);
      expect(limits.exports.csv).toBe(false);
    });

    it("paid tiers all get unlimited keywords", () => {
      expect(POLAR_PLANS.solo.limits.keywordsPerMonitor).toBe(-1);
      expect(POLAR_PLANS.scale.limits.keywordsPerMonitor).toBe(-1);
      expect(POLAR_PLANS.growth.limits.keywordsPerMonitor).toBe(-1);
    });

    it("growth plan has webhooks + API + comprehensive AI (Solo/Scale don't)", () => {
      expect(POLAR_PLANS.solo.limits.alerts.webhooks).toBe(false);
      expect(POLAR_PLANS.scale.limits.alerts.webhooks).toBe(false);
      expect(POLAR_PLANS.growth.limits.alerts.webhooks).toBe(true);

      expect(POLAR_PLANS.solo.limits.exports.api).toBe(false);
      expect(POLAR_PLANS.scale.limits.exports.api).toBe(false);
      expect(POLAR_PLANS.growth.limits.exports.api).toBe(true);

      expect(POLAR_PLANS.solo.limits.aiFeatures.comprehensiveAnalysis).toBe(false);
      expect(POLAR_PLANS.scale.limits.aiFeatures.comprehensiveAnalysis).toBe(false);
      expect(POLAR_PLANS.growth.limits.aiFeatures.comprehensiveAnalysis).toBe(true);
    });

    it("refresh cadence tightens as tier goes up", () => {
      expect(POLAR_PLANS.free.limits.refreshDelayHours).toBe(24);
      expect(POLAR_PLANS.solo.limits.refreshDelayHours).toBe(6);
      expect(POLAR_PLANS.scale.limits.refreshDelayHours).toBe(4);
      expect(POLAR_PLANS.growth.limits.refreshDelayHours).toBe(2);
    });
  });

  describe("platform availability", () => {
    it("free has reddit only", () => {
      expect(POLAR_PLANS.free.limits.platforms).toEqual(["reddit"]);
    });

    it("solo has 8 platforms (X moved to Growth-only 2026-04-23)", () => {
      expect(POLAR_PLANS.solo.limits.platforms).toHaveLength(8);
      expect(POLAR_PLANS.solo.limits.platforms).not.toContain("x");
    });

    it("scale has 11 platforms (Solo + G2/Yelp/Amazon, X stays Growth-only)", () => {
      expect(POLAR_PLANS.scale.limits.platforms).toHaveLength(11);
      expect(POLAR_PLANS.scale.limits.platforms).toContain("g2");
      expect(POLAR_PLANS.scale.limits.platforms).toContain("yelp");
      expect(POLAR_PLANS.scale.limits.platforms).toContain("amazonreviews");
      expect(POLAR_PLANS.scale.limits.platforms).not.toContain("x");
    });

    it("growth has all 16 platforms", () => {
      expect(POLAR_PLANS.growth.limits.platforms).toHaveLength(16);
    });
  });

  // ─── Billing policy enforcement (PR #303) ─────────────────────────

  describe("KAULBY_PRORATION_BEHAVIOR", () => {
    // Kaulby billing policy: NO proration, NO mid-cycle refunds.
    // Every subscriptions.update call must pass this constant so the
    // per-call value overrides Polar org defaults. If this constant
    // ever changes from "next_period", finance state-reconciliation
    // logic across the webhook handler must be revisited.
    it("is the literal string 'next_period'", () => {
      expect(KAULBY_PRORATION_BEHAVIOR).toBe("next_period");
    });

    it("is exported as a const-narrowed string (not 'invoice'|'prorate'|'reset')", () => {
      // Compile-time narrowing: this assignment will fail typecheck if
      // KAULBY_PRORATION_BEHAVIOR is ever widened. Runtime check ensures
      // the literal is intact at module load.
      const v: "next_period" = KAULBY_PRORATION_BEHAVIOR;
      expect(v).toBe("next_period");
    });
  });

  describe("isTeamSeatProduct", () => {
    beforeEach(() => {
      vi.stubEnv("POLAR_GROWTH_SEAT_MONTHLY_PRODUCT_ID", "seat_monthly_xyz");
      vi.stubEnv("POLAR_GROWTH_SEAT_ANNUAL_PRODUCT_ID", "seat_annual_xyz");
    });

    it("recognizes monthly seat addon product ID", () => {
      expect(isTeamSeatProduct("seat_monthly_xyz")).toBe(true);
    });

    it("recognizes annual seat addon product ID", () => {
      expect(isTeamSeatProduct("seat_annual_xyz")).toBe(true);
    });

    it("returns false for main subscription product IDs", () => {
      expect(isTeamSeatProduct("growth_monthly_123")).toBe(false);
      expect(isTeamSeatProduct("scale_monthly_123")).toBe(false);
      expect(isTeamSeatProduct("solo_monthly_123")).toBe(false);
    });

    it("returns false for unknown / empty product ID", () => {
      expect(isTeamSeatProduct("")).toBe(false);
      expect(isTeamSeatProduct("unknown")).toBe(false);
    });
  });

  describe("getTeamSeatProductId", () => {
    beforeEach(() => {
      vi.stubEnv("POLAR_GROWTH_SEAT_MONTHLY_PRODUCT_ID", "seat_monthly_xyz");
      vi.stubEnv("POLAR_GROWTH_SEAT_ANNUAL_PRODUCT_ID", "seat_annual_xyz");
    });

    it("returns monthly product ID for monthly interval", () => {
      expect(getTeamSeatProductId("monthly")).toBe("seat_monthly_xyz");
    });

    it("returns annual product ID for annual interval", () => {
      expect(getTeamSeatProductId("annual")).toBe("seat_annual_xyz");
    });

    it("returns null when env var unset", () => {
      vi.unstubAllEnvs();
      expect(getTeamSeatProductId("monthly")).toBeNull();
      expect(getTeamSeatProductId("annual")).toBeNull();
    });
  });

  describe("getPolarServer", () => {
    it("returns 'sandbox' when POLAR_ENV=sandbox", () => {
      vi.stubEnv("POLAR_ENV", "sandbox");
      expect(getPolarServer()).toBe("sandbox");
    });

    it("returns 'production' by default (any other value or unset)", () => {
      vi.stubEnv("POLAR_ENV", "");
      expect(getPolarServer()).toBe("production");
      vi.stubEnv("POLAR_ENV", "production");
      expect(getPolarServer()).toBe("production");
      vi.stubEnv("POLAR_ENV", "staging");  // unknown values fall through to prod
      expect(getPolarServer()).toBe("production");
    });
  });
});
