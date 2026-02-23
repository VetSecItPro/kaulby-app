import { describe, it, expect } from "vitest";
import {
  AUDIENCE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplateById,
} from "../audience-templates";

describe("audience-templates", () => {
  describe("AUDIENCE_TEMPLATES", () => {
    it("contains at least 10 templates", () => {
      expect(AUDIENCE_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    });

    it("all templates have required fields", () => {
      for (const template of AUDIENCE_TEMPLATES) {
        expect(template).toHaveProperty("id");
        expect(template).toHaveProperty("name");
        expect(template).toHaveProperty("description");
        expect(template).toHaveProperty("color");
        expect(template).toHaveProperty("icon");
        expect(template).toHaveProperty("category");
        expect(template).toHaveProperty("suggestedKeywords");
        expect(template).toHaveProperty("suggestedPlatforms");
        expect(template).toHaveProperty("useCase");

        expect(typeof template.id).toBe("string");
        expect(typeof template.name).toBe("string");
        expect(typeof template.description).toBe("string");
        expect(typeof template.color).toBe("string");
        expect(typeof template.icon).toBe("string");
        expect(typeof template.useCase).toBe("string");
        expect(Array.isArray(template.suggestedKeywords)).toBe(true);
        expect(Array.isArray(template.suggestedPlatforms)).toBe(true);
      }
    });

    it("all template IDs are unique", () => {
      const ids = AUDIENCE_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("all template categories are valid", () => {
      const validCategories = TEMPLATE_CATEGORIES.map((c) => c.id);
      for (const template of AUDIENCE_TEMPLATES) {
        expect(validCategories).toContain(template.category);
      }
    });

    it("all templates have at least one suggested keyword", () => {
      for (const template of AUDIENCE_TEMPLATES) {
        expect(template.suggestedKeywords.length).toBeGreaterThan(0);
      }
    });

    it("all templates have at least one suggested platform", () => {
      for (const template of AUDIENCE_TEMPLATES) {
        expect(template.suggestedPlatforms.length).toBeGreaterThan(0);
      }
    });

    it("color values are valid hex codes", () => {
      for (const template of AUDIENCE_TEMPLATES) {
        expect(template.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe("TEMPLATE_CATEGORIES", () => {
    it("contains all expected categories", () => {
      const categoryIds = TEMPLATE_CATEGORIES.map((c) => c.id);
      expect(categoryIds).toContain("business");
      expect(categoryIds).toContain("product");
      expect(categoryIds).toContain("industry");
      expect(categoryIds).toContain("competitive");
    });

    it("all categories have id and label", () => {
      for (const category of TEMPLATE_CATEGORIES) {
        expect(category).toHaveProperty("id");
        expect(category).toHaveProperty("label");
        expect(typeof category.id).toBe("string");
        expect(typeof category.label).toBe("string");
      }
    });
  });

  describe("getTemplateById", () => {
    it("returns template when ID exists", () => {
      const template = getTemplateById("brand-mentions");
      expect(template).toBeDefined();
      expect(template?.id).toBe("brand-mentions");
      expect(template?.name).toBe("Brand Mentions");
    });

    it("returns undefined when ID does not exist", () => {
      const template = getTemplateById("non-existent-template");
      expect(template).toBeUndefined();
    });

    it("returns correct template for each known template", () => {
      const knownTemplates = [
        "brand-mentions",
        "competitor-tracker",
        "buyer-intent",
        "customer-feedback",
        "feature-requests",
      ];

      for (const id of knownTemplates) {
        const template = getTemplateById(id);
        expect(template).toBeDefined();
        expect(template?.id).toBe(id);
      }
    });

    it("is case-sensitive", () => {
      const template = getTemplateById("BRAND-MENTIONS");
      expect(template).toBeUndefined();
    });
  });

  describe("template content quality", () => {
    it("brand-mentions template has expected content", () => {
      const template = getTemplateById("brand-mentions");
      expect(template?.category).toBe("business");
      expect(template?.suggestedPlatforms).toContain("reddit");
      expect(template?.suggestedKeywords.length).toBeGreaterThan(0);
    });

    it("competitor-tracker template has expected content", () => {
      const template = getTemplateById("competitor-tracker");
      expect(template?.category).toBe("competitive");
      expect(template?.description).toContain("competitor");
    });

    it("buyer-intent template has expected content", () => {
      const template = getTemplateById("buyer-intent");
      expect(template?.category).toBe("business");
      expect(template?.suggestedKeywords.some((k) => k.includes("looking for"))).toBe(true);
    });

    it("all templates have meaningful descriptions", () => {
      for (const template of AUDIENCE_TEMPLATES) {
        expect(template.description.length).toBeGreaterThan(20);
      }
    });

    it("all templates have meaningful use cases", () => {
      for (const template of AUDIENCE_TEMPLATES) {
        expect(template.useCase.length).toBeGreaterThan(20);
      }
    });
  });
});
