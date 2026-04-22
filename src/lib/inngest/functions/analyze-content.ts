import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { results, aiLogs, monitors, painPointCategoryEnum, conversationCategoryEnum, resultAnalyses } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { logAiCall } from "@/lib/ai/log";
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
import { MODELS } from "@/lib/ai/openrouter";
import { checkDailyCostBudget } from "@/lib/ai/rate-limit";
import { captureEvent } from "@/lib/posthog";
import { incrementAiCallsCount, getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { cache } from "@/lib/cache";
import { matchDetectionKeywords } from "@/lib/detection-matcher";
import { logger } from "@/lib/logger";
import { track } from "@/lib/analytics";
import crypto from "crypto";

/**
 * Mark a result as analysis-failed without fabricating sentiment values.
 * Prior behavior set sentiment="neutral" on AI failures, silently converting
 * negative sentiment to neutral in the warehouse. Now we set aiAnalyzed=false
 * with the error message; dashboards render a "pending" state and alerts
 * skip these rows until a retry succeeds.
 */
async function saveAnalysisFailure(
  resultId: string,
  error: unknown,
  userId?: string
): Promise<void> {
  const errorMessage = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  await pooledDb
    .update(results)
    .set({
      aiAnalyzed: false,
      aiError: errorMessage,
    })
    .where(eq(results.id, resultId));

  // Task 1.4: fire taxonomy event so Task 0.1's fallback-fire rate is visible
  // in PostHog. userId is optional for back-compat with any future caller,
  // but the two fallback paths in this file always supply it.
  if (userId) {
    track("ai_analysis.failed", {
      userId,
      resultId,
      errorType: error instanceof Error ? error.name || "Error" : "Unknown",
    });
  }
}

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

/**
 * Task DL.2 Phase 1 — dual-write the AI analysis payload to the new
 * `result_analyses` sibling table. `results.aiAnalysis` is still written
 * above for read-path backward compatibility until Phase 3 drops it.
 *
 * Why upsert: Inngest retries mean the same resultId may be analyzed more
 * than once. ON CONFLICT keeps the most recent analysis + bumps updatedAt.
 */
async function writeResultAnalysis(
  resultId: string,
  analysisJson: string,
  tier: "pro" | "team" | "batch"
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(analysisJson);
  } catch {
    // Upstream always stringifies a plain object; if that ever breaks, log
    // and skip the new-table write rather than corrupt it. Legacy column
    // still has the original value.
    logger.error("[AI Analysis] Could not parse analysisJson for result_analyses", { resultId });
    return;
  }

  await pooledDb
    .insert(resultAnalyses)
    .values({ resultId, analysis: parsed, tier })
    .onConflictDoUpdate({
      target: resultAnalyses.resultId,
      set: {
        analysis: parsed,
        tier,
        updatedAt: sql`NOW()`,
      },
    });
}

