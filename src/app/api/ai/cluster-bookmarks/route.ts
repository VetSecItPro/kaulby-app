import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, bookmarks } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
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

/**
 * POST /api/ai/cluster-bookmarks
 *
 * Body: (none)
 *
 * Pulls the user's saved bookmarks (max 100), asks the model to group them
 * into 3-5 themed clusters (high-intent buyers, pain-point complainers,
 * competitor comparisons, feature requests, etc.), returns mapping of
 * cluster label → result IDs.
 *
 * Powers the "Cluster by intent" toggle on /dashboard/bookmarks. Was the
 * #139 P2 from the AI integration audit.
 */
export async function POST(req: Request) {
  // Suppress unused-var warning while keeping the signature consistent with
  // the other AI routes (req body is reserved for future filter params).
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

    // Pull the user's bookmarks. Joining results-by-bookmark is more
    // accurate than the legacy `results.isSaved` flag (which the bookmarks
    // page uses) because the bookmarks table is the actual source of truth.
    // Limit 100 to bound model input.
    const userBookmarks = await db
      .select({
        resultId: bookmarks.resultId,
      })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .limit(100);

    if (userBookmarks.length < 4) {
      return NextResponse.json({
        clusters: [],
        totalBookmarks: userBookmarks.length,
      });
    }
    const resultIds = userBookmarks.map((b) => b.resultId);

    const bookmarkedResults = await db
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

    // Compact representation for the model. One line per bookmark, indexed
    // by ID so the model can return clusters as ID lists without re-emitting
    // the full text.
    const indexed = bookmarkedResults
      .map((r) => `${r.id} | [${r.sentiment ?? "?"}, ${r.conversationCategory ?? "?"}, score ${r.leadScore ?? "—"}, ${r.platform}] ${sanitizeInput(r.title, 160)}`)
      .join("\n");

    const systemPrompt = `You are a sales-ops analyst. Group the user's saved posts into 3-5 themed clusters that match real workflows: high-intent buyers (lead score ≥75 or "looking for" / "alternative to" intent), pain-point complainers, competitor comparisons, feature requests, positive testimonials. Each cluster needs:
- a short label (2-4 words)
- a one-sentence description of what binds these together
- the resultIds that belong (use the IDs as given; do not invent new ones)

Every saved post should belong to exactly one cluster. Don't create more than 5 clusters; merge small ones. Don't return clusters with fewer than 2 results.

Return JSON: {"clusters": [{"label":"...", "description":"...", "resultIds":["..."]}]}`;

    const userPrompt = `BOOKMARKS (id | metadata | title):\n${indexed}`;

    const result = await jsonCompletion<ClusterResponse>({
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

    // Validate IDs against what we actually pulled — model can hallucinate.
    const knownIds = new Set(bookmarkedResults.map((r) => r.id));
    const rawClusters = Array.isArray(result.data.clusters) ? result.data.clusters : [];
    const safe: ClusterResponse = {
      clusters: rawClusters
        .slice(0, 5)
        .map((c) => ({
          label: typeof c?.label === "string" ? c.label.slice(0, 40) : "",
          description: typeof c?.description === "string" ? c.description.slice(0, 240) : "",
          resultIds: Array.isArray(c?.resultIds)
            ? c.resultIds.filter((id) => typeof id === "string" && knownIds.has(id))
            : [],
        }))
        .filter((c) => c.label && c.resultIds.length >= 2),
      totalBookmarks: bookmarkedResults.length,
    };

    return NextResponse.json(safe);
  } catch (error) {
    logger.error("Cluster bookmarks error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to cluster bookmarks" },
      { status: 500 }
    );
  }
}
