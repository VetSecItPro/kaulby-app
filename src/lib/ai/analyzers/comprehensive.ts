import { jsonCompletion, MODELS } from "../openrouter";
import { SYSTEM_PROMPTS, withPersonaVoice } from "../prompts";
import { type AnalysisMeta } from "./sentiment";
import { comprehensiveResultSchema } from "../schemas";
import { sanitizeContentForAi, sanitizeFieldForAi, sanitizeFieldArrayForAi } from "../prompt-safety";

// Comprehensive analysis result for Team tier
export interface ComprehensiveAnalysisResult {
  sentiment: {
    label: "positive" | "negative" | "neutral";
    score: number;
    intensity: "strong" | "moderate" | "mild";
    emotions: string[];
  };

  classification: {
    category: "competitor_mention" | "pricing_concern" | "feature_request" | "support_need" | "negative_experience" | "positive_feedback" | "general_discussion";
    subcategory: string;
    businessImpact: "high" | "medium" | "low";
    department: "sales" | "support" | "product" | "marketing" | "leadership";
  };

  opportunity: {
    type: "sales_lead" | "testimonial" | "content_idea" | "product_feedback" | "crisis" | "engagement" | "none";
    intentScore: number;
    timeline: "immediate" | "short_term" | "exploring" | "none";
    fitScore: number;
    reasoning: string;
  };

  competitive: {
    competitorMentioned: string | null;
    theirWeakness: string | null;
    ourAdvantage: string | null;
    switchingLikelihood: "high" | "medium" | "low" | "none";
  };

  actions: {
    primary: {
      action: "respond_now" | "respond_soon" | "assign_to_team" | "monitor" | "escalate" | "log";
      priority: "critical" | "high" | "medium" | "low";
      deadline: "immediate" | "within_24h" | "within_week" | "no_rush";
      owner: "sales" | "support" | "product" | "marketing" | "leadership";
    };
    secondary: Array<{
      action: string;
      reason: string;
    }>;
  };

  suggestedResponse: {
    shouldRespond: boolean;
    tone: "helpful" | "empathetic" | "professional" | "casual" | "apologetic";
    keyPoints: string[];
    draft: string;
    doNot: string[];
  };

  contentOpportunity: {
    blogIdea: string | null;
    faqToAdd: string | null;
    caseStudy: string | null;
    socialProof: string | null;
  };

  platformContext: {
    communityRelevance: "high" | "medium" | "low";
    authorInfluence: "high" | "medium" | "low" | "unknown";
    engagementPotential: "high" | "medium" | "low";
    viralRisk: "high" | "medium" | "low";
  };

  executiveSummary: string;
}

export interface ComprehensiveAnalysisContext {
  platform: string;
  keywords: string[];
  monitorName?: string;
  businessName?: string;
  subreddit?: string;
  authorKarma?: number;
  postScore?: number;
}

/**
 * Team tier comprehensive analysis using Gemini 2.5 Flash
 * Switched from Claude Sonnet 4 ($3/$15 per 1M tokens) to Gemini Flash ($0.075/$0.30)
 * = 97% cost savings (~$7/day → $0.20/day)
 * Flash handles comprehensive analysis well for 95%+ of content
 * Provides deep, actionable intelligence for each mention
 */
export async function analyzeComprehensive(
  content: string,
  context: ComprehensiveAnalysisContext,
  options?: { model?: string }
): Promise<{ result: ComprehensiveAnalysisResult; meta: AnalysisMeta }> {
  // SEC-LLM-001/002: every user-controlled field gets sanitized before
  // interpolation. The platform string is enum-bound (typed Platform),
  // numeric fields are coerced. monitor name + keywords + business name
  // + subreddit + content go through the prompt-safety helpers.
  const safeKeywords = sanitizeFieldArrayForAi(context.keywords);
  const safeMonitorName = context.monitorName ? sanitizeFieldForAi(context.monitorName) : "";
  const safeBusinessName = context.businessName ? sanitizeFieldForAi(context.businessName) : "";
  const safeSubreddit = context.subreddit ? sanitizeFieldForAi(context.subreddit, 50) : "";
  const safeContent = sanitizeContentForAi(content);

  const userMessage = `
PLATFORM: ${context.platform}
KEYWORDS MATCHED: ${safeKeywords.join(", ")}
${safeMonitorName ? `MONITOR: ${safeMonitorName}` : ""}
${safeBusinessName ? `BUSINESS: ${safeBusinessName}` : ""}
${safeSubreddit ? `SUBREDDIT: ${safeSubreddit}` : ""}
${context.authorKarma ? `AUTHOR KARMA: ${Number(context.authorKarma)}` : ""}
${context.postScore ? `POST SCORE: ${Number(context.postScore)}` : ""}

---

MENTION TEXT:
${safeContent}
`.trim();

  // COA 4 W2.6 — Team tier gets Kaulby's persona voice prepended; Pro/Free
  // run the base prompt unchanged (cheaper, neutral output on Flash).
  const useTeamPersona = options?.model === MODELS.team;
  const systemPrompt = useTeamPersona
    ? withPersonaVoice(SYSTEM_PROMPTS.comprehensiveAnalysis)
    : SYSTEM_PROMPTS.comprehensiveAnalysis;

  const { data, meta } = await jsonCompletion<ComprehensiveAnalysisResult>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    // Caller-driven model: COA 4 W1.6 added tier routing so Team tier can pass
    // MODELS.team (Claude Sonnet 4.5) while Pro/Free continue on Flash.
    model: options?.model ?? MODELS.primary,
    // SEC-LLM-004: validate AI output structure. Starting in warn-only mode
    // (strictSchema: false) — observe failure rate in logs for ~1-2 weeks,
    // then escalate to throw once we know the prompt-vs-schema fit is solid.
    schema: comprehensiveResultSchema as unknown as import("zod").ZodSchema<ComprehensiveAnalysisResult>,
    strictSchema: false,
  });

  return {
    result: data,
    meta: {
      model: meta.model,
      cost: meta.cost,
      latencyMs: meta.latencyMs,
      promptTokens: meta.promptTokens,
      completionTokens: meta.completionTokens,
    },
  };
}

