import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";

export interface SummaryResult {
  summary: string;
  topics: string[];
  actionable: boolean;
}

export async function summarizeContent(
  content: string
): Promise<{ result: SummaryResult; meta: { model: string; cost: number; latencyMs: number } }> {
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
    },
  };
}
