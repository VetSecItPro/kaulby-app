import { describe, it, expect } from "vitest";
import * as security from "../security";

describe("security/index", () => {
  describe("module exports", () => {
    it("exports escapeHtml", () => {
      expect(security.escapeHtml).toBeDefined();
      expect(typeof security.escapeHtml).toBe("function");
    });

    it("exports escapeRegExp", () => {
      expect(security.escapeRegExp).toBeDefined();
      expect(typeof security.escapeRegExp).toBe("function");
    });

    it("exports sanitizeUrl", () => {
      expect(security.sanitizeUrl).toBeDefined();
      expect(typeof security.sanitizeUrl).toBe("function");
    });

    it("exports isValidEmail", () => {
      expect(security.isValidEmail).toBeDefined();
      expect(typeof security.isValidEmail).toBe("function");
    });

    it("exports isValidUuid", () => {
      expect(security.isValidUuid).toBeDefined();
      expect(typeof security.isValidUuid).toBe("function");
    });

    it("exports truncate", () => {
      expect(security.truncate).toBeDefined();
      expect(typeof security.truncate).toBe("function");
    });

    it("exports sanitizeForLog", () => {
      expect(security.sanitizeForLog).toBeDefined();
      expect(typeof security.sanitizeForLog).toBe("function");
    });

    it("exports escapeHtmlPreserveSafe", () => {
      expect(security.escapeHtmlPreserveSafe).toBeDefined();
      expect(typeof security.escapeHtmlPreserveSafe).toBe("function");
    });

    it("exports stripHtml", () => {
      expect(security.stripHtml).toBeDefined();
      expect(typeof security.stripHtml).toBe("function");
    });

    it("exports isSafeRegexPattern", () => {
      expect(security.isSafeRegexPattern).toBeDefined();
      expect(typeof security.isSafeRegexPattern).toBe("function");
    });

    it("exports createSafeRegExp", () => {
      expect(security.createSafeRegExp).toBeDefined();
      expect(typeof security.createSafeRegExp).toBe("function");
    });

    it("exports safeLog", () => {
      expect(security.safeLog).toBeDefined();
      expect(typeof security.safeLog).toBe("function");
    });

    it("exports sanitizeMonitorInput", () => {
      expect(security.sanitizeMonitorInput).toBeDefined();
      expect(typeof security.sanitizeMonitorInput).toBe("function");
    });

    it("exports isValidKeyword", () => {
      expect(security.isValidKeyword).toBeDefined();
      expect(typeof security.isValidKeyword).toBe("function");
    });
  });

  describe("function functionality", () => {
    it("escapeHtml escapes HTML entities", () => {
      const result = security.escapeHtml("<script>alert('xss')</script>");
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;");
      expect(result).toContain("&gt;");
    });

    it("escapeRegExp escapes regex special characters", () => {
      const result = security.escapeRegExp("test.*+?");
      expect(result).toContain("\\.");
      expect(result).toContain("\\*");
      expect(result).toContain("\\+");
      expect(result).toContain("\\?");
    });

    it("sanitizeUrl validates URLs", () => {
      const goodUrl = security.sanitizeUrl("https://example.com");
      expect(goodUrl).toBe("https://example.com");

      const badUrl = security.sanitizeUrl("javascript:alert(1)");
      expect(badUrl).toBeNull(); // Returns null, not empty string
    });

    it("isValidEmail validates email format", () => {
      expect(security.isValidEmail("test@example.com")).toBe(true);
      expect(security.isValidEmail("invalid-email")).toBe(false);
      expect(security.isValidEmail("@example.com")).toBe(false);
    });

    it("isValidUuid validates UUID format", () => {
      expect(
        security.isValidUuid("550e8400-e29b-41d4-a716-446655440000")
      ).toBe(true);
      expect(security.isValidUuid("not-a-uuid")).toBe(false);
    });

    it("truncate limits string length", () => {
      const result = security.truncate("very long string here", 10);
      expect(result.length).toBeLessThanOrEqual(13); // 10 + "..."
    });

    it("sanitizeForLog removes log injection characters", () => {
      const result = security.sanitizeForLog("test\nwith\nnewlines");
      expect(result).not.toContain("\n");
    });
  });
});
