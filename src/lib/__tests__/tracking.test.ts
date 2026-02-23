import { describe, it, expect } from "vitest";
import { tracking } from "../tracking";

describe("tracking", () => {
  describe("tracking object", () => {
    it("exports upgradeClicked", () => {
      expect(tracking.upgradeClicked).toBeDefined();
      expect(typeof tracking.upgradeClicked).toBe("function");
    });

    it("exports upgradeCompleted", () => {
      expect(tracking.upgradeCompleted).toBeDefined();
      expect(typeof tracking.upgradeCompleted).toBe("function");
    });

    it("exports dayPassPurchased", () => {
      expect(tracking.dayPassPurchased).toBeDefined();
      expect(typeof tracking.dayPassPurchased).toBe("function");
    });

    it("exports monitorCreated", () => {
      expect(tracking.monitorCreated).toBeDefined();
      expect(typeof tracking.monitorCreated).toBe("function");
    });

    it("exports monitorScanned", () => {
      expect(tracking.monitorScanned).toBeDefined();
      expect(typeof tracking.monitorScanned).toBe("function");
    });

    it("exports monitorDuplicated", () => {
      expect(tracking.monitorDuplicated).toBeDefined();
      expect(typeof tracking.monitorDuplicated).toBe("function");
    });

    it("exports monitorDeleted", () => {
      expect(tracking.monitorDeleted).toBeDefined();
      expect(typeof tracking.monitorDeleted).toBe("function");
    });

    it("exports resultClicked", () => {
      expect(tracking.resultClicked).toBeDefined();
      expect(typeof tracking.resultClicked).toBe("function");
    });

    it("exports resultSaved", () => {
      expect(tracking.resultSaved).toBeDefined();
      expect(typeof tracking.resultSaved).toBe("function");
    });

    it("exports aiAnalysisViewed", () => {
      expect(tracking.aiAnalysisViewed).toBeDefined();
      expect(typeof tracking.aiAnalysisViewed).toBe("function");
    });

    it("exports exportTriggered", () => {
      expect(tracking.exportTriggered).toBeDefined();
      expect(typeof tracking.exportTriggered).toBe("function");
    });

    it("exports limitReached", () => {
      expect(tracking.limitReached).toBeDefined();
      expect(typeof tracking.limitReached).toBe("function");
    });

    it("exports upgradePromptShown", () => {
      expect(tracking.upgradePromptShown).toBeDefined();
      expect(typeof tracking.upgradePromptShown).toBe("function");
    });

    it("exports onboardingStarted", () => {
      expect(tracking.onboardingStarted).toBeDefined();
      expect(typeof tracking.onboardingStarted).toBe("function");
    });

    it("exports onboardingCompleted", () => {
      expect(tracking.onboardingCompleted).toBeDefined();
      expect(typeof tracking.onboardingCompleted).toBe("function");
    });
  });

  describe("tracking functions", () => {
    // All tracking functions should not throw when called
    // (they fail silently if PostHog is not available)

    it("upgradeClicked does not throw", () => {
      expect(() => tracking.upgradeClicked("/pricing", "pro", "banner")).not.toThrow();
    });

    it("upgradeCompleted does not throw", () => {
      expect(() => tracking.upgradeCompleted("pro", true)).not.toThrow();
    });

    it("dayPassPurchased does not throw", () => {
      expect(() => tracking.dayPassPurchased("modal")).not.toThrow();
    });

    it("monitorCreated does not throw", () => {
      expect(() => tracking.monitorCreated(["reddit"], 5, "keyword")).not.toThrow();
    });

    it("monitorScanned does not throw", () => {
      expect(() => tracking.monitorScanned("mon_123", true)).not.toThrow();
    });

    it("monitorDuplicated does not throw", () => {
      expect(() => tracking.monitorDuplicated("mon_123")).not.toThrow();
    });

    it("monitorDeleted does not throw", () => {
      expect(() => tracking.monitorDeleted("mon_123")).not.toThrow();
    });

    it("resultClicked does not throw", () => {
      expect(() => tracking.resultClicked("reddit", "mon_123")).not.toThrow();
    });

    it("resultSaved does not throw", () => {
      expect(() => tracking.resultSaved("reddit", "mon_123")).not.toThrow();
    });

    it("aiAnalysisViewed does not throw", () => {
      expect(() => tracking.aiAnalysisViewed("mon_123", "res_123")).not.toThrow();
    });

    it("exportTriggered does not throw", () => {
      expect(() => tracking.exportTriggered("csv", 100)).not.toThrow();
    });

    it("limitReached does not throw", () => {
      expect(() => tracking.limitReached("monitors", "free")).not.toThrow();
    });

    it("upgradePromptShown does not throw", () => {
      expect(() => tracking.upgradePromptShown("limit_modal", "free")).not.toThrow();
    });

    it("onboardingStarted does not throw", () => {
      expect(() => tracking.onboardingStarted()).not.toThrow();
    });

    it("onboardingCompleted does not throw", () => {
      expect(() => tracking.onboardingCompleted(true)).not.toThrow();
    });
  });
});
