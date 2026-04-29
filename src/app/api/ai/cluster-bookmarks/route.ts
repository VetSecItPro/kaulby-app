import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, bookmarks } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { getUserPlan } from "@/lib/limits";
import { jsonCompletion, MODELS, flushAI } from "@/lib/ai/openrouter";
import { logAiCall } from "@/lib/ai/log";
import { checkAllRateLimits, checkTokenBudget, sanitizeInput } from "@/lib/ai/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface ClusterResponse {
  clusters: Array<{
    label: string;
    description: string;
    resultIds: string[];
  }>;
  totalBookmarks: number;
}

type BookmarkRow = {
  id: string;
  title: string | null;
  platform: string;
  sentiment: string | null;
  conversationCategory: string | null;
  leadScore: number | null;
};

// Bucket key → human-friendly default label/description.
// Used both as the pre-bucket assignment target AND as the fallback
// when the labeler call fails or returns garbage.
const BUCKET_DEFAULTS: Record<string, { label: string; description: string }> = {
  high_intent: {
    label: "High-intent buyers",
    description: "Lead score >= 75 — actively in-market and worth replying first.",
  },
  solution_seekers: {
    label: "Solution seekers",
    description: "People asking for recommendations or alternatives.",
  },
  pain_points: {
    label: "Pain points",
    description: "Frustrations and complaints — your wedge for outreach.",
  },
  money_talk: {
    label: "Pricing & ROI",
    description: "Budget questions, pricing pushback, and ROI conversations.",
  },
  hot_discussion: {
    label: "Hot threads",
    description: "High-engagement discussions worth a thoughtful reply.",
  },
  general: {
    label: "Everything else",
    description: "Saved posts that don't fit a single sales workflow.",
  },
};

// Priority order: each bookmark lands in the FIRST bucket it qualifies for.
// high_intent wins regardless of category because lead score outranks topic.
const BUCKET_PRIORITY = [
  "high_intent",
  "solution_seekers",
  "pain_points",
  "money_talk",
  "hot_discussion",
  "general",
] as const;

function bucketFor(row: BookmarkRow): (typeof BUCKET_PRIORITY)[number] {
  if ((row.leadScore ?? 0) >= 75) return "high_intent";
  if (row.conversationCategory === "solution_request") return "solution_seekers";
  if (row.conversationCategory === "pain_point" || row.sentiment === "negative") return "pain_points";
  if (row.conversationCategory === "money_talk") return "money_talk";
  if (row.conversationCategory === "hot_discussion") return "hot_discussion";
  return "general";
}

/**
 * POST /api/ai/cluster-bookmarks
 *
 * Returns 3-5 themed clusters of the user's saved bookmarks. Powers the
 * "Cluster by intent" toggle on /dashboard/bookmarks (originally #139).
 *
 * Two-stage strategy (#143):
 *   1. Pre-bucket every bookmark by metadata (sentiment / leadScore /
 *      conversationCategory). Zero LLM time. Deterministic. Handles 100
 *      items as fast as 5.
 *   2. Ask the model ONLY for a {label, description} per non-empty bucket,
 *      with up to 3 sample titles for context. Output is ~5 short strings
 *      (~250 tokens) instead of re-emitting every resultId.
 *
 * Old version sent the model up to 100 indexed lines and asked it to
 * group + label + return ID lists in one shot. Output token count scaled
 * with bookmark count, and Gemini Flash's implicit reasoning blew the
 * latency to 21s+ even for tiny inputs. This version is bookmark-count
 * insensitive: ~1-2s regardless of cap.
 */
