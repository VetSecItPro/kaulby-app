import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, desc, isNotNull } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { getUserPlan } from "@/lib/limits";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { cachedQuery, CACHE_TTL } from "@/lib/cache";
import { jsonCompletion, MODELS } from "@/lib/ai/openrouter";
import { logAiCall } from "@/lib/ai/log";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface Recommendation {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  impact: string;
  effort: "quick_win" | "moderate" | "significant";
  actions: string[];
  relatedPainPoints: string[];
}

export async function GET(request: Request) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const userPlan = await getUserPlan(userId);

    // Free users get a teaser - no AI recommendations
    if (userPlan === "free") {
      return NextResponse.json({
        recommendations: [],
        plan: userPlan,
        requiresUpgrade: true,
      });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    const now = new Date();
    let startDate: Date;
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true, name: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json({ recommendations: [], plan: userPlan, totalAnalyzed: 0 });
    }

    const monitorIds = userMonitors.map((m) => m.id);
    const monitorNameMap = new Map(userMonitors.map((m) => [m.id, m.name]));

    // Fetch results with pain points and negative sentiment for analysis
    const { data: rawResults } = await cachedQuery(
      "insights:recommendations",
      { userId, range, monitorIds },
      async () => {
        return await db.query.results.findMany({
          where: and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, startDate),
            isNotNull(results.painPointCategory)
          ),
          columns: {
            id: true,
            title: true,
            content: true,
            platform: true,
            sentiment: true,
            painPointCategory: true,
            conversationCategory: true,
            monitorId: true,
          },
          orderBy: desc(results.createdAt),
          limit: 200,
        });
      },
      CACHE_TTL.RESULTS
    );

    if (rawResults.length < 3) {
      return NextResponse.json({
        recommendations: [],
        plan: userPlan,
        totalAnalyzed: rawResults.length,
        message: "Not enough data to generate recommendations. Keep monitoring to collect more mentions.",
      });
    }

    // Build a summary of pain points for AI analysis
    const painPointSummary = buildPainPointSummary(rawResults, monitorNameMap);

    // Generate recommendations with AI (cached for 5 minutes)
    const { data: cachedRecs } = await cachedQuery(
      "insights:ai-recommendations",
      { userId, range, summaryHash: hashSummary(painPointSummary) },
      async () => {
        return await generateRecommendations(painPointSummary, userId);
      },
      5 * 60 * 1000 // 5 minute cache
    );

    const response = NextResponse.json({
      recommendations: cachedRecs,
      plan: userPlan,
      totalAnalyzed: rawResults.length,
    });
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    logger.error("Recommendations API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}

function buildPainPointSummary(
  rawResults: {
    title: string;
    content: string | null;
    platform: string;
    sentiment: string | null;
    painPointCategory: string | null;
    conversationCategory: string | null;
    monitorId: string;
  }[],
  monitorNameMap: Map<string, string>
): string {
  // Group by category and count
  const categories = new Map<string, { count: number; examples: string[]; platforms: Set<string>; monitors: Set<string> }>();

  for (const r of rawResults) {
    const cat = r.painPointCategory || "general_discussion";
    if (!categories.has(cat)) {
      categories.set(cat, { count: 0, examples: [], platforms: new Set(), monitors: new Set() });
    }
    const group = categories.get(cat)!;
    group.count++;
    group.platforms.add(r.platform);
    group.monitors.add(monitorNameMap.get(r.monitorId) || "Unknown");
    if (group.examples.length < 5) {
      group.examples.push(
        `[${r.platform}] ${r.title}${r.content ? `: ${r.content.slice(0, 150)}` : ""}`
      );
    }
  }

  let summary = "PAIN POINT ANALYSIS SUMMARY:\n\n";
  for (const [category, data] of categories) {
    summary += `## ${category.toUpperCase()} (${data.count} mentions across ${data.platforms.size} platforms)\n`;
    summary += `Monitors: ${Array.from(data.monitors).join(", ")}\n`;
    summary += `Examples:\n`;
    for (const example of data.examples) {
      summary += `- ${example}\n`;
    }
    summary += "\n";
  }

  return summary;
}

function hashSummary(summary: string): string {
  // Simple hash for cache key - just use length + first/last chars
  return `${summary.length}-${summary.slice(0, 50)}-${summary.slice(-50)}`;
}

async function generateRecommendations(
  painPointSummary: string,
  userId: string
): Promise<Recommendation[]> {
  const prompt = `You are a senior business strategist and customer success consultant. Analyze the following pain point data from community monitoring and generate prioritized, actionable recommendations.

${painPointSummary}

Generate 3-7 specific, actionable recommendations based on the data above. Each recommendation should directly address a pattern you see in the pain points.

Return JSON:
{
  "recommendations": [
    {
      "title": "Short actionable title (e.g., 'Improve Response Time to Support Tickets')",
      "description": "2-3 sentence explanation of why this matters and what the data shows",
      "priority": "critical" | "high" | "medium" | "low",
      "category": "customer_service" | "product" | "pricing" | "reputation" | "competitive" | "documentation",
      "impact": "One sentence about expected impact (e.g., 'Could reduce churn by addressing top complaint')",
      "effort": "quick_win" | "moderate" | "significant",
      "actions": ["Specific step 1", "Specific step 2", "Specific step 3"],
      "relatedPainPoints": ["category_name_1", "category_name_2"]
    }
  ]
}

Rules:
- Prioritize by severity: negative_experience > support_need > pricing_concern > competitor_mention > feature_request
- Focus on ACTIONABLE recommendations, not vague advice
- Include specific steps the company can take TODAY
- Consider reputation management, customer service, and product improvement angles
- If competitor mentions are significant, include competitive positioning recommendations
- Be specific about what department or team should own each recommendation`;

  try {
    const response = await jsonCompletion<{ recommendations: Recommendation[] }>({
      messages: [{ role: "user", content: prompt }],
      model: MODELS.primary,
    });

    await logAiCall({
      userId,
      model: response.meta.model,
      promptTokens: response.meta.promptTokens,
      completionTokens: response.meta.completionTokens,
      costUsd: response.meta.cost,
      latencyMs: response.meta.latencyMs,
      analysisType: "insights",
    });

    return response.data.recommendations || [];
  } catch (error) {
    logger.error("AI recommendations generation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
