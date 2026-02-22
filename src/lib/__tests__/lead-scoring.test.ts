import { describe, it, expect } from "vitest";
import { calculateLeadScore } from "../ai/lead-scoring";

describe("calculateLeadScore", () => {
  describe("intent scoring", () => {
    it("scores high for high-intent phrases", () => {
      const result = calculateLeadScore({
        title: "Looking for a tool to monitor social media",
      });
      expect(result.intent).toBeGreaterThanOrEqual(15);
    });

    it("scores higher for multiple high-intent phrases", () => {
      const single = calculateLeadScore({
        title: "Looking for a solution",
      });
      const multiple = calculateLeadScore({
        title: "Looking for a solution, alternatives to competitor, ready to pay",
      });
      expect(multiple.intent).toBeGreaterThan(single.intent);
    });

    it("scores medium for medium-intent phrases", () => {
      const result = calculateLeadScore({
        title: "How do you handle social media monitoring?",
      });
      expect(result.intent).toBeGreaterThanOrEqual(5);
      expect(result.intent).toBeLessThanOrEqual(10);
    });

    it("scores zero for no intent phrases", () => {
      const result = calculateLeadScore({
        title: "Nice sunset photo from today",
      });
      expect(result.intent).toBe(0);
    });

    it("detects intent in content as well as title", () => {
      const result = calculateLeadScore({
        title: "Help needed",
        content: "I am looking for the best tool for monitoring",
      });
      expect(result.intent).toBeGreaterThanOrEqual(15);
    });

    it("caps intent at 40", () => {
      const result = calculateLeadScore({
        title: "looking for best tool for alternatives to vs compared to which is better",
        content: "frustrated with struggling with tired of in the market for ready to pay willing to pay budget for",
      });
      expect(result.intent).toBeLessThanOrEqual(40);
    });
  });

  describe("engagement scoring", () => {
    it("returns 0 for no engagement", () => {
      const result = calculateLeadScore({
        title: "Test",
        engagementScore: 0,
      });
      expect(result.engagement).toBe(0);
    });

    it("returns 0 for null engagement", () => {
      const result = calculateLeadScore({
        title: "Test",
        engagementScore: null,
      });
      expect(result.engagement).toBe(0);
    });

    it("scores low engagement (1-10)", () => {
      const result = calculateLeadScore({
        title: "Test",
        engagementScore: 5,
      });
      expect(result.engagement).toBeGreaterThan(0);
      expect(result.engagement).toBeLessThanOrEqual(5);
    });

    it("scores medium engagement (10-50)", () => {
      const result = calculateLeadScore({
        title: "Test",
        engagementScore: 30,
      });
      expect(result.engagement).toBeGreaterThanOrEqual(5);
      expect(result.engagement).toBeLessThanOrEqual(10);
    });

    it("scores high engagement (50-100)", () => {
      const result = calculateLeadScore({
        title: "Test",
        engagementScore: 75,
      });
      expect(result.engagement).toBeGreaterThanOrEqual(10);
      expect(result.engagement).toBeLessThanOrEqual(15);
    });

    it("scores very high engagement (100+)", () => {
      const result = calculateLeadScore({
        title: "Test",
        engagementScore: 500,
      });
      expect(result.engagement).toBeGreaterThanOrEqual(15);
      expect(result.engagement).toBeLessThanOrEqual(20);
    });
  });

  describe("recency scoring", () => {
    it("gives 15 for posts less than 24 hours old", () => {
      const result = calculateLeadScore({
        title: "Test",
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
      });
      expect(result.recency).toBe(15);
    });

    it("gives 12 for 1-3 day old posts", () => {
      const result = calculateLeadScore({
        title: "Test",
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      });
      expect(result.recency).toBe(12);
    });

    it("gives 9 for 3-7 day old posts", () => {
      const result = calculateLeadScore({
        title: "Test",
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 120), // 5 days ago
      });
      expect(result.recency).toBe(9);
    });

    it("gives 6 for 7-14 day old posts", () => {
      const result = calculateLeadScore({
        title: "Test",
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 240), // 10 days ago
      });
      expect(result.recency).toBe(6);
    });

    it("gives 3 for 14-30 day old posts", () => {
      const result = calculateLeadScore({
        title: "Test",
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 480), // 20 days ago
      });
      expect(result.recency).toBe(3);
    });

    it("gives 1 for 30+ day old posts", () => {
      const result = calculateLeadScore({
        title: "Test",
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60), // 60 days ago
      });
      expect(result.recency).toBe(1);
    });

    it("defaults to 7 when postedAt is null", () => {
      const result = calculateLeadScore({
        title: "Test",
        postedAt: null,
      });
      expect(result.recency).toBe(7);
    });
  });

  describe("author quality scoring", () => {
    it("gives max score for high karma + old account", () => {
      const result = calculateLeadScore({
        title: "Test",
        authorKarma: 15000,
        authorAccountAgeDays: 365 * 3,
      });
      expect(result.authorQuality).toBe(15);
    });

    it("gives low score for low karma + new account", () => {
      const result = calculateLeadScore({
        title: "Test",
        authorKarma: 50,
        authorAccountAgeDays: 10,
      });
      expect(result.authorQuality).toBeLessThanOrEqual(3);
    });

    it("defaults to 7 when both are null", () => {
      const result = calculateLeadScore({
        title: "Test",
        authorKarma: null,
        authorAccountAgeDays: null,
      });
      expect(result.authorQuality).toBe(7);
    });

    it("uses defaults for missing fields individually", () => {
      const karmaOnly = calculateLeadScore({
        title: "Test",
        authorKarma: 5000,
        authorAccountAgeDays: undefined,
      });
      // karma=8, accountAge default=2 => 10
      expect(karmaOnly.authorQuality).toBe(10);
    });
  });

  describe("category scoring", () => {
    it("gives 10 for solution_request", () => {
      const result = calculateLeadScore({
        title: "Test",
        conversationCategory: "solution_request",
      });
      expect(result.category).toBe(10);
    });

    it("gives 8 for money_talk", () => {
      const result = calculateLeadScore({
        title: "Test",
        conversationCategory: "money_talk",
      });
      expect(result.category).toBe(8);
    });

    it("gives 6 for pain_point", () => {
      const result = calculateLeadScore({
        title: "Test",
        conversationCategory: "pain_point",
      });
      expect(result.category).toBe(6);
    });

    it("gives 4 for advice_request", () => {
      const result = calculateLeadScore({
        title: "Test",
        conversationCategory: "advice_request",
      });
      expect(result.category).toBe(4);
    });

    it("gives 3 for hot_discussion", () => {
      const result = calculateLeadScore({
        title: "Test",
        conversationCategory: "hot_discussion",
      });
      expect(result.category).toBe(3);
    });

    it("gives 2 for unknown category", () => {
      const result = calculateLeadScore({
        title: "Test",
        conversationCategory: null,
      });
      expect(result.category).toBe(2);
    });
  });

  describe("total score", () => {
    it("sums all component scores", () => {
      const result = calculateLeadScore({
        title: "Test",
      });
      expect(result.total).toBe(
        result.intent +
          result.engagement +
          result.recency +
          result.authorQuality +
          result.category
      );
    });

    it("produces high score for ideal lead", () => {
      const result = calculateLeadScore({
        title: "Looking for the best tool for social media monitoring, alternatives to Brandwatch",
        content: "We're ready to pay for a good solution. Frustrated with our current tool.",
        conversationCategory: "solution_request",
        engagementScore: 200,
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        authorKarma: 20000,
        authorAccountAgeDays: 365 * 5,
      });
      expect(result.total).toBeGreaterThanOrEqual(70);
    });

    it("produces low score for poor lead", () => {
      const result = calculateLeadScore({
        title: "Nice photo",
        engagementScore: 0,
        postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90), // 90 days ago
        authorKarma: 10,
        authorAccountAgeDays: 5,
      });
      expect(result.total).toBeLessThanOrEqual(15);
    });

    it("returns LeadScoreFactors shape", () => {
      const result = calculateLeadScore({ title: "Test" });
      expect(result).toHaveProperty("intent");
      expect(result).toHaveProperty("engagement");
      expect(result).toHaveProperty("recency");
      expect(result).toHaveProperty("authorQuality");
      expect(result).toHaveProperty("category");
      expect(result).toHaveProperty("total");
    });
  });
});
