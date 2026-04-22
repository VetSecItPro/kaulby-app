import { jsonCompletion, MODELS } from "../openrouter";
import { SYSTEM_PROMPTS, withPersonaVoice } from "../prompts";

export interface WeeklyInsightsResult {
  headline: string;
  executiveSummary?: string; // 1-2 sentence summary for executives
  keyTrends: Array<{
    trend: string;
    evidence: string;
    implication?: string;
  }>;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    dominantSentiment: "positive" | "negative" | "neutral" | "mixed";
    change?: string;
  };
  topPainPoints: string[];
  opportunities: Array<{
    type?: "engagement" | "content" | "product" | "sales";
    description: string;
    suggestedAction?: string;
  }> | string[];
  recommendations: string[];
  alertItems?: string[];
}

interface ResultForAnalysis {
  title: string;
  content?: string | null;
  platform: string;
  sentiment?: string | null;
  painPointCategory?: string | null;
  aiSummary?: string | null;
}

export async function generateWeeklyInsights(
  results: ResultForAnalysis[],
  options?: { model?: string }
): Promise<{ result: WeeklyInsightsResult; meta: { model: string; cost: number; latencyMs: number } }> {
  // Prepare data for analysis
  const sentimentCounts = {
    positive: results.filter(r => r.sentiment === "positive").length,
    negative: results.filter(r => r.sentiment === "negative").length,
    neutral: results.filter(r => r.sentiment === "neutral" || !r.sentiment).length,
  };

  const painPointCounts: Record<string, number> = {};
  for (const result of results) {
    if (result.painPointCategory) {
      painPointCounts[result.painPointCategory] = (painPointCounts[result.painPointCategory] || 0) + 1;
    }
  }

  const platformCounts: Record<string, number> = {};
  for (const result of results) {
    platformCounts[result.platform] = (platformCounts[result.platform] || 0) + 1;
  }

  // Build content for AI analysis
  const content = `
Weekly Results Summary (${results.length} total results):

Sentiment Distribution:
- Positive: ${sentimentCounts.positive}
- Negative: ${sentimentCounts.negative}
- Neutral: ${sentimentCounts.neutral}

Pain Point Categories:
${Object.entries(painPointCounts).map(([cat, count]) => `- ${cat}: ${count}`).join("\n")}

Platform Distribution:
${Object.entries(platformCounts).map(([platform, count]) => `- ${platform}: ${count}`).join("\n")}

Sample Results (top 15 by recency):
${results.slice(0, 15).map((r, i) => `
${i + 1}. "${r.title}"
   Platform: ${r.platform}
   Sentiment: ${r.sentiment || "unknown"}
   Category: ${r.painPointCategory || "uncategorized"}
   ${r.aiSummary ? `Summary: ${r.aiSummary}` : ""}
`).join("\n")}
`;

  // COA 4 W2.7 — Team tier gets Kaulby's persona voice prepended; Pro/Free
  // use the base prompt. Model selection is also caller-driven so Team tier
  // can run the weekly digest on Sonnet 4.5.
  const useTeamPersona = options?.model === MODELS.team;
  const systemPrompt = useTeamPersona
    ? withPersonaVoice(SYSTEM_PROMPTS.weeklyInsights)
    : SYSTEM_PROMPTS.weeklyInsights;

  const { data, meta } = await jsonCompletion<WeeklyInsightsResult>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ],
    model: options?.model ?? MODELS.primary,
  });

  // Supplement AI response with actual counts
  if (data.sentimentBreakdown) {
    data.sentimentBreakdown.positive = sentimentCounts.positive;
    data.sentimentBreakdown.negative = sentimentCounts.negative;
    data.sentimentBreakdown.neutral = sentimentCounts.neutral;
  }

  return {
    result: data,
    meta: {
      model: meta.model,
      cost: meta.cost,
      latencyMs: meta.latencyMs,
    },
  };
}
