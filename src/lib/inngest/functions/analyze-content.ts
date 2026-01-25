import { inngest } from "../client";
import { db } from "@/lib/db";
import { results, aiLogs, monitors, painPointCategoryEnum, conversationCategoryEnum } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import {
  analyzeSentiment,
  analyzePainPoints,
  summarizeContent,
  analyzeComprehensive,
  categorizeConversation,
  createTrace,
  flushAI,
  type ComprehensiveAnalysisContext,
} from "@/lib/ai";
import { incrementAiCallsCount, getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { cache } from "@/lib/cache";
import crypto from "crypto";

/**
 * Generate a hash of content for cache key
 * This enables cross-user caching - if two users have the same content,
 * we can reuse the AI analysis instead of running it again
 */
function generateContentHash(content: string, tier: "pro" | "team"): string {
  // Normalize content: trim, lowercase for matching
  const normalized = content.trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `ai-analysis:${tier}:${hash}`;
}

// Cache TTL for AI analysis - 24 hours (content analysis doesn't change)
const AI_ANALYSIS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
    const analysisTier = planCheck.useComprehensiveAnalysis ? "team" : "pro";
    const cacheKey = generateContentHash(contentToAnalyze, analysisTier);

    // =========================================================================
    // CHECK CACHE: Reuse analysis if this content was already analyzed
    // This saves 90%+ on AI costs when multiple users monitor similar content
    // =========================================================================
    const cachedAnalysis = await step.run("check-analysis-cache", async () => {
      return cache.get<{
        tier: string;
        sentiment: string;
        sentimentScore: number;
        painPointCategory?: string;
        conversationCategory: string;
        conversationCategoryConfidence: number;
        aiSummary: string;
        aiAnalysis: string;
      }>(cacheKey);
    });

    if (cachedAnalysis) {
      console.log(`[AI Analysis] CACHE HIT for ${analysisTier} tier (key: ${cacheKey.slice(-8)})`);

      // Apply cached analysis to this result
      await step.run("apply-cached-analysis", async () => {
        // Map "mixed" sentiment to "neutral" for database (schema only supports positive/negative/neutral)
        const dbSentiment = cachedAnalysis.sentiment === "mixed"
          ? "neutral"
          : cachedAnalysis.sentiment as "positive" | "negative" | "neutral";

        await db
          .update(results)
          .set({
            sentiment: dbSentiment,
            sentimentScore: cachedAnalysis.sentimentScore,
            painPointCategory: cachedAnalysis.painPointCategory as typeof painPointCategoryEnum.enumValues[number] | null,
            conversationCategory: cachedAnalysis.conversationCategory as typeof conversationCategoryEnum.enumValues[number],
            conversationCategoryConfidence: cachedAnalysis.conversationCategoryConfidence,
            aiSummary: cachedAnalysis.aiSummary,
            aiAnalysis: cachedAnalysis.aiAnalysis,
          })
          .where(eq(results.id, resultId));
      });

      // No AI cost for cached analysis!
      return {
        tier: analysisTier,
        cached: true,
        cacheKey,
        totalCost: 0,
        message: "Used cached analysis - no AI cost",
      };
    }

    console.log(`[AI Analysis] CACHE MISS for ${analysisTier} tier (key: ${cacheKey.slice(-8)}) - running AI`);

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
    // TEAM TIER: Comprehensive Analysis (Gemini 2.5 Pro - 70% cheaper than Claude)
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

      // Run comprehensive analysis and conversation categorization in parallel
      const [comprehensiveResult, categoryResult] = await Promise.all([
        step.run("analyze-comprehensive", async () => {
          return analyzeComprehensive(contentToAnalyze, context);
        }),
        step.run("categorize-conversation-team", async () => {
          const metadata = result.metadata as Record<string, unknown> | null;
          return categorizeConversation(contentToAnalyze, {
            upvotes: (metadata?.upvotes as number) || (metadata?.score as number) || undefined,
            commentCount: (metadata?.commentCount as number) || (metadata?.numComments as number) || undefined,
          });
        }),
      ]);

      const analysis = comprehensiveResult.result;
      const category = categoryResult.result;

      // Update result with comprehensive AI analysis
      await step.run("update-result-team", async () => {
        await db
          .update(results)
          .set({
            sentiment: analysis.sentiment.label,
            sentimentScore: analysis.sentiment.score,
            painPointCategory: analysis.classification.category,
            conversationCategory: category.category,
            conversationCategoryConfidence: category.confidence,
            aiSummary: analysis.executiveSummary,
            // Store full analysis as JSON metadata
            aiAnalysis: JSON.stringify({
              tier: "team",
              sentiment: analysis.sentiment,
              classification: analysis.classification,
              conversationCategory: category,
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

      // Cache the analysis for reuse by other users with same content
      await step.run("cache-team-analysis", async () => {
        const cacheData = {
          tier: "team",
          sentiment: analysis.sentiment.label,
          sentimentScore: analysis.sentiment.score,
          painPointCategory: analysis.classification.category,
          conversationCategory: category.category,
          conversationCategoryConfidence: category.confidence,
          aiSummary: analysis.executiveSummary,
          aiAnalysis: JSON.stringify({
            tier: "team",
            sentiment: analysis.sentiment,
            classification: analysis.classification,
            conversationCategory: category,
            opportunity: analysis.opportunity,
            competitive: analysis.competitive,
            actions: analysis.actions,
            suggestedResponse: analysis.suggestedResponse,
            contentOpportunity: analysis.contentOpportunity,
            platformContext: analysis.platformContext,
            executiveSummary: analysis.executiveSummary,
            analyzedAt: new Date().toISOString(),
          }),
        };
        await cache.set(cacheKey, cacheData, AI_ANALYSIS_CACHE_TTL);
        console.log(`[AI Analysis] Cached TEAM tier analysis (key: ${cacheKey.slice(-8)})`);
      });

      // Log AI usage for Team tier (comprehensive + categorization)
      await step.run("log-ai-usage-team", async () => {
        const totalCost = comprehensiveResult.meta.cost + categoryResult.meta.cost;
        const totalPromptTokens = comprehensiveResult.meta.promptTokens + categoryResult.meta.promptTokens;
        const totalCompletionTokens = comprehensiveResult.meta.completionTokens + categoryResult.meta.completionTokens;
        const totalLatency = comprehensiveResult.meta.latencyMs + categoryResult.meta.latencyMs;

        await db.insert(aiLogs).values({
          userId,
          model: comprehensiveResult.meta.model,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          costUsd: totalCost,
          latencyMs: totalLatency,
          traceId,
        });

        await incrementAiCallsCount(userId, 2); // 2 AI calls: comprehensive + categorization
      });

      await step.run("flush-langfuse", async () => {
        await flushAI();
      });

      // Trigger webhooks for enterprise users
      await step.run("trigger-webhooks-team", async () => {
        const analysis = comprehensiveResult.result;
        const webhookMetadata = result.metadata as Record<string, unknown> | null;
        await inngest.send({
          name: "webhook/send",
          data: {
            userId,
            eventType: "new_result",
            data: {
              monitorName: monitor?.name || "Monitor",
              result: {
                id: resultId,
                title: result.title,
                content: result.content,
                sourceUrl: result.sourceUrl,
                platform: result.platform,
                author: result.author,
                postedAt: result.postedAt,
                sentiment: analysis.sentiment.label,
                conversationCategory: category.category,
                aiSummary: analysis.executiveSummary,
                engagement: (webhookMetadata?.upvotes as number) || (webhookMetadata?.score as number) || undefined,
                commentCount: (webhookMetadata?.commentCount as number) || (webhookMetadata?.numComments as number) || undefined,
              },
            },
          },
        });
      });

      return {
        tier: "team",
        analysis: comprehensiveResult.result,
        conversationCategory: categoryResult.result,
        totalCost: comprehensiveResult.meta.cost + categoryResult.meta.cost,
        model: comprehensiveResult.meta.model,
      };
    }

    // =========================================================================
    // PRO TIER: Standard Analysis (Gemini 2.5 Flash) - same model as Team tier
    // All tiers now use Flash for maximum cost efficiency
    // =========================================================================

    // Type assertion for metadata
    const metadata = result.metadata as Record<string, unknown> | null;

    // Run all analyses in parallel
    const [sentimentResult, painPointResult, summaryResult, categoryResult] = await Promise.all([
      step.run("analyze-sentiment", async () => {
        return analyzeSentiment(contentToAnalyze);
      }),
      step.run("analyze-pain-points", async () => {
        return analyzePainPoints(contentToAnalyze);
      }),
      step.run("summarize-content", async () => {
        return summarizeContent(contentToAnalyze);
      }),
      step.run("categorize-conversation", async () => {
        return categorizeConversation(contentToAnalyze, {
          upvotes: (metadata?.upvotes as number) || (metadata?.score as number) || undefined,
          commentCount: (metadata?.commentCount as number) || (metadata?.numComments as number) || undefined,
        });
      }),
    ]);

    // Update result with AI analysis
    await step.run("update-result", async () => {
      await db
        .update(results)
        .set({
          sentiment: sentimentResult.result.sentiment,
          sentimentScore: sentimentResult.result.score,
          painPointCategory: painPointResult.result.category,
          conversationCategory: categoryResult.result.category,
          conversationCategoryConfidence: categoryResult.result.confidence,
          aiSummary: summaryResult.result.summary,
          // Store Pro tier analysis as JSON metadata
          aiAnalysis: JSON.stringify({
            tier: "pro",
            sentiment: sentimentResult.result,
            painPoint: painPointResult.result,
            summary: summaryResult.result,
            conversationCategory: categoryResult.result,
            analyzedAt: new Date().toISOString(),
          }),
        })
        .where(eq(results.id, resultId));
    });

    // Cache the analysis for reuse by other users with same content
    await step.run("cache-pro-analysis", async () => {
      const cacheData = {
        tier: "pro",
        sentiment: sentimentResult.result.sentiment,
        sentimentScore: sentimentResult.result.score,
        painPointCategory: painPointResult.result.category,
        conversationCategory: categoryResult.result.category,
        conversationCategoryConfidence: categoryResult.result.confidence,
        aiSummary: summaryResult.result.summary,
        aiAnalysis: JSON.stringify({
          tier: "pro",
          sentiment: sentimentResult.result,
          painPoint: painPointResult.result,
          summary: summaryResult.result,
          conversationCategory: categoryResult.result,
          analyzedAt: new Date().toISOString(),
        }),
      };
      await cache.set(cacheKey, cacheData, AI_ANALYSIS_CACHE_TTL);
      console.log(`[AI Analysis] Cached PRO tier analysis (key: ${cacheKey.slice(-8)})`);
    });

    // Log AI usage
    await step.run("log-ai-usage", async () => {
      const totalCost =
        sentimentResult.meta.cost +
        painPointResult.meta.cost +
        summaryResult.meta.cost +
        categoryResult.meta.cost;

      const totalLatency =
        sentimentResult.meta.latencyMs +
        painPointResult.meta.latencyMs +
        summaryResult.meta.latencyMs +
        categoryResult.meta.latencyMs;

      const totalPromptTokens =
        sentimentResult.meta.promptTokens +
        painPointResult.meta.promptTokens +
        summaryResult.meta.promptTokens +
        categoryResult.meta.promptTokens;

      const totalCompletionTokens =
        sentimentResult.meta.completionTokens +
        painPointResult.meta.completionTokens +
        summaryResult.meta.completionTokens +
        categoryResult.meta.completionTokens;

      await db.insert(aiLogs).values({
        userId,
        model: sentimentResult.meta.model,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        costUsd: totalCost,
        latencyMs: totalLatency,
        traceId,
      });

      await incrementAiCallsCount(userId, 4); // 4 AI calls: sentiment + pain point + summary + category
    });

    // Flush Langfuse events
    await step.run("flush-langfuse", async () => {
      await flushAI();
    });

    // Trigger webhooks for enterprise users (Pro users can also have webhooks if upgraded)
    await step.run("trigger-webhooks-pro", async () => {
      // Get monitor info for webhook
      const monitor = await db.query.monitors.findFirst({
        where: eq(monitors.id, result.monitorId),
        columns: { name: true },
      });

      await inngest.send({
        name: "webhook/send",
        data: {
          userId,
          eventType: "new_result",
          data: {
            monitorName: monitor?.name || "Monitor",
            result: {
              id: resultId,
              title: result.title,
              content: result.content,
              sourceUrl: result.sourceUrl,
              platform: result.platform,
              author: result.author,
              postedAt: result.postedAt,
              sentiment: sentimentResult.result.sentiment,
              conversationCategory: categoryResult.result.category,
              aiSummary: summaryResult.result.summary,
              engagement: (metadata?.upvotes as number) || (metadata?.score as number) || undefined,
              commentCount: (metadata?.commentCount as number) || (metadata?.numComments as number) || undefined,
            },
          },
        },
      });
    });

    return {
      tier: "pro",
      sentiment: sentimentResult.result,
      painPoint: painPointResult.result,
      summary: summaryResult.result,
      conversationCategory: categoryResult.result,
      totalCost:
        sentimentResult.meta.cost +
        painPointResult.meta.cost +
        summaryResult.meta.cost +
        categoryResult.meta.cost,
    };
  }
);
