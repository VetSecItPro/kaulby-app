import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";

export interface PainPointResult {
  category: "pain_point" | "solution_request" | "question" | "feature_request" | "praise" | "discussion" | null;
  confidence: number;
  keywords: string[];
  summary: string;
}

export async function analyzePainPoints(
  content: string
): Promise<{ result: PainPointResult; meta: { model: string; cost: number; latencyMs: number } }> {
  const { system, user } = buildAnalysisPrompt("painPointDetection", content);

  const { data, meta } = await jsonCompletion<PainPointResult>({
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
    },
  };
}
