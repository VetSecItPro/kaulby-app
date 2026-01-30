import { jsonCompletion, MODELS } from "../openrouter";
import { SYSTEM_PROMPTS } from "../prompts";
import { type AnalysisMeta } from "./sentiment";

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
  context: ComprehensiveAnalysisContext
): Promise<{ result: ComprehensiveAnalysisResult; meta: AnalysisMeta }> {
  // Build context-aware user message
  const userMessage = `
PLATFORM: ${context.platform}
KEYWORDS MATCHED: ${context.keywords.join(", ")}
${context.monitorName ? `MONITOR: ${context.monitorName}` : ""}
${context.businessName ? `BUSINESS: ${context.businessName}` : ""}
${context.subreddit ? `SUBREDDIT: ${context.subreddit}` : ""}
${context.authorKarma ? `AUTHOR KARMA: ${context.authorKarma}` : ""}
${context.postScore ? `POST SCORE: ${context.postScore}` : ""}

---

MENTION TEXT:
${content}
`.trim();

  const { data, meta } = await jsonCompletion<ComprehensiveAnalysisResult>({
    messages: [
      { role: "system", content: SYSTEM_PROMPTS.comprehensiveAnalysis },
      { role: "user", content: userMessage },
    ],
    model: MODELS.premium, // Use Claude Sonnet 4 for deep analysis
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

