import { jsonCompletion } from "../openrouter";
import type { AnalysisMeta } from "./sentiment";

/**
 * Input for batch sentiment analysis
 */
export interface BatchSummaryInput {
  platformName: string;
  totalCount: number;
  sampleItems: Array<{
    title?: string;
    content: string;
    engagement?: number;
    rating?: number;
    date?: string;
  }>;
}

/**
 * Result from batch sentiment analysis
 */
export interface BatchSummaryResult {
  overallSentiment: "positive" | "negative" | "neutral" | "mixed";
  sentimentScore: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  keyThemes: string[];
  notableExamples: Array<{
    type: "positive" | "negative" | "insight";
    quote: string;
    reason: string;
  }>;
  actionableInsights: string[];
  summary: string;
}

const BATCH_SUMMARY_SYSTEM_PROMPT = `You are a brand intelligence analyst specializing in bulk review and comment analysis. Your job is to synthesize large volumes of customer feedback into actionable insights.

TASK: Analyze this batch of reviews/comments and provide a comprehensive sentiment summary with specific examples.

CONTEXT: The user is monitoring their brand across online platforms. This batch represents a sample of {totalCount} total items from {platform}. Your analysis should help them understand the overall sentiment and key themes without reading each item individually.

OUTPUT FORMAT (strict JSON):
{
  "overallSentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentimentScore": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "sentimentBreakdown": {
    "positive": <percentage as number 0-100>,
    "negative": <percentage as number 0-100>,
    "neutral": <percentage as number 0-100>
  },
  "keyThemes": ["<theme 1>", "<theme 2>", "<theme 3>", "<theme 4>", "<theme 5>"],
  "notableExamples": [
    {
      "type": "positive" | "negative" | "insight",
      "quote": "<exact quote from a review/comment, max 100 chars>",
      "reason": "<why this is notable - 1 sentence>"
    }
  ],
  "actionableInsights": [
    "<specific recommendation 1>",
    "<specific recommendation 2>",
    "<specific recommendation 3>"
  ],
  "summary": "<2-3 sentence executive summary of the overall sentiment and what the business should know>"
}

ANALYSIS GUIDELINES:
- Sentiment score should reflect the weighted average, considering engagement/ratings when available
- Key themes should be specific (e.g., "shipping delays" not just "shipping")
- Include 3-5 notable examples: at least 1 positive, 1 negative, and 1 interesting insight
- Actionable insights should be specific to this data, not generic advice
- Summary should be scannable by an executive in 10 seconds

MIXED SENTIMENT:
- Use "mixed" when positive and negative are both >30%
- Score near 0 with high variance = "mixed"`;

/**
 * Analyze a batch of items and generate a comprehensive summary
 * Cost-efficient alternative to per-item analysis for large volumes
 */
export async function analyzeBatchSentiment(
  input: BatchSummaryInput
): Promise<{ result: BatchSummaryResult; meta: AnalysisMeta }> {
  // Build the content string from sample items
  const itemsText = input.sampleItems
    .map((item, i) => {
      const parts: string[] = [];
      if (item.title) parts.push(`Title: ${item.title}`);
      if (item.rating !== undefined) parts.push(`Rating: ${item.rating}/5`);
      if (item.engagement !== undefined) parts.push(`Engagement: ${item.engagement}`);
      parts.push(`Content: ${item.content.slice(0, 500)}`);
      return `[${i + 1}] ${parts.join(" | ")}`;
    })
    .join("\n\n");

  const systemPrompt = BATCH_SUMMARY_SYSTEM_PROMPT
    .replace("{totalCount}", String(input.totalCount))
    .replace("{platform}", input.platformName);

  const userPrompt = `Analyze this sample of ${input.sampleItems.length} items from ${input.totalCount} total ${input.platformName} reviews/comments:

${itemsText}

Provide a comprehensive sentiment analysis in JSON format.`;

  const { data, meta } = await jsonCompletion<BatchSummaryResult>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  // Validate and normalize the result
  const result: BatchSummaryResult = {
    overallSentiment: data.overallSentiment || "neutral",
    sentimentScore: Math.max(-1, Math.min(1, data.sentimentScore || 0)),
    sentimentBreakdown: {
      positive: data.sentimentBreakdown?.positive || 0,
      negative: data.sentimentBreakdown?.negative || 0,
      neutral: data.sentimentBreakdown?.neutral || 0,
    },
    keyThemes: data.keyThemes?.slice(0, 5) || [],
    notableExamples: (data.notableExamples || []).slice(0, 5).map((ex) => ({
      type: ex.type || "insight",
      quote: ex.quote?.slice(0, 150) || "",
      reason: ex.reason || "",
    })),
    actionableInsights: (data.actionableInsights || []).slice(0, 5),
    summary: data.summary || "No summary available.",
  };

  return {
    result,
    meta: {
      model: meta.model,
      cost: meta.cost,
      latencyMs: meta.latencyMs,
      promptTokens: meta.promptTokens,
      completionTokens: meta.completionTokens,
    },
  };
}
