import { inngest } from "../client";
import { db, results, aiLogs } from "@/lib/db";
import { eq } from "drizzle-orm";
import { analyzeSentiment, analyzePainPoints, summarizeContent, createTrace, flushAI } from "@/lib/ai";

// Analyze content with AI
export const analyzeContent = inngest.createFunction(
  {
    id: "analyze-content",
    name: "Analyze Content",
    retries: 2,
    concurrency: {
      limit: 5, // Limit concurrent AI calls
    },
  },
  { event: "content/analyze" },
  async ({ event, step }) => {
    const { resultId, userId } = event.data;

    // Get the result
    const result = await step.run("get-result", async () => {
      return db.query.results.findFirst({
        where: eq(results.id, resultId),
      });
    });

    if (!result) {
      return { error: "Result not found" };
    }

    const contentToAnalyze = `${result.title}\n\n${result.content || ""}`;

    // Create Langfuse trace
    const trace = createTrace({
      name: "content-analysis",
      userId,
      metadata: {
        resultId,
        platform: result.platform,
      },
      tags: ["inngest", "analysis"],
    });

    const traceId = trace.id;

    // Run sentiment analysis
    const sentimentResult = await step.run("analyze-sentiment", async () => {
      return analyzeSentiment(contentToAnalyze, { userId, traceId });
    });

    // Run pain point detection
    const painPointResult = await step.run("analyze-pain-points", async () => {
      return analyzePainPoints(contentToAnalyze, { userId, traceId });
    });

    // Run summarization
    const summaryResult = await step.run("summarize-content", async () => {
      return summarizeContent(contentToAnalyze, { userId, traceId });
    });

    // Update result with AI analysis
    await step.run("update-result", async () => {
      await db
        .update(results)
        .set({
          sentiment: sentimentResult.result.sentiment,
          sentimentScore: sentimentResult.result.score,
          painPointCategory: painPointResult.result.category,
          aiSummary: summaryResult.result.summary,
        })
        .where(eq(results.id, resultId));
    });

    // Log AI usage
    await step.run("log-ai-usage", async () => {
      const totalCost =
        sentimentResult.meta.cost +
        painPointResult.meta.cost +
        summaryResult.meta.cost;

      const totalLatency =
        sentimentResult.meta.latencyMs +
        painPointResult.meta.latencyMs +
        summaryResult.meta.latencyMs;

      await db.insert(aiLogs).values({
        userId,
        model: sentimentResult.meta.model, // Use primary model as reference
        promptTokens: 0, // Aggregated
        completionTokens: 0, // Aggregated
        costUsd: totalCost,
        latencyMs: totalLatency,
        traceId,
      });
    });

    // Flush Langfuse events
    await step.run("flush-langfuse", async () => {
      await flushAI();
    });

    return {
      sentiment: sentimentResult.result,
      painPoint: painPointResult.result,
      summary: summaryResult.result,
      totalCost:
        sentimentResult.meta.cost +
        painPointResult.meta.cost +
        summaryResult.meta.cost,
    };
  }
);
