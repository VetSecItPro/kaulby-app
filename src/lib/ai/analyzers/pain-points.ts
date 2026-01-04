import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";

export interface PainPointResult {
  category: "pain_anger" | "solution_request" | "recommendation" | "question" | null;
  confidence: number;
  keywords: string[];
  summary: string;
}

export async function analyzePainPoints(
  content: string,
  options?: {
    userId?: string;
    traceId?: string;
  }
): Promise<{ result: PainPointResult; meta: { model: string; cost: number; latencyMs: number } }> {
  const { system, user } = buildAnalysisPrompt("painPointDetection", content);

  const { data, meta } = await jsonCompletion<PainPointResult>({
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
