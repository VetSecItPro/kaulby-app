import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { getUserPlan } from "@/lib/limits";
import { jsonCompletion, MODELS, flushAI } from "@/lib/ai/openrouter";
import { logAiCall } from "@/lib/ai/log";
import { checkAllRateLimits, checkTokenBudget, sanitizeInput } from "@/lib/ai/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface TrendExplainResponse {
  explanation: string;       // 2-4 sentence narrative
  changePoint: string | null; // Date the AI identified as inflection
  drivers: Array<{           // Top contributing reasons
    label: string;
    examples: string[];      // Result IDs
  }>;
}

/**
 * POST /api/ai/explain-trend
 *
 * Body: { dateRange?: "7d" | "30d" | "90d" }
 *
 * Looks at the user's daily sentiment counts over the requested window,
 * picks out the biggest day-over-day delta, samples 3-5 representative
 * results from the recent slice, and asks the model to explain the
 * change in plain English.
 *
 * Powers the "Explain this dip" button on /dashboard/analytics. Wires
 * the analyze_sentiment_trends tool capability into a real UI surface
 * (was previously only callable from Ask Kaulby).
 */
export async function POST(req: Request) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = await getUserPlan(userId);
    if (plan !== "solo" && plan !== "scale" && plan !== "growth") {
      return NextResponse.json(
        { error: "Trend explainer requires a Solo, Scale, or Growth plan" },
        { status: 403 }
      );
    }

    const rateLimitCheck = await checkAllRateLimits(userId, plan);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: rateLimitCheck.reason },
        {
          status: 429,
          headers: rateLimitCheck.retryAfter
            ? { "Retry-After": String(rateLimitCheck.retryAfter) }
            : undefined,
        }
      );
    }

    const budgetCheck = await checkTokenBudget(userId, plan);
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: "Daily token budget exceeded. Resets at midnight." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { dateRange?: string };
    const dateRange = ["7d", "30d", "90d"].includes(body.dateRange ?? "")
      ? (body.dateRange as "7d" | "30d" | "90d")
      : "30d";
    const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;

    // Get user's monitor IDs to scope results to this user.
    const userMonitors = await db
      .select({ id: monitors.id })
      .from(monitors)
      .where(eq(monitors.userId, userId));
    if (userMonitors.length === 0) {
      return NextResponse.json({
        explanation: "No monitors yet. Create one to see trend explanations here.",
        changePoint: null,
        drivers: [],
      });
    }
    const monitorIds = userMonitors.map((m) => m.id);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Daily sentiment counts. Group by day + sentiment so we can find the
    // largest day-over-day swing. Drop rows with null sentiment (legacy or
    // analysis-pending).
    const daily = await db
      .select({
        day: sql<string>`to_char(${results.postedAt}, 'YYYY-MM-DD')`,
        sentiment: results.sentiment,
        count: sql<number>`count(*)::int`,
      })
      .from(results)
      .where(
        and(
          inArray(results.monitorId, monitorIds),
          gte(results.postedAt, since),
          isNotNull(results.sentiment),
        )
      )
      .groupBy(sql`to_char(${results.postedAt}, 'YYYY-MM-DD')`, results.sentiment);

    if (daily.length < 3) {
      return NextResponse.json({
        explanation: `Not enough data in the last ${days} days to identify a trend. Wait a few more scan cycles, then try again.`,
        changePoint: null,
        drivers: [],
      });
    }

    // Roll up to per-day net sentiment score: positive - negative. Day with
    // the largest absolute delta vs the prior day is the "change point".
    const byDay = new Map<string, { positive: number; negative: number; neutral: number }>();
    for (const row of daily) {
      const cur = byDay.get(row.day) ?? { positive: 0, negative: 0, neutral: 0 };
      if (row.sentiment === "positive") cur.positive += row.count;
      else if (row.sentiment === "negative") cur.negative += row.count;
      else if (row.sentiment === "neutral") cur.neutral += row.count;
      byDay.set(row.day, cur);
    }
    const days_arr = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    let changePoint: string | null = null;
    let maxDelta = 0;
    for (let i = 1; i < days_arr.length; i++) {
      const [d, c] = days_arr[i];
      const [, prev] = days_arr[i - 1];
      const curNet = c.positive - c.negative;
      const prevNet = prev.positive - prev.negative;
      const delta = Math.abs(curNet - prevNet);
      if (delta > maxDelta) {
        maxDelta = delta;
        changePoint = d;
      }
    }

    // Sample representative results from the change-point window so the AI
    // has concrete examples to ground the explanation in.
    const sampleSinceDate = changePoint
      ? new Date(changePoint)
      : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const samples = await db
      .select({
        id: results.id,
        title: results.title,
        sentiment: results.sentiment,
        platform: results.platform,
        postedAt: results.postedAt,
      })
      .from(results)
      .where(
        and(
          inArray(results.monitorId, monitorIds),
          gte(results.postedAt, sampleSinceDate),
          isNotNull(results.sentiment),
        )
      )
      .limit(8);

    const sampleSummary = samples
      .map((s) => `- [${s.sentiment}] ${sanitizeInput(s.title, 200)} (${s.platform})`)
      .join("\n");

    const dailyJson = JSON.stringify(
      days_arr.map(([d, c]) => ({ d, ...c })),
      null,
      0,
    );

    // Trusted system prompt only. User-affected data goes in the user role.
    const systemPrompt = `You are a brand-monitoring analyst. Given daily sentiment counts and a sample of representative posts, write a concise 2-4 sentence explanation of what changed and why. Be specific about WHAT shifted (positive vs negative) and reference the most likely drivers from the sample posts. Don't speculate beyond the evidence.

Return JSON: {"explanation": "...", "changePoint": "YYYY-MM-DD or null", "drivers": [{"label": "...", "examples": ["resultId1", "resultId2"]}]}

Drivers should be 2-3 themes (e.g., "Mobile app complaints", "Pricing pushback", "Positive launch buzz") with the result IDs that best illustrate each.`;

    const userPrompt = `WINDOW: last ${days} days
DAILY_SENTIMENT_COUNTS (JSON): ${dailyJson}
LARGEST_CHANGE_POINT: ${changePoint ?? "no clear single inflection"}
RECENT_SAMPLE_POSTS:
${sampleSummary || "(no representative posts found)"}`;

    const result = await jsonCompletion<TrendExplainResponse>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: MODELS.primary,
    });

    await flushAI();

    await logAiCall({
      userId,
      model: result.meta.model,
      promptTokens: result.meta.promptTokens,
      completionTokens: result.meta.completionTokens,
      costUsd: result.meta.cost,
      latencyMs: result.meta.latencyMs,
      analysisType: "explain-trend",
    });

    // Guard against malformed model output.
    const safe: TrendExplainResponse = {
      explanation: typeof result.data.explanation === "string"
        ? result.data.explanation.slice(0, 800)
        : "Could not generate an explanation for this trend window.",
      changePoint: result.data.changePoint ?? changePoint,
      drivers: Array.isArray(result.data.drivers)
        ? result.data.drivers.slice(0, 5).map((d) => ({
            label: typeof d?.label === "string" ? d.label.slice(0, 80) : "",
            examples: Array.isArray(d?.examples)
              ? d.examples.filter((e) => typeof e === "string").slice(0, 5)
              : [],
          }))
        : [],
    };

    return NextResponse.json(safe);
  } catch (error) {
    logger.error("Explain trend error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to generate trend explanation" },
      { status: 500 }
    );
  }
}
