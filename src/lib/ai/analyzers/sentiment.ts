import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";

export interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  reasoning: string;
}

export async function analyzeSentiment(
  content: string,
  options?: {
    userId?: string;
    traceId?: string;
  }
): Promise<{ result: SentimentResult; meta: { model: string; cost: number; latencyMs: number } }> {
  const { system, user } = buildAnalysisPrompt("sentimentAnalysis", content);

  const { data, meta } = await jsonCompletion<SentimentResult>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    userId: options?.userId,
    traceId: options?.traceId,
  });

  return {
    result: data,
    meta: {
      model: meta.model,
      cost: meta.cost,
      latencyMs: meta.latencyMs,
    },
  };
}
