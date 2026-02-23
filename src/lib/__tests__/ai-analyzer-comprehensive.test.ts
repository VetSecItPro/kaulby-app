import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJsonCompletion = vi.fn();

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
  MODELS: { premium: "google/gemini-2.5-flash" },
}));

vi.mock("@/lib/ai/prompts", () => ({
  SYSTEM_PROMPTS: {
    comprehensiveAnalysis: "You are a comprehensive analyzer...",
  },
}));

describe("ai/analyzers/comprehensive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns comprehensive analysis with all fields", async () => {
    const mockResponse = {
      data: {
        sentiment: {
          label: "positive",
          score: 0.8,
          intensity: "strong",
          emotions: ["excitement", "satisfaction"],
        },
        classification: {
          category: "positive_feedback",
          subcategory: "product_praise",
          businessImpact: "high",
          department: "product",
        },
        opportunity: {
          type: "testimonial",
          intentScore: 0.9,
          timeline: "immediate",
          fitScore: 0.85,
          reasoning: "Strong product advocate",
        },
        competitive: {
          competitorMentioned: null,
          theirWeakness: null,
          ourAdvantage: null,
          switchingLikelihood: "none",
        },
        actions: {
          primary: {
            action: "respond_now",
            priority: "high",
            deadline: "within_24h",
            owner: "marketing",
          },
          secondary: [{ action: "Feature in case study", reason: "Strong testimonial" }],
        },
        suggestedResponse: {
          shouldRespond: true,
          tone: "professional",
          keyPoints: ["Thank for feedback", "Offer to feature"],
          draft: "Thank you for the positive feedback!",
          doNot: ["Be overly salesy"],
        },
        contentOpportunity: {
          blogIdea: "User success story",
          faqToAdd: null,
          caseStudy: "Feature this user",
          socialProof: "Use as testimonial",
        },
        platformContext: {
          communityRelevance: "high",
          authorInfluence: "medium",
          engagementPotential: "high",
          viralRisk: "low",
        },
        executiveSummary: "Strong product advocate with testimonial potential",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.025,
        latencyMs: 3500,
        promptTokens: 800,
        completionTokens: 600,
      },
    };

    mockJsonCompletion.mockResolvedValue(mockResponse);

    const { analyzeComprehensive } = await import("@/lib/ai/analyzers/comprehensive");

    const result = await analyzeComprehensive("Love this product! Best tool ever.", {
      platform: "reddit",
      keywords: ["product"],
      monitorName: "Brand Monitor",
    });

    expect(result.result.sentiment.label).toBe("positive");
    expect(result.result.classification.category).toBe("positive_feedback");
    expect(result.result.opportunity.type).toBe("testimonial");
    expect(result.result.actions.primary.action).toBe("respond_now");
    expect(result.meta.model).toBe("google/gemini-2.5-flash");
  });

  it("includes context in user prompt", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: { label: "neutral", score: 0, intensity: "mild", emotions: [] },
        classification: { category: "general_discussion", subcategory: "info", businessImpact: "low", department: "sales" },
        opportunity: { type: "none", intentScore: 0, timeline: "none", fitScore: 0, reasoning: "" },
        competitive: { competitorMentioned: null, theirWeakness: null, ourAdvantage: null, switchingLikelihood: "none" },
        actions: { primary: { action: "log", priority: "low", deadline: "no_rush", owner: "sales" }, secondary: [] },
        suggestedResponse: { shouldRespond: false, tone: "professional", keyPoints: [], draft: "", doNot: [] },
        contentOpportunity: { blogIdea: null, faqToAdd: null, caseStudy: null, socialProof: null },
        platformContext: { communityRelevance: "low", authorInfluence: "low", engagementPotential: "low", viralRisk: "low" },
        executiveSummary: "Low priority",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.02,
        latencyMs: 2500,
        promptTokens: 600,
        completionTokens: 400,
      },
    });

    const { analyzeComprehensive } = await import("@/lib/ai/analyzers/comprehensive");

    await analyzeComprehensive("Test content", {
      platform: "hackernews",
      keywords: ["saas", "startup"],
      monitorName: "HN Monitor",
      businessName: "Acme Corp",
      subreddit: "startups",
      authorKarma: 5000,
      postScore: 150,
    });

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("PLATFORM: hackernews");
    expect(userMessage).toContain("KEYWORDS MATCHED: saas, startup");
    expect(userMessage).toContain("MONITOR: HN Monitor");
    expect(userMessage).toContain("BUSINESS: Acme Corp");
    expect(userMessage).toContain("SUBREDDIT: startups");
    expect(userMessage).toContain("AUTHOR KARMA: 5000");
    expect(userMessage).toContain("POST SCORE: 150");
  });

  it("works with minimal context", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: { label: "negative", score: -0.6, intensity: "moderate", emotions: ["frustration"] },
        classification: { category: "negative_experience", subcategory: "bug", businessImpact: "medium", department: "support" },
        opportunity: { type: "crisis", intentScore: 0.3, timeline: "immediate", fitScore: 0.4, reasoning: "Unhappy user" },
        competitive: { competitorMentioned: null, theirWeakness: null, ourAdvantage: null, switchingLikelihood: "low" },
        actions: { primary: { action: "respond_now", priority: "high", deadline: "immediate", owner: "support" }, secondary: [] },
        suggestedResponse: { shouldRespond: true, tone: "apologetic", keyPoints: ["Acknowledge", "Fix"], draft: "Sorry", doNot: ["Dismiss"] },
        contentOpportunity: { blogIdea: null, faqToAdd: "How to report bugs", caseStudy: null, socialProof: null },
        platformContext: { communityRelevance: "high", authorInfluence: "medium", engagementPotential: "medium", viralRisk: "medium" },
        executiveSummary: "Bug report needs immediate attention",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.022,
        latencyMs: 2800,
        promptTokens: 650,
        completionTokens: 450,
      },
    });

    const { analyzeComprehensive } = await import("@/lib/ai/analyzers/comprehensive");

    await analyzeComprehensive("App is broken", {
      platform: "twitter",
      keywords: ["bug"],
    });

    const call = mockJsonCompletion.mock.calls[0][0];
    const userMessage = call.messages[1].content;

    expect(userMessage).toContain("PLATFORM: twitter");
    expect(userMessage).toContain("KEYWORDS MATCHED: bug");
  });

  it("uses premium model", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: { label: "neutral", score: 0, intensity: "mild", emotions: [] },
        classification: { category: "general_discussion", subcategory: "", businessImpact: "low", department: "sales" },
        opportunity: { type: "none", intentScore: 0, timeline: "none", fitScore: 0, reasoning: "" },
        competitive: { competitorMentioned: null, theirWeakness: null, ourAdvantage: null, switchingLikelihood: "none" },
        actions: { primary: { action: "log", priority: "low", deadline: "no_rush", owner: "sales" }, secondary: [] },
        suggestedResponse: { shouldRespond: false, tone: "professional", keyPoints: [], draft: "", doNot: [] },
        contentOpportunity: { blogIdea: null, faqToAdd: null, caseStudy: null, socialProof: null },
        platformContext: { communityRelevance: "low", authorInfluence: "low", engagementPotential: "low", viralRisk: "low" },
        executiveSummary: "Low priority",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.018,
        latencyMs: 2200,
        promptTokens: 550,
        completionTokens: 350,
      },
    });

    const { analyzeComprehensive } = await import("@/lib/ai/analyzers/comprehensive");

    await analyzeComprehensive("Test", {
      platform: "reddit",
      keywords: [],
    });

    const call = mockJsonCompletion.mock.calls[0][0];
    expect(call.model).toBe("google/gemini-2.5-flash");
  });

  it("returns all metadata fields", async () => {
    mockJsonCompletion.mockResolvedValue({
      data: {
        sentiment: { label: "positive", score: 0.5, intensity: "moderate", emotions: [] },
        classification: { category: "feature_request", subcategory: "enhancement", businessImpact: "medium", department: "product" },
        opportunity: { type: "product_feedback", intentScore: 0.6, timeline: "short_term", fitScore: 0.7, reasoning: "Feature req" },
        competitive: { competitorMentioned: null, theirWeakness: null, ourAdvantage: null, switchingLikelihood: "none" },
        actions: { primary: { action: "assign_to_team", priority: "medium", deadline: "within_week", owner: "product" }, secondary: [] },
        suggestedResponse: { shouldRespond: true, tone: "helpful", keyPoints: [], draft: "", doNot: [] },
        contentOpportunity: { blogIdea: null, faqToAdd: null, caseStudy: null, socialProof: null },
        platformContext: { communityRelevance: "medium", authorInfluence: "low", engagementPotential: "medium", viralRisk: "low" },
        executiveSummary: "Feature request",
      },
      meta: {
        model: "google/gemini-2.5-flash",
        cost: 0.023,
        latencyMs: 2900,
        promptTokens: 700,
        completionTokens: 500,
      },
    });

    const { analyzeComprehensive } = await import("@/lib/ai/analyzers/comprehensive");

    const result = await analyzeComprehensive("Would love to see feature X", {
      platform: "producthunt",
      keywords: ["feature"],
    });

    expect(result.meta).toHaveProperty("model");
    expect(result.meta).toHaveProperty("cost");
    expect(result.meta).toHaveProperty("latencyMs");
    expect(result.meta).toHaveProperty("promptTokens");
    expect(result.meta).toHaveProperty("completionTokens");
  });
});
