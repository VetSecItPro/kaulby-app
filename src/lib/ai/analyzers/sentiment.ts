import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";

export interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  reasoning: string;
}

export interface AnalysisMeta {
  model: string;
  cost: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

export async function analyzeSentiment(
  content: string
): Promise<{ result: SentimentResult; meta: AnalysisMeta }> {
  const { system, user } = buildAnalysisPrompt("sentimentAnalysis", content);

  const { data, meta } = await jsonCompletion<SentimentResult>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
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
