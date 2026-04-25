import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";
import { type AnalysisMeta } from "./sentiment";
import { painPointResultSchema } from "../schemas";

export interface PainPointResult {
  category: "competitor_mention" | "pricing_concern" | "feature_request" | "support_need" | "negative_experience" | "positive_feedback" | "general_discussion" | null;
  confidence: number;
  keywords: string[];
  summary: string;
  businessAction?: "respond" | "monitor" | "escalate" | "log";
}

export async function analyzePainPoints(
  content: string
): Promise<{ result: PainPointResult; meta: AnalysisMeta }> {
  const { system, user } = buildAnalysisPrompt("painPointDetection", content);

  const { data, meta } = await jsonCompletion<PainPointResult>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    // SEC-LLM-004: warn-only schema validation
    schema: painPointResultSchema as unknown as import("zod").ZodSchema<PainPointResult>,
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
