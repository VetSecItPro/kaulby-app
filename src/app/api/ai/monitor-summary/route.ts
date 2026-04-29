import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, and, gte, desc, isNotNull } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { getUserPlan } from "@/lib/limits";
import { jsonCompletion, MODELS, flushAI } from "@/lib/ai/openrouter";
import { logAiCall } from "@/lib/ai/log";
import { checkAllRateLimits, checkTokenBudget, sanitizeInput } from "@/lib/ai/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface MonitorSummaryResponse {
  takeaways: string[];        // Top 3 narrative takeaways
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topPlatform: string | null;
  resultCount: number;
  rangeDays: number;
}

/**
 * POST /api/ai/monitor-summary
 *
 * Body: { monitorId: string, rangeDays?: number (default 7) }
 *
 * Fetches the last `rangeDays` of results for a single monitor and asks the
 * model for 3 narrative takeaways grounded in actual content. Powers the
 * "Top 3 takeaways" card on /dashboard/monitors/[id].
 *
 * Empty-states gracefully when the monitor has fewer than 5 results in the
 * window — AI summaries on tiny samples are noise.
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
        { error: "Monitor summaries require a Solo, Scale, or Growth plan" },
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

    const body = (await req.json().catch(() => ({}))) as { monitorId?: string; rangeDays?: number };
    if (!body.monitorId || typeof body.monitorId !== "string") {
      return NextResponse.json({ error: "monitorId is required" }, { status: 400 });
    }
    const rangeDays = typeof body.rangeDays === "number" && body.rangeDays > 0 && body.rangeDays <= 30
      ? Math.floor(body.rangeDays)
      : 7;

    // Verify the monitor belongs to the user.
    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, body.monitorId), eq(monitors.userId, userId)),
      columns: { id: true, name: true, companyName: true },
    });
    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const recent = await db
      .select({
        id: results.id,
        title: results.title,
        platform: results.platform,
        sentiment: results.sentiment,
        leadScore: results.leadScore,
      })
      .from(results)
      .where(and(eq(results.monitorId, monitor.id), gte(results.postedAt, since), isNotNull(results.sentiment)))
      .orderBy(desc(results.postedAt))
      .limit(40);

    if (recent.length < 5) {
      return NextResponse.json({
        takeaways: [
          `Not enough data yet for "${monitor.name}". Wait until at least 5 mentions are scanned in the window.`,
        ],
        sentiment: { positive: 0, negative: 0, neutral: 0 },
        topPlatform: null,
        resultCount: recent.length,
        rangeDays,
      });
    }

    // Aggregate signal up front so the model gets a compact summary, not a
    // raw 40-row dump. This keeps token cost per call bounded.
    let positive = 0, negative = 0, neutral = 0;
    const platformCounts = new Map<string, number>();
    for (const r of recent) {
      if (r.sentiment === "positive") positive++;
      else if (r.sentiment === "negative") negative++;
      else if (r.sentiment === "neutral") neutral++;
      platformCounts.set(r.platform, (platformCounts.get(r.platform) ?? 0) + 1);
    }
    const topPlatform = [...platformCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Sample 8 highest-signal posts — prefer high lead-score, fall back to recency.
    const sample = [...recent]
      .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))
      .slice(0, 8);
    const sampleSummary = sample
      .map((r) => `- [${r.sentiment}, score ${r.leadScore ?? "—"}] ${sanitizeInput(r.title, 180)} (${r.platform})`)
      .join("\n");

    const systemPrompt = `You are a brand-monitoring analyst. Given aggregate stats and a sample of representative mentions for a single brand monitor, produce exactly 3 sharp takeaways. Each takeaway is one sentence, concrete, references actual content not generalities. Don't use hype words ("amazing", "incredible"). Don't speculate beyond the evidence.

Return JSON: {"takeaways": ["...", "...", "..."]}`;

    const userPrompt = `MONITOR: ${monitor.name} (tracking: ${monitor.companyName})
WINDOW: last ${rangeDays} days, ${recent.length} mentions
SENTIMENT_BREAKDOWN: ${positive} positive, ${negative} negative, ${neutral} neutral
TOP_PLATFORM: ${topPlatform ?? "n/a"}
HIGH_SIGNAL_SAMPLE:
${sampleSummary}`;

    const result = await jsonCompletion<{ takeaways: string[] }>({
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
      monitorId: monitor.id,
      promptTokens: result.meta.promptTokens,
      completionTokens: result.meta.completionTokens,
      costUsd: result.meta.cost,
      latencyMs: result.meta.latencyMs,
      analysisType: "monitor-summary",
    });

    const safe: MonitorSummaryResponse = {
      takeaways: Array.isArray(result.data.takeaways)
        ? result.data.takeaways
            .filter((t) => typeof t === "string")
            .slice(0, 3)
            .map((t) => t.trim().slice(0, 240))
        : [],
      sentiment: { positive, negative, neutral },
      topPlatform,
      resultCount: recent.length,
      rangeDays,
    };

    return NextResponse.json(safe);
  } catch (error) {
    logger.error("Monitor summary error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to generate monitor summary" },
      { status: 500 }
    );
  }
}
