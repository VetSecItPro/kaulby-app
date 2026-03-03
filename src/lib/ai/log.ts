import { db } from "@/lib/db";
import { aiLogs } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

/**
 * Shared utility to log AI calls to the ai_logs table for cost tracking.
 *
 * Used by all AI call sites: content analysis, ask AI, suggest reply,
 * insights, subreddit finder, weekly insights, and X search.
 */
export async function logAiCall(params: {
  userId?: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  traceId?: string;
  monitorId?: string;
  resultId?: string;
  analysisType: string;
  cacheHit?: boolean;
  platform?: string;
}) {
  try {
    await db.insert(aiLogs).values({
      userId: params.userId ?? undefined,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      costUsd: params.costUsd,
      latencyMs: params.latencyMs,
      traceId: params.traceId,
      monitorId: params.monitorId,
      resultId: params.resultId,
      analysisType: params.analysisType,
      cacheHit: params.cacheHit ?? false,
      platform: params.platform,
    });
  } catch (error) {
    // Never let logging failures crash the main operation
    logger.error("Failed to log AI call", {
      error: error instanceof Error ? error.message : String(error),
      analysisType: params.analysisType,
    });
  }
}
