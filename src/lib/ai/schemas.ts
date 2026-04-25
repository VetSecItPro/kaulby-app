/**
 * Zod schemas for AI analyzer outputs (SEC-LLM-004).
 *
 * Every analyzer that calls jsonCompletion<T> should pass the matching
 * schema as the `schema` parameter. Without it, jsonCompletion does
 * `JSON.parse() as T` which provides zero runtime guarantees — a model
 * hallucinating arbitrary fields/types lands in DB and UI unchecked.
 *
 * Mode:
 * - Default `strictSchema: true` — throws on mismatch. Use for paths
 *   that already have caller-side error handling and where bad data
 *   is worse than no data.
 * - `strictSchema: false` — logs warn but returns parsed data. Use for
 *   progressive rollout when you want to observe failure rates before
 *   escalating to throw. The warn includes the issue summary so you
 *   can identify schema drift in production logs.
 *
 * Adding a new analyzer:
 *   1. Define the schema here matching the prompt's OUTPUT block
 *   2. Use it via `jsonCompletion<T>({ ..., schema: yourSchema })`
 *   3. Optionally start with `strictSchema: false` for the first
 *      few weeks, then escalate
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// SENTIMENT ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export const sentimentResultSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  hasSarcasm: z.boolean().optional().default(false),
  intensity: z.enum(["strong", "moderate", "mild"]).optional(),
  primaryEmotion: z.string().optional(),
  reasoning: z.string().optional(),
});

export type SentimentResultZ = z.infer<typeof sentimentResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PAIN-POINT / CATEGORY DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export const painPointResultSchema = z.object({
  category: z
    .enum([
      "competitor_mention",
      "pricing_concern",
      "feature_request",
      "support_need",
      "negative_experience",
      "positive_feedback",
      "general_discussion",
    ])
    .nullable(),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()).default([]),
  summary: z.string(),
  businessAction: z.enum(["respond", "monitor", "escalate", "log"]).optional(),
});

export type PainPointResultZ = z.infer<typeof painPointResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARIZE
// ─────────────────────────────────────────────────────────────────────────────

export const summarizeResultSchema = z.object({
  summary: z.string().min(1),
  headline: z.string().optional(),
  topics: z.array(z.string()).default([]),
  entitiesMentioned: z
    .object({
      competitors: z.array(z.string().nullable()).optional(),
      features: z.array(z.string().nullable()).optional(),
      products: z.array(z.string().nullable()).optional(),
    })
    .optional(),
  actionable: z.boolean().optional(),
  urgency: z.enum(["critical", "high", "medium", "low"]).optional(),
  suggestedNextStep: z.string().optional(),
});

export type SummarizeResultZ = z.infer<typeof summarizeResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE (Team tier)
// ─────────────────────────────────────────────────────────────────────────────

export const comprehensiveResultSchema = z.object({
  sentiment: z.object({
    label: z.enum(["positive", "negative", "neutral"]),
    score: z.number(),
    intensity: z.enum(["strong", "moderate", "mild"]),
    emotions: z.array(z.string()).default([]),
  }),
  classification: z.object({
    category: z.enum([
      "competitor_mention",
      "pricing_concern",
      "feature_request",
      "support_need",
      "negative_experience",
      "positive_feedback",
      "general_discussion",
    ]),
    subcategory: z.string(),
    businessImpact: z.enum(["high", "medium", "low"]),
    department: z.enum(["sales", "support", "product", "marketing", "leadership"]),
  }),
  opportunity: z.object({
    type: z.enum([
      "sales_lead",
      "testimonial",
      "content_idea",
      "product_feedback",
      "crisis",
      "engagement",
      "none",
    ]),
    intentScore: z.number(),
    timeline: z.enum(["immediate", "short_term", "exploring", "none"]),
    fitScore: z.number(),
    reasoning: z.string(),
  }),
  competitive: z.object({
    competitorMentioned: z.string().nullable(),
    theirWeakness: z.string().nullable(),
    ourAdvantage: z.string().nullable(),
    switchingLikelihood: z.enum(["high", "medium", "low", "none"]),
  }),
  actions: z.object({
    primary: z.object({
      action: z.enum([
        "respond_now",
        "respond_soon",
        "assign_to_team",
        "monitor",
        "escalate",
        "log",
      ]),
      priority: z.enum(["critical", "high", "medium", "low"]),
      deadline: z.enum(["immediate", "within_24h", "within_week", "no_rush"]),
      owner: z.enum(["sales", "support", "product", "marketing", "leadership"]),
    }),
    secondary: z
      .array(
        z.object({
          action: z.string(),
          reason: z.string(),
        }),
      )
      .default([]),
  }),
  suggestedResponse: z.object({
    shouldRespond: z.boolean(),
    tone: z.enum(["helpful", "empathetic", "professional", "casual", "apologetic"]),
    keyPoints: z.array(z.string()).default([]),
    draft: z.string(),
    doNot: z.array(z.string()).default([]),
  }),
  contentOpportunity: z.object({
    blogIdea: z.string().nullable(),
    faqToAdd: z.string().nullable(),
    caseStudy: z.string().nullable(),
    socialProof: z.string().nullable(),
  }),
  platformContext: z.object({
    communityRelevance: z.enum(["high", "medium", "low"]),
    authorInfluence: z.enum(["high", "medium", "low", "unknown"]),
    engagementPotential: z.enum(["high", "medium", "low"]),
    viralRisk: z.enum(["high", "medium", "low"]),
  }),
  executiveSummary: z.string(),
});

export type ComprehensiveResultZ = z.infer<typeof comprehensiveResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

export const conversationCategoryResultSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
});

export type ConversationCategoryResultZ = z.infer<typeof conversationCategoryResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// BATCH SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

export const batchSummaryResultSchema = z.object({
  summary: z.string(),
  topThemes: z.array(z.string()).default([]),
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]).optional(),
  recommendations: z.array(z.string()).default([]),
});

export type BatchSummaryResultZ = z.infer<typeof batchSummaryResultSchema>;