/** Run Pro-tier AI analysis (sentiment + summary) */
async function runProAnalysis(
  contentToAnalyze: string,
  result: {
    id: string;
    platform: string;
    metadata: unknown;
  },
  userId: string,
  keywordMatch: { category: string; confidence: number; matchedKeyword: string } | null
) {
  const metadata = result.metadata as Record<string, unknown> | null;

  // Run AI analyses in parallel — skip categorization if keyword matched
  const [sentimentResult, painPointResult, summaryResult, categoryResult] = await Promise.all([
    analyzeSentiment(contentToAnalyze),
    analyzePainPoints(contentToAnalyze),
    summarizeContent(contentToAnalyze),
    keywordMatch
      ? Promise.resolve(null) // Skip AI categorization — keyword match found
      : categorizeConversation(contentToAnalyze, {
          upvotes: (metadata?.upvotes as number) || (metadata?.score as number) || undefined,
          commentCount: (metadata?.commentCount as number) || (metadata?.numComments as number) || undefined,
        }),
  ]);

  // Resolve conversation category: keyword match takes precedence over AI
  const resolvedCategory = keywordMatch
    ? { category: keywordMatch.category, confidence: keywordMatch.confidence }
    : categoryResult
      ? { category: categoryResult.result.category, confidence: categoryResult.result.confidence }
      : { category: "advice_request" as const, confidence: 0.3 };

  const aiCallCount = categoryResult ? 4 : 3;
  const totalCost =
    sentimentResult.meta.cost +
    painPointResult.meta.cost +
    summaryResult.meta.cost +
    (categoryResult?.meta.cost || 0);

  const totalLatency =
    sentimentResult.meta.latencyMs +
    painPointResult.meta.latencyMs +
    summaryResult.meta.latencyMs +
    (categoryResult?.meta.latencyMs || 0);

  const totalPromptTokens =
    sentimentResult.meta.promptTokens +
    painPointResult.meta.promptTokens +
    summaryResult.meta.promptTokens +
    (categoryResult?.meta.promptTokens || 0);

  const totalCompletionTokens =
    sentimentResult.meta.completionTokens +
    painPointResult.meta.completionTokens +
    summaryResult.meta.completionTokens +
    (categoryResult?.meta.completionTokens || 0);

  return {
    sentiment: sentimentResult.result,
    painPoint: painPointResult.result,
    summary: summaryResult.result,
    conversationCategory: categoryResult?.result || {
      category: resolvedCategory.category,
      confidence: resolvedCategory.confidence,
      source: "keyword_match",
      matchedKeyword: keywordMatch?.matchedKeyword,
    },
    resolvedCategory,
    aiCallCount,
    totalCost,
    totalLatency,
    totalPromptTokens,
    totalCompletionTokens,
    model: sentimentResult.meta.model,
    keywordMatchUsed: !!keywordMatch,
  };
}

/**
 * Run Team-tier comprehensive analysis.
 *
 * COA 4 W1.7: Team tier uses Claude Sonnet 4.5 for stronger persona voice and
 * reasoning. If Sonnet fails (rate limit, provider outage, quota), we degrade
 * to Gemini Flash rather than erroring the whole analysis — user still gets a
 * result, and a PostHog event records the downgrade for observability.
 */
async function runTeamAnalysis(
  contentToAnalyze: string,
  result: {
    platform: string;
    metadata: unknown;
  },
  monitor: { keywords: string[]; name: string } | null,
  keywordMatch: { category: string; confidence: number; matchedKeyword: string } | null,
  userId: string
) {
  const metadata = result.metadata as Record<string, unknown> | null;

  const context: ComprehensiveAnalysisContext = {
    platform: result.platform,
    keywords: monitor?.keywords || [],
    monitorName: monitor?.name || "Unknown Monitor",
    businessName: undefined,
    subreddit: (metadata?.subreddit as string) || undefined,
  };

  // Attempt 1: Sonnet 4.5 (Team tier model).
  let comprehensiveResult: Awaited<ReturnType<typeof analyzeComprehensive>>;
  let degraded = false;
  try {
    comprehensiveResult = await analyzeComprehensive(contentToAnalyze, context, {
      model: MODELS.team,
    });
  } catch (sonnetError) {
    // Fallback: retry with Flash and flag the downgrade.
    const errMsg = sonnetError instanceof Error ? sonnetError.message : String(sonnetError);
    logger.warn("[analyze-content] Team-tier Sonnet failed, falling back to Flash", {
      userId,
      error: errMsg,
    });
    captureEvent({
      distinctId: userId,
      event: "ai_analysis.tier_downgrade",
      properties: {
        from_model: MODELS.team,
        to_model: MODELS.primary,
        reason: "sonnet_call_failed",
        error_message: errMsg.slice(0, 200),
      },
    });
    comprehensiveResult = await analyzeComprehensive(contentToAnalyze, context, {
      model: MODELS.primary,
    });
    degraded = true;
  }

  // Conversation categorization always uses the default (Flash) — cheap operation.
  const categoryResult = keywordMatch
    ? null
    : await categorizeConversation(contentToAnalyze, {
        upvotes: (metadata?.upvotes as number) || (metadata?.score as number) || undefined,
        commentCount: (metadata?.commentCount as number) || (metadata?.numComments as number) || undefined,
      });

  const analysis = comprehensiveResult.result;
  const category = keywordMatch
    ? { category: keywordMatch.category, confidence: keywordMatch.confidence, signals: [keywordMatch.matchedKeyword], reasoning: "keyword_match" }
    : categoryResult!.result;

  const aiCallCount = categoryResult ? 2 : 1;
  const totalCost = comprehensiveResult.meta.cost + (categoryResult?.meta.cost || 0);
  const totalPromptTokens = comprehensiveResult.meta.promptTokens + (categoryResult?.meta.promptTokens || 0);
  const totalCompletionTokens = comprehensiveResult.meta.completionTokens + (categoryResult?.meta.completionTokens || 0);
  const totalLatency = comprehensiveResult.meta.latencyMs + (categoryResult?.meta.latencyMs || 0);

  return {
    analysis,
    category,
    aiCallCount,
    totalCost,
    totalPromptTokens,
    totalCompletionTokens,
    totalLatency,
    model: comprehensiveResult.meta.model,
    keywordMatchUsed: !!keywordMatch,
    degraded, // true when Team tier fell back from Sonnet to Flash
  };
}

