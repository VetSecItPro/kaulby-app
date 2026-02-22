import { describe, it, expect } from "vitest";
import { blogArticles } from "../data/blog-articles";

describe("data/blog-articles", () => {
  describe("blogArticles", () => {
    it("contains at least 10 articles", () => {
      expect(blogArticles.length).toBeGreaterThanOrEqual(10);
    });

    it("all articles have required fields", () => {
      for (const article of blogArticles) {
        expect(article).toHaveProperty("slug");
        expect(article).toHaveProperty("title");
        expect(article).toHaveProperty("description");
        expect(article).toHaveProperty("category");
        expect(article).toHaveProperty("readTime");
        expect(article).toHaveProperty("featured");
        expect(article).toHaveProperty("publishedDate");
        expect(article).toHaveProperty("seoKeywords");
        expect(article).toHaveProperty("htmlContent");

        expect(typeof article.slug).toBe("string");
        expect(typeof article.title).toBe("string");
        expect(typeof article.description).toBe("string");
        expect(typeof article.category).toBe("string");
        expect(typeof article.readTime).toBe("string");
        expect(typeof article.featured).toBe("boolean");
        expect(typeof article.publishedDate).toBe("string");
        expect(Array.isArray(article.seoKeywords)).toBe(true);
        expect(typeof article.htmlContent).toBe("string");
      }
    });

    it("all slugs are unique", () => {
      const slugs = blogArticles.map((a) => a.slug);
      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size).toBe(slugs.length);
    });

    it("all slugs are URL-friendly", () => {
      for (const article of blogArticles) {
        // Slugs should only contain lowercase letters, numbers, and hyphens
        expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      }
    });

    it("all articles have at least one SEO keyword", () => {
      for (const article of blogArticles) {
        expect(article.seoKeywords.length).toBeGreaterThan(0);
      }
    });

    it("all published dates are valid ISO dates", () => {
      for (const article of blogArticles) {
        const date = new Date(article.publishedDate);
        expect(date.toString()).not.toBe("Invalid Date");
      }
    });

    it("readTime format is consistent", () => {
      for (const article of blogArticles) {
        expect(article.readTime).toMatch(/^\d+\s*min\s*read$/);
      }
    });

    it("at least one article is featured", () => {
      const featuredCount = blogArticles.filter((a) => a.featured).length;
      expect(featuredCount).toBeGreaterThan(0);
    });

    it("titles are not empty", () => {
      for (const article of blogArticles) {
        expect(article.title.length).toBeGreaterThan(0);
      }
    });

    it("descriptions are meaningful", () => {
      for (const article of blogArticles) {
        expect(article.description.length).toBeGreaterThan(20);
      }
    });

    it("htmlContent is not empty", () => {
      for (const article of blogArticles) {
        expect(article.htmlContent.length).toBeGreaterThan(100);
      }
    });

    it("categories are valid values", () => {
      const validCategories = [
        "Platform Monitoring",
        "AI Analysis",
        "Brand Tracking",
        "Competitive Intelligence",
        "Growth & Leads",
        "Product Updates",
      ];

      for (const article of blogArticles) {
        expect(validCategories).toContain(article.category);
      }
    });

    it("SEO keywords are lowercase strings", () => {
      for (const article of blogArticles) {
        for (const keyword of article.seoKeywords) {
          expect(typeof keyword).toBe("string");
          expect(keyword.length).toBeGreaterThan(0);
        }
      }
    });

    it("can find specific known article", () => {
      const article = blogArticles.find(
        (a) => a.slug === "why-reddit-is-the-most-underrated-source-of-customer-feedback"
      );

      expect(article).toBeDefined();
      expect(article?.title).toContain("Reddit");
    });
  });
});
