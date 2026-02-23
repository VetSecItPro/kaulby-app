import { describe, it, expect } from "vitest";
import {
  DETECTION_CATEGORIES,
  getDefaultKeywords,
  getAllDefaultKeywords,
  type DetectionCategory,
} from "../detection-defaults";

describe("detection-defaults", () => {
  describe("DETECTION_CATEGORIES", () => {
    it("contains all expected categories", () => {
      const categories = DETECTION_CATEGORIES.map((c) => c.category);
      expect(categories).toContain("pain_point");
      expect(categories).toContain("solution_request");
      expect(categories).toContain("advice_request");
      expect(categories).toContain("money_talk");
      expect(categories).toContain("hot_discussion");
    });

    it("all categories have required fields", () => {
      for (const config of DETECTION_CATEGORIES) {
        expect(config).toHaveProperty("category");
        expect(config).toHaveProperty("label");
        expect(config).toHaveProperty("description");
        expect(config).toHaveProperty("defaultKeywords");

        expect(typeof config.category).toBe("string");
        expect(typeof config.label).toBe("string");
        expect(typeof config.description).toBe("string");
        expect(Array.isArray(config.defaultKeywords)).toBe(true);
      }
    });

    it("all categories have at least 10 default keywords", () => {
      for (const config of DETECTION_CATEGORIES) {
        expect(config.defaultKeywords.length).toBeGreaterThanOrEqual(10);
      }
    });

    it("all category IDs are unique", () => {
      const categories = DETECTION_CATEGORIES.map((c) => c.category);
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.size).toBe(categories.length);
    });

    it("all labels are unique", () => {
      const labels = DETECTION_CATEGORIES.map((c) => c.label);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });

    it("descriptions are meaningful", () => {
      for (const config of DETECTION_CATEGORIES) {
        expect(config.description.length).toBeGreaterThan(20);
      }
    });
  });

  describe("getDefaultKeywords", () => {
    it("returns keywords for solution_request category", () => {
      const keywords = getDefaultKeywords("solution_request");
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain("looking for a tool");
      expect(keywords).toContain("recommend a");
    });

    it("returns keywords for money_talk category", () => {
      const keywords = getDefaultKeywords("money_talk");
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain("too expensive");
      expect(keywords).toContain("is it worth");
    });

    it("returns keywords for pain_point category", () => {
      const keywords = getDefaultKeywords("pain_point");
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain("so frustrating");
      expect(keywords).toContain("doesn't work");
    });

    it("returns keywords for advice_request category", () => {
      const keywords = getDefaultKeywords("advice_request");
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain("how do i");
      expect(keywords).toContain("what's the best way");
    });

    it("returns keywords for hot_discussion category", () => {
      const keywords = getDefaultKeywords("hot_discussion");
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain("unpopular opinion");
      expect(keywords).toContain("controversial");
    });

    it("returns empty array for unknown category", () => {
      const keywords = getDefaultKeywords("unknown_category" as DetectionCategory);
      expect(keywords).toEqual([]);
    });

    it("returns array reference that matches DETECTION_CATEGORIES", () => {
      const category = "solution_request";
      const keywords = getDefaultKeywords(category);
      const configKeywords = DETECTION_CATEGORIES.find(
        (c) => c.category === category
      )?.defaultKeywords;

      expect(keywords).toEqual(configKeywords);
    });
  });

  describe("getAllDefaultKeywords", () => {
    it("returns object with all categories as keys", () => {
      const allKeywords = getAllDefaultKeywords();

      expect(allKeywords).toHaveProperty("pain_point");
      expect(allKeywords).toHaveProperty("solution_request");
      expect(allKeywords).toHaveProperty("advice_request");
      expect(allKeywords).toHaveProperty("money_talk");
      expect(allKeywords).toHaveProperty("hot_discussion");
    });

    it("all values are arrays", () => {
      const allKeywords = getAllDefaultKeywords();

      for (const keywords of Object.values(allKeywords)) {
        expect(Array.isArray(keywords)).toBe(true);
      }
    });

    it("all arrays have at least 10 keywords", () => {
      const allKeywords = getAllDefaultKeywords();

      for (const keywords of Object.values(allKeywords)) {
        expect(keywords.length).toBeGreaterThanOrEqual(10);
      }
    });

    it("matches DETECTION_CATEGORIES data", () => {
      const allKeywords = getAllDefaultKeywords();

      for (const config of DETECTION_CATEGORIES) {
        expect(allKeywords[config.category]).toEqual(config.defaultKeywords);
      }
    });

    it("returns complete record type", () => {
      const allKeywords = getAllDefaultKeywords();
      const expectedCategories: DetectionCategory[] = [
        "pain_point",
        "solution_request",
        "advice_request",
        "money_talk",
        "hot_discussion",
      ];

      for (const category of expectedCategories) {
        expect(allKeywords[category]).toBeDefined();
      }
    });
  });

  describe("keyword quality", () => {
    it("all keywords are lowercase", () => {
      for (const config of DETECTION_CATEGORIES) {
        for (const keyword of config.defaultKeywords) {
          expect(keyword).toBe(keyword.toLowerCase());
        }
      }
    });

    it("no empty keyword strings", () => {
      for (const config of DETECTION_CATEGORIES) {
        for (const keyword of config.defaultKeywords) {
          expect(keyword.length).toBeGreaterThan(0);
        }
      }
    });

    it("keywords are unique within each category", () => {
      for (const config of DETECTION_CATEGORIES) {
        const uniqueKeywords = new Set(config.defaultKeywords);
        expect(uniqueKeywords.size).toBe(config.defaultKeywords.length);
      }
    });

    it("keywords are meaningful phrases", () => {
      for (const config of DETECTION_CATEGORIES) {
        for (const keyword of config.defaultKeywords) {
          // Keywords should be at least 3 characters
          expect(keyword.length).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });
});