// Analyze content with AI
export const analyzeContent = inngest.createFunction(
  {
    id: "analyze-content",
    name: "Analyze Content",
    retries: 2,
    timeouts: { finish: "5m" },
    concurrency: {
      limit: 5, // Limit concurrent AI calls
    },
  },
  { event: "content/analyze" },
  async ({ event, step }) => {
    const { resultId, userId } = event.data;

    // Get the result
    const result = await step.run("get-result", async () => {
      return pooledDb.query.results.findFirst({
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

    // COA 4 W1.8: daily AI cost cap per user. Halts analyses when today's
    // cumulative $/day AI spend from aiLogs.cost_usd exceeds the tier cap.
    // Defaults Pro $1/day, Team $5/day; overridable via KAULBY_*_DAILY_AI_BUDGET_USD.
    // Free users skip the check (they're already blocked by unlimitedAi gate below).
    if (planCheck.plan !== "free") {
      const costBudget = await step.run("check-daily-cost-budget", async () => {
        return checkDailyCostBudget(userId, planCheck.plan as "pro" | "team");
      });

      if (!costBudget.allowed) {
        logger.warn("[analyze-content] Daily AI cost cap reached — halting analysis", {
          userId,
          plan: planCheck.plan,
          spentUsd: costBudget.spentUsd,
          capUsd: costBudget.capUsd,
        });
        captureEvent({
          distinctId: userId,
          event: "ai_analysis.cost_cap_reached",
          properties: {
            plan: planCheck.plan,
            spent_usd: costBudget.spentUsd,
            cap_usd: costBudget.capUsd,
          },
        });
        // TODO(W1.8 follow-up): queue a user notification email via send-alerts.ts
        // so the user knows their scans are paused. Tracked in kaulby-backlog.md.
        return {
          skipped: true,
          reason: "Daily AI cost cap reached",
          plan: planCheck.plan,
          spentUsd: costBudget.spentUsd,
          capUsd: costBudget.capUsd,
        };
      }
    }

    // For free users, only analyze first result
    if (!planCheck.hasUnlimitedAi) {
      const userResultCount = await step.run("count-user-results", async () => {
        const [countResult] = await pooledDb
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

    // SECURITY (SEC-LLM-001): Truncate scraped content to prevent prompt injection via oversized input
    // AI output is Zod-validated, so impact of injection is limited to analysis accuracy
    const MAX_CONTENT_LENGTH = 12000; // ~3k tokens — sufficient for analysis, prevents abuse
    const rawContent = `${result.title}\n\n${result.content || ""}`;
    const contentToAnalyze = rawContent.length > MAX_CONTENT_LENGTH
      ? rawContent.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated for analysis]"
      : rawContent;
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
      logger.debug("[AI Analysis] CACHE HIT", { tier: analysisTier, cacheKey: cacheKey.slice(-8) });

      // Apply cached analysis to this result
      await step.run("apply-cached-analysis", async () => {
        // Map "mixed" sentiment to "neutral" for database (schema only supports positive/negative/neutral)
        const dbSentiment = cachedAnalysis.sentiment === "mixed"
          ? "neutral"
          : cachedAnalysis.sentiment as "positive" | "negative" | "neutral";

        await pooledDb
          .update(results)
          .set({
            sentiment: dbSentiment,
            sentimentScore: cachedAnalysis.sentimentScore,
            painPointCategory: cachedAnalysis.painPointCategory as typeof painPointCategoryEnum.enumValues[number] | null,
            conversationCategory: cachedAnalysis.conversationCategory as typeof conversationCategoryEnum.enumValues[number],
            conversationCategoryConfidence: cachedAnalysis.conversationCategoryConfidence,
            aiSummary: cachedAnalysis.aiSummary,
            aiAnalysis: cachedAnalysis.aiAnalysis,
            aiAnalyzed: true,
            aiError: null,
          })
          .where(eq(results.id, resultId));

        // Task DL.2 Phase 1 — dual-write to extracted table.
        await writeResultAnalysis(
          resultId,
          cachedAnalysis.aiAnalysis,
          (cachedAnalysis.tier === "team" ? "team" : "pro")
        );
      });

      // Log cache hit as $0-cost row for tracking efficiency
      await step.run("log-cache-hit", async () => {
        await pooledDb.insert(aiLogs).values({
          userId,
          model: "cache",
          promptTokens: 0,
          completionTokens: 0,
          costUsd: 0,
          latencyMs: 0,
          monitorId: result.monitorId,
          resultId,
          analysisType: analysisTier === "team" ? "comprehensive" : "mixed",
          cacheHit: true,
          platform: result.platform,
        });
      });

      // Task 1.4: taxonomy event — cache hit is still a successful analysis
      // from the user's perspective, so fire with costUsd=0 to keep funnels
      // honest about total analyses served.
      track("ai_analysis.completed", {
        userId,
        resultId,
        sentiment: (cachedAnalysis.sentiment === "positive" ||
          cachedAnalysis.sentiment === "negative" ||
          cachedAnalysis.sentiment === "neutral")
          ? cachedAnalysis.sentiment
          : null,
        tier: analysisTier,
        costUsd: 0,
      });

      return {
        tier: analysisTier,
        cached: true,
        cacheKey,
        totalCost: 0,
        message: "Used cached analysis - no AI cost",
      };
    }

    logger.debug("[AI Analysis] CACHE MISS - running AI", { tier: analysisTier, cacheKey: cacheKey.slice(-8) });

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
      try {
        // Get monitor info for context
        const monitor = await step.run("get-monitor", async () => {
          return pooledDb.query.monitors.findFirst({
            where: eq(monitors.id, result.monitorId),
            with: { user: true },
          });
        });

        // Check custom detection keywords BEFORE AI call (cost optimization)
        const teamKeywordMatch = await step.run("check-detection-keywords-team", async () => {
          return matchDetectionKeywords(contentToAnalyze, userId);
        });

        // Run comprehensive analysis
        const teamAnalysisResult = await step.run("run-team-analysis", async () => {
          return runTeamAnalysis(contentToAnalyze, result, monitor, teamKeywordMatch, userId);
        });

        const analysis = teamAnalysisResult.analysis;
        const category = teamAnalysisResult.category;

        // Build analysis JSON once — reused by legacy write, cache, and the
        // new Phase 1 extracted table.
        const teamAnalysisJson = JSON.stringify({
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
        });

        // Update result with comprehensive AI analysis
        await step.run("update-result-team", async () => {
          await pooledDb
            .update(results)
            .set({
              sentiment: analysis.sentiment.label,
              sentimentScore: analysis.sentiment.score,
              painPointCategory: analysis.classification.category as typeof painPointCategoryEnum.enumValues[number],
              conversationCategory: category.category as typeof conversationCategoryEnum.enumValues[number],
              conversationCategoryConfidence: category.confidence,
              aiSummary: analysis.executiveSummary,
              // Store full analysis as JSON metadata (legacy; Phase 3 drops this column)
              aiAnalysis: teamAnalysisJson,
              aiAnalyzed: true,
              aiError: null,
            })
            .where(eq(results.id, resultId));

          // Task DL.2 Phase 1 — dual-write to extracted table.
          await writeResultAnalysis(resultId, teamAnalysisJson, "team");
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
            aiAnalysis: teamAnalysisJson,
          };
          await cache.set(cacheKey, cacheData, AI_ANALYSIS_CACHE_TTL);
          logger.debug("[AI Analysis] Cached TEAM tier analysis", { cacheKey: cacheKey.slice(-8) });
        });

        // Log AI usage for Team tier (comprehensive + optional categorization)
        await step.run("log-ai-usage-team", async () => {
          await logAiCall({
            userId,
            model: teamAnalysisResult.model,
            promptTokens: teamAnalysisResult.totalPromptTokens,
            completionTokens: teamAnalysisResult.totalCompletionTokens,
            costUsd: teamAnalysisResult.totalCost,
            latencyMs: teamAnalysisResult.totalLatency,
            traceId,
            monitorId: result.monitorId,
            resultId,
            analysisType: "comprehensive",
            cacheHit: false,
            platform: result.platform,
          });

          await incrementAiCallsCount(userId, teamAnalysisResult.aiCallCount);
        });

        await step.run("flush-langfuse", async () => {
          await flushAI();
        });

        // Trigger webhooks for team users
        await step.run("trigger-webhooks-team", async () => {
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

        // Task 1.4: taxonomy event — team-tier success path. Sentiment is the
        // validated Zod output from analyzeComprehensive.
        track("ai_analysis.completed", {
          userId,
          resultId,
          sentiment: analysis.sentiment.label,
          tier: "team",
          costUsd: teamAnalysisResult.totalCost,
        });

        return {
          tier: "team",
          analysis: teamAnalysisResult.analysis,
          conversationCategory: category,
          keywordMatchUsed: teamAnalysisResult.keywordMatchUsed,
          totalCost: teamAnalysisResult.totalCost,
          model: teamAnalysisResult.model,
        };
      } catch (teamError) {
        logger.error("[AI Analysis] Team tier analysis failed — applying fallback", {
          resultId,
          userId,
          error: teamError instanceof Error ? teamError.message : String(teamError),
        });

        // Mark result as analysis-failed; do NOT fabricate sentiment values.
        // Inngest retries + future scans will re-attempt analysis.
        await step.run("mark-team-analysis-failed", async () => {
          await saveAnalysisFailure(resultId, teamError, userId);
        });

        return {
          tier: analysisTier,
          cached: false,
          analyzed: false,
          message: "AI analysis failed — marked for retry",
        };
      }
    }

    // =========================================================================
    // PRO TIER: Standard Analysis (Gemini 2.5 Flash) - same model as Team tier
    // All tiers now use Flash for maximum cost efficiency
    // =========================================================================

    try {
      // Check custom detection keywords BEFORE AI call (cost optimization)
      const keywordMatch = await step.run("check-detection-keywords", async () => {
        return matchDetectionKeywords(contentToAnalyze, userId);
      });

      // Run Pro analysis
      const proAnalysisResult = await step.run("run-pro-analysis", async () => {
        return runProAnalysis(contentToAnalyze, result, userId, keywordMatch);
      });

      const resolvedCategory = proAnalysisResult.resolvedCategory;

      // Build analysis JSON once — reused by legacy column, cache, and the
      // new Phase 1 extracted table.
      const proAnalysisJson = JSON.stringify({
        tier: "pro",
        sentiment: proAnalysisResult.sentiment,
        painPoint: proAnalysisResult.painPoint,
        summary: proAnalysisResult.summary,
        conversationCategory: proAnalysisResult.conversationCategory,
        analyzedAt: new Date().toISOString(),
      });

      // Update result with AI analysis
      await step.run("update-result", async () => {
        await pooledDb
          .update(results)
          .set({
            sentiment: proAnalysisResult.sentiment.sentiment,
            sentimentScore: proAnalysisResult.sentiment.score,
            painPointCategory: proAnalysisResult.painPoint.category as typeof painPointCategoryEnum.enumValues[number],
            conversationCategory: resolvedCategory.category as typeof conversationCategoryEnum.enumValues[number],
            conversationCategoryConfidence: resolvedCategory.confidence,
            aiSummary: proAnalysisResult.summary.summary,
            // Store Pro tier analysis as JSON metadata (legacy; Phase 3 drops this column)
            aiAnalysis: proAnalysisJson,
            aiAnalyzed: true,
            aiError: null,
          })
          .where(eq(results.id, resultId));

        // Task DL.2 Phase 1 — dual-write to extracted table.
        await writeResultAnalysis(resultId, proAnalysisJson, "pro");
      });

      // Cache the analysis for reuse by other users with same content
      await step.run("cache-pro-analysis", async () => {
        const cacheData = {
          tier: "pro",
          sentiment: proAnalysisResult.sentiment.sentiment,
          sentimentScore: proAnalysisResult.sentiment.score,
          painPointCategory: proAnalysisResult.painPoint.category,
          conversationCategory: resolvedCategory.category,
          conversationCategoryConfidence: resolvedCategory.confidence,
          aiSummary: proAnalysisResult.summary.summary,
          aiAnalysis: proAnalysisJson,
        };
        await cache.set(cacheKey, cacheData, AI_ANALYSIS_CACHE_TTL);
        logger.debug("[AI Analysis] Cached PRO tier analysis", { cacheKey: cacheKey.slice(-8) });
      });

      // Log AI usage (3 or 4 calls depending on keyword match)
      await step.run("log-ai-usage", async () => {
        await logAiCall({
          userId,
          model: proAnalysisResult.model,
          promptTokens: proAnalysisResult.totalPromptTokens,
          completionTokens: proAnalysisResult.totalCompletionTokens,
          costUsd: proAnalysisResult.totalCost,
          latencyMs: proAnalysisResult.totalLatency,
          traceId,
          monitorId: result.monitorId,
          resultId,
          analysisType: "mixed",
          cacheHit: false,
          platform: result.platform,
        });

        await incrementAiCallsCount(userId, proAnalysisResult.aiCallCount);
      });

      // Flush Langfuse events
      await step.run("flush-langfuse", async () => {
        await flushAI();
      });

      // Trigger webhooks for team users (Pro users can also have webhooks if upgraded)
      await step.run("trigger-webhooks-pro", async () => {
        // Get monitor info for webhook
        const monitor = await pooledDb.query.monitors.findFirst({
          where: eq(monitors.id, result.monitorId),
          columns: { name: true },
        });

        const metadata = result.metadata as Record<string, unknown> | null;

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
                sentiment: proAnalysisResult.sentiment.sentiment,
                conversationCategory: resolvedCategory.category,
                aiSummary: proAnalysisResult.summary.summary,
                engagement: (metadata?.upvotes as number) || (metadata?.score as number) || undefined,
                commentCount: (metadata?.commentCount as number) || (metadata?.numComments as number) || undefined,
              },
            },
          },
        });
      });

      // Task 1.4: taxonomy event — pro-tier success path.
      track("ai_analysis.completed", {
        userId,
        resultId,
        sentiment: proAnalysisResult.sentiment.sentiment,
        tier: "pro",
        costUsd: proAnalysisResult.totalCost,
      });

      return {
        tier: "pro",
        sentiment: proAnalysisResult.sentiment,
        painPoint: proAnalysisResult.painPoint,
        summary: proAnalysisResult.summary,
        conversationCategory: resolvedCategory,
        keywordMatchUsed: proAnalysisResult.keywordMatchUsed,
        totalCost: proAnalysisResult.totalCost,
      };
    } catch (proError) {
      logger.error("[AI Analysis] Pro tier analysis failed — applying fallback", {
        resultId,
        userId,
        error: proError instanceof Error ? proError.message : String(proError),
      });

      // Mark result as analysis-failed; do NOT fabricate sentiment values.
      // Inngest retries + future scans will re-attempt analysis.
      await step.run("mark-pro-analysis-failed", async () => {
        await saveAnalysisFailure(resultId, proError, userId);
      });

      return {
        tier: analysisTier,
        cached: false,
        analyzed: false,
        message: "AI analysis failed — marked for retry",
      };
    }
  }
);
