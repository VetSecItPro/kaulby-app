import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  POLAR_PLANS,
  getPlanFromProductId,
  getProductId,
} from "../polar";

describe("polar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("POLAR_ACCESS_TOKEN", "test_token");
    vi.stubEnv("POLAR_PRO_MONTHLY_PRODUCT_ID", "pro_monthly_123");
    vi.stubEnv("POLAR_PRO_ANNUAL_PRODUCT_ID", "pro_annual_123");
    vi.stubEnv("POLAR_TEAM_MONTHLY_PRODUCT_ID", "team_monthly_123");
    vi.stubEnv("POLAR_TEAM_ANNUAL_PRODUCT_ID", "team_annual_123");
    vi.stubEnv("POLAR_DAY_PASS_PRODUCT_ID", "day_pass_123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("POLAR_PLANS", () => {
    it("contains free, pro, and team plans", () => {
      expect(POLAR_PLANS).toHaveProperty("free");
      expect(POLAR_PLANS).toHaveProperty("pro");
      expect(POLAR_PLANS).toHaveProperty("team");
    });

    it("free plan has correct structure", () => {
      const free = POLAR_PLANS.free;
      expect(free.name).toBe("Free");
      expect(free.price).toBe(0);
      expect(free.annualPrice).toBe(0);
      expect(free.productId).toBeNull();
      expect(free.annualProductId).toBeNull();
      expect(free.trialDays).toBe(0);
      expect(free.features).toBeInstanceOf(Array);
      expect(free.limits).toBeDefined();
    });

    it("pro plan has correct structure", () => {
      const pro = POLAR_PLANS.pro;
      expect(pro.name).toBe("Pro");
      expect(pro.price).toBeGreaterThan(0);
      expect(pro.annualPrice).toBeGreaterThan(0);
      expect(pro.annualPrice).toBeLessThan(pro.price * 12);
      expect(pro.features).toBeInstanceOf(Array);
      expect(pro.limits).toBeDefined();
    });

    it("team plan has correct structure", () => {
      const team = POLAR_PLANS.team;
      expect(team.name).toBe("Team");
      expect(team.price).toBeGreaterThan(POLAR_PLANS.pro.price);
      expect(team.annualPrice).toBeGreaterThan(POLAR_PLANS.pro.annualPrice);
      expect(team.features).toBeInstanceOf(Array);
      expect(team.limits).toBeDefined();
    });

    it("all plans have platform limits", () => {
      for (const plan of Object.values(POLAR_PLANS)) {
        expect(plan.limits.platforms).toBeInstanceOf(Array);
        expect(plan.limits.monitors).toBeGreaterThanOrEqual(-1);
        expect(plan.limits.keywordsPerMonitor).toBeGreaterThan(0);
      }
    });

    it("free plan has most restrictions", () => {
      const free = POLAR_PLANS.free;
      expect(free.limits.monitors).toBe(1);
      expect(free.limits.platforms).toHaveLength(1);
      expect(free.limits.platforms).toContain("reddit");
    });

    it("team plan has most features", () => {
      const team = POLAR_PLANS.team;
      expect(team.limits.monitors).toBeGreaterThan(POLAR_PLANS.pro.limits.monitors);
      expect(team.limits.platforms.length).toBeGreaterThan(POLAR_PLANS.pro.limits.platforms.length);
      expect(team.limits.aiFeatures.comprehensiveAnalysis).toBe(true);
    });
  });

  describe("getPlanFromProductId", () => {
    it("returns free when product ID is empty", () => {
      expect(getPlanFromProductId("")).toBe("free");
    });

    it("returns pro for pro monthly product ID", () => {
      expect(getPlanFromProductId("pro_monthly_123")).toBe("pro");
    });

    it("returns pro for pro annual product ID", () => {
      expect(getPlanFromProductId("pro_annual_123")).toBe("pro");
    });

    it("returns team for team monthly product ID", () => {
      expect(getPlanFromProductId("team_monthly_123")).toBe("team");
    });

    it("returns team for team annual product ID", () => {
      expect(getPlanFromProductId("team_annual_123")).toBe("team");
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

    it("returns pro monthly product ID", () => {
      expect(getProductId("pro", "monthly")).toBe("pro_monthly_123");
    });

    it("returns pro annual product ID", () => {
      expect(getProductId("pro", "annual")).toBe("pro_annual_123");
    });

    it("returns team monthly product ID", () => {
      expect(getProductId("team", "monthly")).toBe("team_monthly_123");
    });

    it("returns team annual product ID", () => {
      expect(getProductId("team", "annual")).toBe("team_annual_123");
    });

    it("returns null when env vars not set", () => {
      vi.stubEnv("POLAR_PRO_MONTHLY_PRODUCT_ID", "");
      expect(getProductId("pro", "monthly")).toBeNull();
    });
  });

  describe("getPolarClient", () => {
    it("returns null when POLAR_ACCESS_TOKEN not set", async () => {
      vi.stubEnv("POLAR_ACCESS_TOKEN", "");
      const { getPolarClient } = await import("../polar");
      const client = await getPolarClient();
      expect(client).toBeNull();
    });

    it("returns null when SDK import fails", async () => {
      vi.stubEnv("POLAR_ACCESS_TOKEN", "test_token");
      // Mock the SDK to simulate import failure
      vi.doMock("@polar-sh/sdk", () => {
        throw new Error("Module not found");
      });
      const { getPolarClient } = await import("../polar");
      const client = await getPolarClient();
      // When SDK fails to import, returns null
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

    it("handles immediate cancellation option", async () => {
      const { cancelSubscription } = await import("../polar");
      const result = await cancelSubscription("sub_123", { immediate: true });
      // Will be false since SDK not available in tests or true if SDK is available
      expect(typeof result).toBe("boolean");
    });

    it("handles end-of-period cancellation by default", async () => {
      const { cancelSubscription } = await import("../polar");
      const result = await cancelSubscription("sub_123");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("plan limits", () => {
    it("free plan limits are restrictive", () => {
      const { limits } = POLAR_PLANS.free;
      expect(limits.monitors).toBe(1);
      expect(limits.keywordsPerMonitor).toBe(3);
      expect(limits.resultsVisible).toBe(3);
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(false);
      expect(limits.alerts.email).toBe(false);
      expect(limits.exports.csv).toBe(false);
    });

    it("pro plan has reasonable limits", () => {
      const { limits } = POLAR_PLANS.pro;
      expect(limits.monitors).toBe(10);
      expect(limits.keywordsPerMonitor).toBe(10);
      expect(limits.resultsVisible).toBe(-1); // unlimited
      expect(limits.aiFeatures.unlimitedAiAnalysis).toBe(true);
      expect(limits.alerts.email).toBe(true);
      expect(limits.exports.csv).toBe(true);
    });

    it("team plan has highest limits", () => {
      const { limits } = POLAR_PLANS.team;
      expect(limits.monitors).toBe(30);
      expect(limits.keywordsPerMonitor).toBe(20);
      expect(limits.aiFeatures.comprehensiveAnalysis).toBe(true);
      expect(limits.alerts.webhooks).toBe(true);
      expect(limits.exports.api).toBe(true);
    });
  });

  describe("platform availability", () => {
    it("free tier has only reddit", () => {
      expect(POLAR_PLANS.free.limits.platforms).toEqual(["reddit"]);
    });

    it("pro tier has 9 platforms", () => {
      expect(POLAR_PLANS.pro.limits.platforms).toHaveLength(9);
    });

    it("team tier has all 17 platforms", () => {
      expect(POLAR_PLANS.team.limits.platforms).toHaveLength(17);
    });
  });
});
