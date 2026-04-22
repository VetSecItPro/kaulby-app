import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPTS, buildAnalysisPrompt, withPersonaVoice, TEAM_ANALYST_PERSONA } from "../ai/prompts";

describe("ai/prompts", () => {
  describe("SYSTEM_PROMPTS", () => {
    it("has all required prompt types", () => {
      const expectedKeys = [
        "sentimentAnalysis",
        "painPointDetection",
        "conversationCategorization",
        "summarize",
        "askAboutAudience",
        "weeklyInsights",
        "aiDiscovery",
        "comprehensiveAnalysis",
      ];
      for (const key of expectedKeys) {
        expect(SYSTEM_PROMPTS).toHaveProperty(key);
        expect(typeof SYSTEM_PROMPTS[key as keyof typeof SYSTEM_PROMPTS]).toBe("string");
      }
    });

    it("sentimentAnalysis prompt includes JSON output format", () => {
      expect(SYSTEM_PROMPTS.sentimentAnalysis).toContain('"sentiment"');
      expect(SYSTEM_PROMPTS.sentimentAnalysis).toContain('"score"');
      expect(SYSTEM_PROMPTS.sentimentAnalysis).toContain('"confidence"');
    });

    it("sentimentAnalysis prompt defines all sentiment labels", () => {
      const prompt = SYSTEM_PROMPTS.sentimentAnalysis;
      expect(prompt).toContain('"positive"');
      expect(prompt).toContain('"negative"');
      expect(prompt).toContain('"neutral"');
      expect(prompt).toContain('"mixed"');
    });

    it("painPointDetection prompt includes all categories", () => {
      const prompt = SYSTEM_PROMPTS.painPointDetection;
      expect(prompt).toContain("buying_signal");
      expect(prompt).toContain("competitor_mention");
      expect(prompt).toContain("negative_experience");
      expect(prompt).toContain("pricing_concern");
      expect(prompt).toContain("support_need");
      expect(prompt).toContain("feature_request");
      expect(prompt).toContain("positive_feedback");
      expect(prompt).toContain("general_discussion");
    });

    it("conversationCategorization prompt includes categories", () => {
      const prompt = SYSTEM_PROMPTS.conversationCategorization;
      expect(prompt).toContain("solution_request");
      expect(prompt).toContain("money_talk");
      expect(prompt).toContain("pain_point");
      expect(prompt).toContain("advice_request");
      expect(prompt).toContain("hot_discussion");
    });

    it("summarize prompt requests JSON output", () => {
      const prompt = SYSTEM_PROMPTS.summarize;
      expect(prompt).toContain('"summary"');
      expect(prompt).toContain('"headline"');
      expect(prompt).toContain('"urgency"');
    });

    it("comprehensiveAnalysis prompt includes platform culture guidance", () => {
      const prompt = SYSTEM_PROMPTS.comprehensiveAnalysis;
      expect(prompt).toContain("Reddit");
      expect(prompt).toContain("Hacker News");
      expect(prompt).toContain("Product Hunt");
    });

    it("comprehensiveAnalysis prompt includes executive summary rules", () => {
      expect(SYSTEM_PROMPTS.comprehensiveAnalysis).toContain("executiveSummary");
    });

    it("all prompts are non-empty strings with meaningful length", () => {
      for (const value of Object.values(SYSTEM_PROMPTS)) {
        expect(value.length).toBeGreaterThan(50);
      }
    });

    it("aiDiscovery prompt includes scoring guide", () => {
      const prompt = SYSTEM_PROMPTS.aiDiscovery;
      expect(prompt).toContain("relevanceScore");
      expect(prompt).toContain("isMatch");
    });
  });

  describe("buildAnalysisPrompt", () => {
    it("returns system and user fields", () => {
      const result = buildAnalysisPrompt("sentimentAnalysis", "Some text to analyze");
      expect(result).toHaveProperty("system");
      expect(result).toHaveProperty("user");
    });

    it("system matches the corresponding SYSTEM_PROMPTS entry", () => {
      const result = buildAnalysisPrompt("sentimentAnalysis", "Test content");
      expect(result.system).toBe(SYSTEM_PROMPTS.sentimentAnalysis);
    });

    it("user is the raw content when no context provided", () => {
      const result = buildAnalysisPrompt("summarize", "A user posted about SaaS pricing");
      expect(result.user).toBe("A user posted about SaaS pricing");
    });

    it("includes context in user prompt when provided", () => {
      const result = buildAnalysisPrompt("painPointDetection", "This tool is broken!", {
        platform: "reddit",
        monitorName: "Brand Watch",
      });
      expect(result.user).toContain("Context:");
      expect(result.user).toContain('"platform"');
      expect(result.user).toContain("reddit");
      expect(result.user).toContain("Text to analyze:");
      expect(result.user).toContain("This tool is broken!");
    });

    it("works for all prompt types", () => {
      const types: (keyof typeof SYSTEM_PROMPTS)[] = [
        "sentimentAnalysis",
        "painPointDetection",
        "conversationCategorization",
        "summarize",
        "askAboutAudience",
        "weeklyInsights",
        "aiDiscovery",
        "comprehensiveAnalysis",
      ];

      for (const type of types) {
        const result = buildAnalysisPrompt(type, "test content");
        expect(result.system).toBeTruthy();
        expect(result.user).toBe("test content");
      }
    });

    it("serializes complex context as JSON", () => {
      const result = buildAnalysisPrompt("comprehensiveAnalysis", "Review text", {
        keywords: ["saas", "pricing"],
        platform: "hackernews",
        engagement: 150,
      });
      expect(result.user).toContain('"keywords"');
      expect(result.user).toContain("saas");
      expect(result.user).toContain("150");
    });
  });

  // COA 4 W2.6 — persona voice guard rails.
  describe("TEAM_ANALYST_PERSONA + withPersonaVoice", () => {
    it("persona introduces Kaulby and defines first-person voice", () => {
      expect(TEAM_ANALYST_PERSONA).toContain("Kaulby");
      expect(TEAM_ANALYST_PERSONA).toContain("first-person");
    });

    it("persona bans marketing-speak words", () => {
      // Voice rule violations we never want the model to echo back.
      expect(TEAM_ANALYST_PERSONA).toContain("Banned words");
      expect(TEAM_ANALYST_PERSONA).toContain("synergy");
    });

    it("persona ends with a trailing blank line so the base prompt concatenates cleanly", () => {
      expect(TEAM_ANALYST_PERSONA).toMatch(/\n\n$/);
    });

    it("withPersonaVoice prepends persona to base prompt", () => {
      const base = "ANALYZE THIS:\n  some instructions";
      const wrapped = withPersonaVoice(base);
      expect(wrapped.startsWith(TEAM_ANALYST_PERSONA)).toBe(true);
      expect(wrapped.endsWith(base)).toBe(true);
      expect(wrapped.length).toBe(TEAM_ANALYST_PERSONA.length + base.length);
    });

    it("withPersonaVoice does NOT duplicate persona if called twice (guard note)", () => {
      // We don't actively de-dupe, so a double call would produce two persona
      // blocks. This test codifies the behavior: callers MUST only wrap once.
      // If this ever changes to a dedupe implementation, update this test.
      const base = "BASE";
      const doubled = withPersonaVoice(withPersonaVoice(base));
      // Two occurrences of the persona's signature phrase.
      const matches = doubled.match(/You are Kaulby/g) ?? [];
      expect(matches.length).toBe(2);
    });
  });
});
