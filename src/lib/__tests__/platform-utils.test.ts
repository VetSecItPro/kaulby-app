import { describe, it, expect } from "vitest";
import {
  getPlatformDisplayName,
  getPlatformBadgeColor,
  getPlatformBarColor,
  getSentimentBadgeColor,
  getSentimentBarColor,
  platforms,
  platformColors,
  proPlatforms,
  teamOnlyPlatforms,
} from "../platform-utils";

describe("platform-utils", () => {
  describe("platform constants", () => {
    it("has 17 total platforms", () => {
      expect(platforms).toHaveLength(17);
    });

    it("has 9 pro platforms", () => {
      expect(proPlatforms).toHaveLength(9);
    });

    it("has 8 team-only platforms", () => {
      expect(teamOnlyPlatforms).toHaveLength(8);
    });

    it("all platforms combined equals total", () => {
      const combined = [...proPlatforms, ...teamOnlyPlatforms];
      expect(combined).toHaveLength(platforms.length);
    });
  });

  describe("getPlatformDisplayName", () => {
    it("returns human-readable name for reddit", () => {
      expect(getPlatformDisplayName("reddit")).toBe("Reddit");
    });

    it("returns human-readable name for hackernews", () => {
      expect(getPlatformDisplayName("hackernews")).toBe("Hacker News");
    });

    it("returns human-readable name for x", () => {
      expect(getPlatformDisplayName("x")).toBe("X (Twitter)");
    });

    it("returns human-readable name for producthunt", () => {
      expect(getPlatformDisplayName("producthunt")).toBe("Product Hunt");
    });

    it("returns human-readable name for googlereviews", () => {
      expect(getPlatformDisplayName("googlereviews")).toBe("Google Reviews");
    });

    it("returns human-readable name for amazonreviews", () => {
      expect(getPlatformDisplayName("amazonreviews")).toBe("Amazon Reviews");
    });

    it("returns the input string for unknown platforms", () => {
      expect(getPlatformDisplayName("unknownplatform")).toBe("unknownplatform");
    });

    it("returns Twitter for legacy platform", () => {
      expect(getPlatformDisplayName("twitter")).toBe("Twitter");
    });

    it("has display names for all active platforms", () => {
      for (const p of platforms) {
        expect(getPlatformDisplayName(p)).toBeTruthy();
        expect(getPlatformDisplayName(p)).not.toBe(p); // should differ from key
      }
    });
  });

  describe("getPlatformBadgeColor", () => {
    it("returns badge color for reddit", () => {
      const color = getPlatformBadgeColor("reddit");
      expect(color).toContain("orange");
    });

    it("returns light variant when specified", () => {
      const color = getPlatformBadgeColor("reddit", "light");
      expect(color).toContain("orange");
      expect(color).not.toBe(getPlatformBadgeColor("reddit", "default"));
    });

    it("returns fallback for unknown platform", () => {
      const color = getPlatformBadgeColor("nonexistent");
      expect(color).toBe("bg-muted text-muted-foreground");
    });

    it("returns colors for all active platforms", () => {
      for (const p of platforms) {
        const color = getPlatformBadgeColor(p);
        expect(color).toBeTruthy();
        expect(color).not.toBe("bg-muted text-muted-foreground");
      }
    });
  });

  describe("getPlatformBarColor", () => {
    it("returns bar color for reddit", () => {
      expect(getPlatformBarColor("reddit")).toContain("orange");
    });

    it("returns fallback for unknown platform", () => {
      expect(getPlatformBarColor("nonexistent")).toBe("bg-primary");
    });
  });

  describe("getSentimentBadgeColor", () => {
    it("returns green for positive sentiment", () => {
      expect(getSentimentBadgeColor("positive")).toContain("green");
    });

    it("returns red for negative sentiment", () => {
      expect(getSentimentBadgeColor("negative")).toContain("red");
    });

    it("returns gray for neutral sentiment", () => {
      expect(getSentimentBadgeColor("neutral")).toContain("gray");
    });

    it("returns fallback for null sentiment", () => {
      expect(getSentimentBadgeColor(null)).toBe("bg-muted text-muted-foreground");
    });

    it("returns fallback for unknown sentiment", () => {
      expect(getSentimentBadgeColor("unknown")).toBe("bg-muted text-muted-foreground");
    });

    it("returns light variant when specified", () => {
      const light = getSentimentBadgeColor("positive", "light");
      const def = getSentimentBadgeColor("positive", "default");
      expect(light).not.toBe(def);
    });
  });

  describe("getSentimentBarColor", () => {
    it("returns green for positive", () => {
      expect(getSentimentBarColor("positive")).toContain("green");
    });

    it("returns red for negative", () => {
      expect(getSentimentBarColor("negative")).toContain("red");
    });

    it("returns fallback for null", () => {
      expect(getSentimentBarColor(null)).toBe("bg-muted");
    });
  });

  describe("platformColors has all platforms", () => {
    it("has color entries for every active platform", () => {
      for (const p of platforms) {
        expect(platformColors[p]).toBeDefined();
        expect(platformColors[p].badge).toBeTruthy();
        expect(platformColors[p].bar).toBeTruthy();
        expect(platformColors[p].icon).toBeTruthy();
      }
    });
  });
});
