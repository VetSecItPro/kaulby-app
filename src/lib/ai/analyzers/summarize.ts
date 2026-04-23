import { jsonCompletion } from "../openrouter";
import { buildAnalysisPrompt } from "../prompts";
import { type AnalysisMeta } from "./sentiment";

export interface SummaryResult {
  summary: string;
  topics: string[];
  actionable: boolean;
  urgency?: "high" | "medium" | "low";
}

/**
 * Recent summary from the same monitor — used as comparative-recall context.
 * The AI references these to spot patterns ("third complaint this week"),
 * escalations, or contradictions across results.
 */
export interface PriorSummary {
  title: string;
  summary: string;
  createdAt: Date | string;
}

export async function summarizeContent(
  content: string,
  priorSummaries?: PriorSummary[]
): Promise<{ result: SummaryResult; meta: AnalysisMeta }> {
  const { system, user } = buildAnalysisPrompt("summarize", content, {
    // Only pass priorSummaries when there are any — empty arrays become
    // noise in the prompt and add tokens without signal.
    ...(priorSummaries && priorSummaries.length > 0
      ? { priorSummaries: formatPriorSummaries(priorSummaries) }
      : {}),
  });

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

/**
 * Format prior summaries for the user-message context block. Keeps the
 * payload compact (title + summary, trimmed) so we don't blow up input
 * tokens — 5 summaries × ~200 chars ≈ 1000 chars of added context, worth
 * it for the pattern-matching capability.
 */
function formatPriorSummaries(priors: PriorSummary[]): string {
  return priors
    .map((p, i) => {
      const when = new Date(p.createdAt).toISOString().split("T")[0];
      const title = p.title.slice(0, 120);
      const summary = p.summary.slice(0, 400);
      return `${i + 1}. [${when}] ${title}\n   ${summary}`;
    })
    .join("\n\n");
}
