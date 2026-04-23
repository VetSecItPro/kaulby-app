/**
 * Shared helper for computing weekly AI insights for a user.
 *
 * Extracted from send-alerts.ts so BOTH the legacy weekly-digest path
 * (alert-subscribed monitors) AND the new Monday 9am weekly-digest cron
 * (all pro/team users) can share the same AI call + cost-logging path.
 *
 * This is a PURE extraction: semantics match the original inline block
 * inside send-alerts.ts' sendDigestForTimezone. Any behavior change here
 * affects both callers intentionally.
 */

import type { PlanKey } from "@/lib/plans";
import type { WeeklyInsights } from "@/lib/email";
import { generateWeeklyInsights } from "@/lib/ai";
import { MODELS } from "@/lib/ai/openrouter";
import { logAiCall } from "@/lib/ai/log";
import { logger } from "@/lib/logger";

/** Minimal Inngest step interface — same shape used in send-alerts.ts. */
interface InsightsStep {
  run<T>(id: string, callback: () => Promise<T>): Promise<T>;
}

export interface InsightResult {
  title: string;
  content: string | null;
  platform: string;
  sentiment: string | null;
  painPointCategory: string | null;
  aiSummary: string | null;
}

/**
 * Generate weekly AI insights for the given user's results.
 *
 * Returns undefined when:
 *   - there are fewer than 5 results (not enough signal),
 *   - the AI call fails (logged, never thrown — digests must still ship).
 *
 * Cost: one jsonCompletion call (~$0.005-0.02 depending on model), logged
 * to aiLogs with analysisType "weekly-insights".
 *
 * @param userId - owner, used for cost attribution in aiLogs
 * @param results - already-fetched results window (caller decides the window)
 * @param step - Inngest step to wrap the AI call (idempotency across retries)
 * @param minResults - floor for attempting the call; default 5
 */
export async function computeWeeklyInsightsFor(
  userId: string,
  results: InsightResult[],
  step: InsightsStep,
  minResults = 5,
  plan?: PlanKey
): Promise<WeeklyInsights | undefined> {
  if (results.length < minResults) return undefined;

  try {
    // COA 4 W2.7: Team tier → Sonnet 4.5 + persona voice; Pro/Free → Flash.
    // The weekly digest is user-visible, so consistent voice across
    // comprehensive analysis (W1.7), /ai/ask (W2.8), and now the digest
    // is what makes "one analyst, one story" feel real.
    const modelForTier = plan === "growth" ? MODELS.team : MODELS.primary;

    const insightsResult = await step.run(`generate-insights-${userId}`, async () => {
      return generateWeeklyInsights(results, { model: modelForTier });
    });
    const raw = insightsResult.result;

    // Log AI cost — parity with the inline block previously in send-alerts.ts.
    await logAiCall({
      userId,
      model: insightsResult.meta.model,
      promptTokens: 0, // generateWeeklyInsights doesn't return token counts
      completionTokens: 0,
      costUsd: insightsResult.meta.cost,
      latencyMs: insightsResult.meta.latencyMs,
      analysisType: "weekly-insights",
    });

    return {
      ...raw,
      // Normalize opportunities to string[] (WeeklyInsightsResult may return objects)
      opportunities: raw.opportunities.map((o) =>
        typeof o === "string" ? o : o.description
      ),
    };
  } catch (error) {
    logger.error("Failed to generate AI insights", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
