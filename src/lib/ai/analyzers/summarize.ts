import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";
import { type AnalysisMeta } from "./sentiment";

export interface SummaryResult {
  summary: string;
  topics: string[];
  actionable: boolean;
  urgency?: "high" | "medium" | "low";
}

export async function summarizeContent(
  content: string
): Promise<{ result: SummaryResult; meta: AnalysisMeta }> {
  const { system, user } = buildAnalysisPrompt("summarize", content);

  const { data, meta } = await jsonCompletion<SummaryResult>({
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
