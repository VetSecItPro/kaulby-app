import { inngest } from "../client";
import { db } from "@/lib/db";
import { results, monitors, aiLogs } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { analyzeBatchSentiment } from "@/lib/ai/analyzers/batch-summary";
import { selectRepresentativeSample, AI_BATCH_CONFIG, type SampleableItem } from "@/lib/ai/sampling";
import { createTrace, flushAI } from "@/lib/ai";
import { incrementAiCallsCount } from "@/lib/limits";
import { getPlatformDisplayName } from "@/lib/platform-utils";

/**
 * Batch analyze content - cost-efficient alternative for large volumes
 *
 * Instead of analyzing each result individually ($0.02-0.05 each),
 * this samples 25 representative items and generates a single summary ($0.10-0.20 total).
 *
 * Triggered when a monitor scan returns >50 results.
 */
export const analyzeContentBatch = inngest.createFunction(
  {
    id: "analyze-content-batch",
    name: "Analyze Content (Batch)",
    retries: 2,
    concurrency: {
      limit: 3, // Limit concurrent batch analyses
    },
  },
  { event: "content/analyze-batch" },
  async ({ event, step }) => {
    const { monitorId, userId, platform, resultIds, totalCount } = event.data;

    // Get the results to sample from
    const allResults = await step.run("get-results", async () => {
      return db.query.results.findMany({
        where: inArray(results.id, resultIds),
      });
    });

    if (allResults.length === 0) {
      return { error: "No results found" };
    }

    // Convert to sampleable items
    const sampleableItems: SampleableItem[] = allResults.map((r) => {
      const metadata = r.metadata as Record<string, unknown> | null;
      // Convert date to Date object
      const dateValue = r.postedAt || r.createdAt;
      return {
        id: r.id,
        content: r.content || "",
        title: r.title,
        engagement: (metadata?.upvotes as number) || (metadata?.score as number) || 0,
        rating: (metadata?.rating as number) || undefined,
        createdAt: new Date(dateValue),
      };
    });

    // Select representative sample
    const sample = await step.run("select-sample", async () => {
      return selectRepresentativeSample(sampleableItems, {
        sampleSize: AI_BATCH_CONFIG.BATCH_SAMPLE_SIZE,
      });
    });

    // Get full result data for the sample
    const sampleResults = await step.run("get-sample-results", async () => {
      const sampleIds = sample.map((s) => s.id);
      return db.query.results.findMany({
        where: inArray(results.id, sampleIds),
      });
    });

    // Create Langfuse trace
    const trace = createTrace({
      name: "batch-content-analysis",
      userId,
      metadata: {
        monitorId,
        platform,
        totalCount,
        sampleSize: sample.length,
      },
      tags: ["inngest", "batch-analysis", platform],
    });

    const traceId = trace.id;

    // Build sample items for batch analysis
    const sampleItems = sampleResults.map((r) => {
      const metadata = r.metadata as Record<string, unknown> | null;
      // Convert date to ISO string
      const dateValue = r.postedAt || r.createdAt;
      return {
        title: r.title,
        content: r.content || "",
        engagement: (metadata?.upvotes as number) || (metadata?.score as number) || 0,
        rating: (metadata?.rating as number) || undefined,
        date: new Date(dateValue).toISOString(),
      };
    });

    // Run batch AI analysis
    const analysisResult = await step.run("batch-analyze", async () => {
      return analyzeBatchSentiment({
        platformName: getPlatformDisplayName(platform),
        totalCount,
        sampleItems,
      });
    });

    const batchAnalysis = analysisResult.result;

    // Store batch analysis on the monitor
    await step.run("store-batch-analysis", async () => {
      await db
        .update(monitors)
        .set({
          batchAnalysis: JSON.stringify(batchAnalysis),
          lastBatchAnalyzedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(monitors.id, monitorId));
    });

    // Mark all results as batch-analyzed and apply the overall sentiment
    await step.run("mark-results-batch-analyzed", async () => {
      // Map overall sentiment to individual sentiment
      const sentiment = batchAnalysis.overallSentiment === "mixed"
        ? "neutral"
        : batchAnalysis.overallSentiment;

      await db
        .update(results)
        .set({
          batchAnalyzed: true,
          sentiment,
          sentimentScore: batchAnalysis.sentimentScore,
          // Store reference to batch analysis
          aiAnalysis: JSON.stringify({
            tier: "batch",
            batchAnalyzed: true,
            monitorId,
            overallSentiment: batchAnalysis.overallSentiment,
            sentimentScore: batchAnalysis.sentimentScore,
            analyzedAt: new Date().toISOString(),
          }),
        })
        .where(inArray(results.id, resultIds));
    });

    // Log AI usage
    await step.run("log-ai-usage", async () => {
      await db.insert(aiLogs).values({
        userId,
        model: analysisResult.meta.model,
        promptTokens: analysisResult.meta.promptTokens,
        completionTokens: analysisResult.meta.completionTokens,
        costUsd: analysisResult.meta.cost,
        latencyMs: analysisResult.meta.latencyMs,
        traceId,
      });

      await incrementAiCallsCount(userId, 1); // Only 1 AI call for entire batch
    });

    // Flush Langfuse events
    await step.run("flush-langfuse", async () => {
      await flushAI();
    });

    return {
      mode: "batch",
      platform,
      totalCount,
      sampleSize: sample.length,
      batchAnalysis,
      cost: analysisResult.meta.cost,
      model: analysisResult.meta.model,
    };
  }
);

/**
 * Helper to determine if batch mode should be used
 */
export function shouldUseBatchMode(resultCount: number): boolean {
  return resultCount > AI_BATCH_CONFIG.BATCH_THRESHOLD;
}