export async function POST(req: Request) {
  void req;

  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plan = await getUserPlan(userId);
    if (plan !== "solo" && plan !== "scale" && plan !== "growth") {
      return NextResponse.json(
        { error: "Bookmark clustering requires a Solo, Scale, or Growth plan" },
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

    const userBookmarks = await db
      .select({ resultId: bookmarks.resultId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .limit(100);

    if (userBookmarks.length < 4) {
      return NextResponse.json({ clusters: [], totalBookmarks: userBookmarks.length });
    }

    const resultIds = userBookmarks.map((b) => b.resultId);

    const bookmarkedResults: BookmarkRow[] = await db
      .select({
        id: results.id,
        title: results.title,
        platform: results.platform,
        sentiment: results.sentiment,
        conversationCategory: results.conversationCategory,
        leadScore: results.leadScore,
      })
      .from(results)
      .where(inArray(results.id, resultIds));

    // Stage 1: deterministic pre-bucket.
    const buckets = new Map<string, BookmarkRow[]>();
    for (const row of bookmarkedResults) {
      const key = bucketFor(row);
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }

    // Drop tiny buckets (< 2). If the result is < 2 buckets, merge the
    // dropped items back into "general" so we never starve the UI.
    const dropped: BookmarkRow[] = [];
    for (const [key, rows] of buckets.entries()) {
      if (rows.length < 2 && key !== "general") {
        dropped.push(...rows);
        buckets.delete(key);
      }
    }
    if (dropped.length > 0) {
      const general = buckets.get("general") ?? [];
      buckets.set("general", [...general, ...dropped]);
      if ((buckets.get("general")?.length ?? 0) < 2) buckets.delete("general");
    }

    // Order buckets by priority and trim to 5.
    const orderedKeys = BUCKET_PRIORITY.filter((k) => buckets.has(k)).slice(0, 5);
    if (orderedKeys.length === 0) {
      return NextResponse.json({ clusters: [], totalBookmarks: bookmarkedResults.length });
    }

    // Stage 2: AI labels each bucket given 3 sample titles. Output is tiny.
    let labels: Record<string, { label: string; description: string }> = {};

    try {
      const samples = orderedKeys.map((key) => {
        const rows = buckets.get(key) ?? [];
        const titles = rows
          .slice(0, 3)
          .map((r) => sanitizeInput(r.title ?? "(no title)", 120))
          .map((t) => `  - ${t}`)
          .join("\n");
        return `[${key}] (${rows.length} posts)\n${titles}`;
      }).join("\n\n");

      const systemPrompt = `You label sales-ops bucket groups. The buckets are pre-sorted by metadata. For each bucket key, return a short label (2-4 words) and a one-sentence description (max 120 chars) that reflects the sample titles.

Return JSON: {"labels": {"<bucket_key>": {"label":"...", "description":"..."}}}

Use the bucket keys exactly as given. Don't invent new keys.`;

      const userPrompt = `Buckets to label:\n\n${samples}`;

      const result = await jsonCompletion<{ labels: Record<string, { label: string; description: string }> }>({
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
        analysisType: "cluster-bookmarks",
      });

      labels = result.data?.labels ?? {};
    } catch (err) {
      // Labeler is best-effort. Fall back to defaults so the user still
      // gets useful clusters even if the model 500s or times out.
      logger.warn("[cluster-bookmarks] labeler failed; using defaults", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const clusters = orderedKeys.map((key) => {
      const aiLabel = labels[key];
      const fallback = BUCKET_DEFAULTS[key];
      const label = (typeof aiLabel?.label === "string" && aiLabel.label.trim()
        ? aiLabel.label.trim().slice(0, 40)
        : fallback.label);
      const description = (typeof aiLabel?.description === "string" && aiLabel.description.trim()
        ? aiLabel.description.trim().slice(0, 240)
        : fallback.description);
      return {
        label,
        description,
        resultIds: (buckets.get(key) ?? []).map((r) => r.id),
      };
    }).filter((c) => c.resultIds.length >= 2);

    return NextResponse.json({
      clusters,
      totalBookmarks: bookmarkedResults.length,
    } satisfies ClusterResponse);
  } catch (error) {
    logger.error("Cluster bookmarks error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to cluster bookmarks" }, { status: 500 });
  }
}
