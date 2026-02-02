import { describe, it, expect } from "vitest";
import { contentMatchesMonitor } from "../content-matcher";

describe("contentMatchesMonitor", () => {
  describe("company name matching", () => {
    it("matches company name in title", () => {
      const result = contentMatchesMonitor(
        { title: "I love using Kaulby for monitoring", body: "" },
        { companyName: "Kaulby", keywords: [] }
      );
      expect(result.matches).toBe(true);
      expect(result.matchType).toBe("company");
      expect(result.matchedTerms).toContain("Kaulby");
    });

    it("matches company name case-insensitively", () => {
      const result = contentMatchesMonitor(
        { title: "kaulby is great", body: "" },
        { companyName: "Kaulby", keywords: [] }
      );
      expect(result.matches).toBe(true);
    });

    it("matches company name in body", () => {
      const result = contentMatchesMonitor(
        { title: "Best tools 2026", body: "I recommend Kaulby for this." },
        { companyName: "Kaulby", keywords: [] }
      );
      expect(result.matches).toBe(true);
      expect(result.matchType).toBe("company");
    });

    it("does not match when company name absent", () => {
      const result = contentMatchesMonitor(
        { title: "Best monitoring tools", body: "Try these platforms." },
        { companyName: "Kaulby", keywords: [] }
      );
      expect(result.matches).toBe(false);
    });
  });

  describe("keyword matching", () => {
    it("matches single keyword", () => {
      const result = contentMatchesMonitor(
        { title: "Best community monitoring tools", body: "" },
        { keywords: ["monitoring"] }
      );
      expect(result.matches).toBe(true);
      expect(result.matchType).toBe("keyword");
      expect(result.matchedTerms).toContain("monitoring");
    });

    it("matches multiple keywords", () => {
      const result = contentMatchesMonitor(
        { title: "Social listening and brand monitoring", body: "" },
        { keywords: ["listening", "monitoring", "analytics"] }
      );
      expect(result.matches).toBe(true);
      expect(result.matchedTerms).toContain("listening");
      expect(result.matchedTerms).toContain("monitoring");
    });

    it("matches keywords case-insensitively", () => {
      const result = contentMatchesMonitor(
        { title: "MONITORING TOOLS", body: "" },
        { keywords: ["monitoring"] }
      );
      expect(result.matches).toBe(true);
    });

    it("does not match with no keyword hits", () => {
      const result = contentMatchesMonitor(
        { title: "Best pizza recipes", body: "Cheese and pepperoni" },
        { keywords: ["monitoring", "saas", "software"] }
      );
      expect(result.matches).toBe(false);
    });

    it("matches keyword in body", () => {
      const result = contentMatchesMonitor(
        { title: "Question", body: "Does anyone know a good monitoring tool?" },
        { keywords: ["monitoring"] }
      );
      expect(result.matches).toBe(true);
    });
  });

  describe("company + keyword combination", () => {
    it("matches when both company and keyword present", () => {
      const result = contentMatchesMonitor(
        { title: "Kaulby review: great monitoring tool", body: "" },
        { companyName: "Kaulby", keywords: ["review"] }
      );
      expect(result.matches).toBe(true);
      // Company direct mention takes priority
      expect(result.matchType).toBe("company");
    });
  });

  describe("boolean search", () => {
    it("uses boolean search when searchQuery is provided", () => {
      const result = contentMatchesMonitor(
        { title: "monitoring tools for startups", body: "" },
        { keywords: [], searchQuery: "monitoring AND startups" }
      );
      expect(result.matches).toBe(true);
      expect(result.matchType).toBe("boolean_search");
    });

    it("boolean search overrides keyword matching", () => {
      const result = contentMatchesMonitor(
        { title: "monitoring tools", body: "" },
        { keywords: ["monitoring"], searchQuery: "analytics AND dashboard" }
      );
      expect(result.matches).toBe(false);
      expect(result.matchType).toBe("boolean_search");
    });
  });

  describe("no match scenarios", () => {
    it("returns no match with empty config", () => {
      const result = contentMatchesMonitor(
        { title: "Hello world", body: "Test content" },
        { keywords: [] }
      );
      expect(result.matches).toBe(false);
    });

    it("returns no match with null company and empty keywords", () => {
      const result = contentMatchesMonitor(
        { title: "Hello world" },
        { companyName: null, keywords: [] }
      );
      expect(result.matches).toBe(false);
    });
  });
});
