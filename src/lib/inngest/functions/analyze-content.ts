import { inngest } from "../client";
import { db } from "@/lib/db";
import { results, aiLogs, monitors } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import {
  analyzeSentiment,
  analyzePainPoints,
  summarizeContent,
  analyzeComprehensive,
  createTrace,
  flushAI,
  type ComprehensiveAnalysisContext,
} from "@/lib/ai";
import { incrementAiCallsCount, getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/stripe";

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

    // Check user's plan for AI access
    const planCheck = await step.run("check-plan", async () => {
      const plan = await getUserPlan(userId);
      const limits = getPlanLimits(plan);
      return {
        plan,
        hasUnlimitedAi: limits.aiFeatures.unlimitedAiAnalysis,
        useComprehensiveAnalysis: limits.aiFeatures.comprehensiveAnalysis,
      };
    });

    // For free users, only analyze first result
    if (!planCheck.hasUnlimitedAi) {
      const userResultCount = await step.run("count-user-results", async () => {
        const [countResult] = await db
          .select({ count: count() })
          .from(results)
          .where(eq(results.monitorId, result.monitorId));
        return countResult?.count || 0;
      });

      // Skip AI analysis if this is not the first result
      if (userResultCount > 1) {
        return {
          skipped: true,
          reason: "Free tier - AI analysis limited to first result",
          plan: planCheck.plan,
        };
      }
    }

    const contentToAnalyze = `${result.title}\n\n${result.content || ""}`;

    // Create Langfuse trace
    const trace = createTrace({
      name: "content-analysis",
      userId,
      metadata: {
        resultId,
        platform: result.platform,
        tier: planCheck.useComprehensiveAnalysis ? "team" : "pro",
      },
      tags: ["inngest", "analysis", planCheck.useComprehensiveAnalysis ? "team-tier" : "pro-tier"],
    });

    const traceId = trace.id;

    // =========================================================================
    // TEAM TIER: Comprehensive Analysis (Claude Sonnet 4)
    // =========================================================================
    if (planCheck.useComprehensiveAnalysis) {
      // Get monitor info for context
      const monitor = await step.run("get-monitor", async () => {
        return db.query.monitors.findFirst({
          where: eq(monitors.id, result.monitorId),
          with: { user: true },
        });
      });

      // Type assertion for metadata which stores platform-specific fields
      const metadata = result.metadata as Record<string, unknown> | null;

      const context: ComprehensiveAnalysisContext = {
        platform: result.platform,
        keywords: monitor?.keywords || [],
        monitorName: monitor?.name || "Unknown Monitor",
        businessName: undefined, // Can be added to user profile later
        subreddit: (metadata?.subreddit as string) || undefined,
      };

      const comprehensiveResult = await step.run("analyze-comprehensive", async () => {
        return analyzeComprehensive(contentToAnalyze, context);
      });

      const analysis = comprehensiveResult.result;

      // Update result with comprehensive AI analysis
      await step.run("update-result-team", async () => {
        await db
          .update(results)
          .set({
            sentiment: analysis.sentiment.label,
            sentimentScore: analysis.sentiment.score,
            painPointCategory: analysis.classification.category,
            aiSummary: analysis.executiveSummary,
            // Store full analysis as JSON metadata
            aiAnalysis: JSON.stringify({
              tier: "team",
              sentiment: analysis.sentiment,
              classification: analysis.classification,
              opportunity: analysis.opportunity,
              competitive: analysis.competitive,
              actions: analysis.actions,
              suggestedResponse: analysis.suggestedResponse,
              contentOpportunity: analysis.contentOpportunity,
              platformContext: analysis.platformContext,
              executiveSummary: analysis.executiveSummary,
              analyzedAt: new Date().toISOString(),
            }),
          })
          .where(eq(results.id, resultId));
      });

      // Log AI usage for Team tier
      await step.run("log-ai-usage-team", async () => {
        await db.insert(aiLogs).values({
          userId,
          model: comprehensiveResult.meta.model,
          promptTokens: comprehensiveResult.meta.promptTokens,
          completionTokens: comprehensiveResult.meta.completionTokens,
          costUsd: comprehensiveResult.meta.cost,
          latencyMs: comprehensiveResult.meta.latencyMs,
          traceId,
        });

        await incrementAiCallsCount(userId, 1);
      });

      await step.run("flush-langfuse", async () => {
        await flushAI();
      });

      return {
        tier: "team",
        analysis: comprehensiveResult.result,
        totalCost: comprehensiveResult.meta.cost,
        model: comprehensiveResult.meta.model,
      };
    }

    // =========================================================================
    // PRO TIER: Standard Analysis (Gemini 2.5 Flash)
    // =========================================================================

    // Run sentiment analysis
    const sentimentResult = await step.run("analyze-sentiment", async () => {
      return analyzeSentiment(contentToAnalyze);
    });

    // Run pain point detection
    const painPointResult = await step.run("analyze-pain-points", async () => {
      return analyzePainPoints(contentToAnalyze);
    });

    // Run summarization
    const summaryResult = await step.run("summarize-content", async () => {
      return summarizeContent(contentToAnalyze);
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
          // Store Pro tier analysis as JSON metadata
          aiAnalysis: JSON.stringify({
            tier: "pro",
            sentiment: sentimentResult.result,
            painPoint: painPointResult.result,
            summary: summaryResult.result,
            analyzedAt: new Date().toISOString(),
          }),
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

      const totalPromptTokens =
        sentimentResult.meta.promptTokens +
        painPointResult.meta.promptTokens +
        summaryResult.meta.promptTokens;

      const totalCompletionTokens =
        sentimentResult.meta.completionTokens +
        painPointResult.meta.completionTokens +
        summaryResult.meta.completionTokens;

      await db.insert(aiLogs).values({
        userId,
        model: sentimentResult.meta.model,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        costUsd: totalCost,
        latencyMs: totalLatency,
        traceId,
      });

      await incrementAiCallsCount(userId, 3);
    });

    // Flush Langfuse events
    await step.run("flush-langfuse", async () => {
      await flushAI();
    });

    return {
      tier: "pro",
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
