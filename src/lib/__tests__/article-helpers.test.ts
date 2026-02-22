import { describe, it, expect } from "vitest";
import {
  categoryConfig,
  allCategories,
  type ArticleCategory,
} from "../utils/article-helpers";
import { Globe, Brain, Shield, Target, TrendingUp, Zap } from "lucide-react";

describe("utils/article-helpers", () => {
  describe("categoryConfig", () => {
    it("contains all expected categories", () => {
      expect(categoryConfig).toHaveProperty("Platform Monitoring");
      expect(categoryConfig).toHaveProperty("AI Analysis");
      expect(categoryConfig).toHaveProperty("Brand Tracking");
      expect(categoryConfig).toHaveProperty("Competitive Intelligence");
      expect(categoryConfig).toHaveProperty("Growth & Leads");
      expect(categoryConfig).toHaveProperty("Product Updates");
    });

    it("all categories have icon, colorClass, and badgeClass", () => {
      for (const [category, config] of Object.entries(categoryConfig)) {
        expect(config).toHaveProperty("icon");
        expect(config).toHaveProperty("colorClass");
        expect(config).toHaveProperty("badgeClass");
        expect(typeof config.colorClass).toBe("string");
        expect(typeof config.badgeClass).toBe("string");
        expect(typeof category).toBe("string");
      }
    });

    it("all colorClass values start with text-", () => {
      for (const config of Object.values(categoryConfig)) {
        expect(config.colorClass).toMatch(/^text-/);
      }
    });

    it("all badgeClass values contain bg- and text-", () => {
      for (const config of Object.values(categoryConfig)) {
        expect(config.badgeClass).toContain("bg-");
        expect(config.badgeClass).toContain("text-");
      }
    });

    it("Platform Monitoring has Globe icon", () => {
      const config = categoryConfig["Platform Monitoring"];
      expect(config.icon).toBe(Globe);
    });

    it("AI Analysis has Brain icon", () => {
      const config = categoryConfig["AI Analysis"];
      expect(config.icon).toBe(Brain);
    });

    it("Brand Tracking has Shield icon", () => {
      const config = categoryConfig["Brand Tracking"];
      expect(config.icon).toBe(Shield);
    });

    it("Competitive Intelligence has Target icon", () => {
      const config = categoryConfig["Competitive Intelligence"];
      expect(config.icon).toBe(Target);
    });

    it("Growth & Leads has TrendingUp icon", () => {
      const config = categoryConfig["Growth & Leads"];
      expect(config.icon).toBe(TrendingUp);
    });

    it("Product Updates has Zap icon", () => {
      const config = categoryConfig["Product Updates"];
      expect(config.icon).toBe(Zap);
    });
  });

  describe("allCategories", () => {
    it("is an array", () => {
      expect(Array.isArray(allCategories)).toBe(true);
    });

    it("contains all 6 categories", () => {
      expect(allCategories).toHaveLength(6);
    });

    it("contains expected categories in order", () => {
      expect(allCategories[0]).toBe("Platform Monitoring");
      expect(allCategories[1]).toBe("AI Analysis");
      expect(allCategories[2]).toBe("Brand Tracking");
      expect(allCategories[3]).toBe("Competitive Intelligence");
      expect(allCategories[4]).toBe("Growth & Leads");
      expect(allCategories[5]).toBe("Product Updates");
    });

    it("all categories exist in categoryConfig", () => {
      for (const category of allCategories) {
        expect(categoryConfig[category as ArticleCategory]).toBeDefined();
      }
    });

    it("all categories are strings", () => {
      for (const category of allCategories) {
        expect(typeof category).toBe("string");
      }
    });

    it("all categories are unique", () => {
      const uniqueCategories = new Set(allCategories);
      expect(uniqueCategories.size).toBe(allCategories.length);
    });
  });

  describe("type safety", () => {
    it("ArticleCategory type matches categoryConfig keys", () => {
      const testCategory: ArticleCategory = "Platform Monitoring";
      expect(categoryConfig[testCategory]).toBeDefined();
    });

    it("all allCategories entries are valid ArticleCategory types", () => {
      for (const category of allCategories) {
        // TypeScript will catch if this isn't valid
        const config = categoryConfig[category as ArticleCategory];
        expect(config).toBeDefined();
      }
    });
  });
});
