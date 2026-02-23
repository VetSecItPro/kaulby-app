import { describe, it, expect } from "vitest";
import { getSuggestionsFromMonitors } from "../community-suggestions";

describe("community-suggestions", () => {
  describe("getSuggestionsFromMonitors", () => {
    it("returns suggestions based on monitor keywords", () => {
      const monitors = [
        { keywords: ["startup", "saas", "marketing"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty("community");
      expect(suggestions[0]).toHaveProperty("platform");
      expect(suggestions[0]).toHaveProperty("relevanceScore");
      expect(suggestions[0]).toHaveProperty("matchedKeywords");
      expect(suggestions[0]).toHaveProperty("categories");
    });

    it("filters out existing communities", () => {
      const monitors = [
        { keywords: ["startup"] },
      ];

      const existingCommunities = ["r/startups", "r/Entrepreneur"];
      const suggestions = getSuggestionsFromMonitors(monitors, existingCommunities, 10);

      for (const suggestion of suggestions) {
        expect(existingCommunities).not.toContain(suggestion.community);
      }
    });

    it("limits results to specified limit", () => {
      const monitors = [
        { keywords: ["startup", "saas", "marketing", "programming"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 5);

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it("sorts suggestions by relevance score", () => {
      const monitors = [
        { keywords: ["startup", "saas"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].relevanceScore).toBeGreaterThanOrEqual(
          suggestions[i].relevanceScore
        );
      }
    });

    it("handles multiple monitors", () => {
      const monitors = [
        { keywords: ["startup"] },
        { keywords: ["marketing"] },
        { keywords: ["programming"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].matchedKeywords.length).toBeGreaterThan(0);
    });

    it("deduplicates keywords across monitors", () => {
      const monitors = [
        { keywords: ["startup", "saas"] },
        { keywords: ["startup", "marketing"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      // Should suggest communities relevant to all unique keywords
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("returns empty array when no keywords provided", () => {
      const monitors = [
        { keywords: [] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      expect(suggestions).toEqual([]);
    });

    it("returns empty array when monitors array is empty", () => {
      const suggestions = getSuggestionsFromMonitors([], [], 10);

      expect(suggestions).toEqual([]);
    });

    it("all platforms are reddit", () => {
      const monitors = [
        { keywords: ["startup", "saas"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      for (const suggestion of suggestions) {
        expect(suggestion.platform).toBe("reddit");
      }
    });

    it("tracks matched keywords correctly", () => {
      const monitors = [
        { keywords: ["startup"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].matchedKeywords).toContain("startup");
    });

    it("handles keyword variations and partial matches", () => {
      const monitors = [
        { keywords: ["programming", "developer", "code"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.categories.includes("programming"))).toBe(true);
    });

    it("handles case-insensitive keywords", () => {
      const monitors = [
        { keywords: ["STARTUP", "SaaS"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("case-insensitive existing communities filter", () => {
      const monitors = [
        { keywords: ["startup"] },
      ];

      const existingCommunities = ["R/STARTUPS"];
      const suggestions = getSuggestionsFromMonitors(monitors, existingCommunities, 10);

      // Should not suggest r/startups if R/STARTUPS is in existing
      expect(suggestions.every((s) => s.community.toLowerCase() !== "r/startups")).toBe(true);
    });

    it("assigns categories to suggestions", () => {
      const monitors = [
        { keywords: ["ai", "machine learning"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 10);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].categories.length).toBeGreaterThan(0);
    });

    it("handles complex multi-keyword scenarios", () => {
      const monitors = [
        { keywords: ["saas", "b2b", "enterprise", "api", "cloud"] },
      ];

      const suggestions = getSuggestionsFromMonitors(monitors, [], 20);

      expect(suggestions.length).toBeGreaterThan(0);
      // Higher relevance scores for communities matching multiple keywords
      if (suggestions.length > 1) {
        expect(suggestions[0].relevanceScore).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
