import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, desc, isNotNull } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { getUserPlan } from "@/lib/limits";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { cachedQuery, CACHE_TTL } from "@/lib/cache";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Human-readable labels for pain point categories
const CATEGORY_LABELS: Record<string, string> = {
  competitor_mention: "Competitor Mentions",
  pricing_concern: "Pricing Concerns",
  feature_request: "Feature Requests",
  support_need: "Support Needs",
  negative_experience: "Negative Experiences",
  positive_feedback: "Positive Feedback",
  general_discussion: "General Discussion",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  competitor_mention: "Users comparing your product to competitors or discussing alternatives",
  pricing_concern: "Discussions about cost, value perception, or price objections",
  feature_request: "Users requesting new features or improvements to existing ones",
  support_need: "Users seeking help, reporting bugs, or troubleshooting issues",
  negative_experience: "Complaints, frustrations, or warnings about poor experiences",
  positive_feedback: "Praise, recommendations, and positive user experiences",
  general_discussion: "General conversations mentioning your brand or keywords",
};

// Severity ranking - higher = more urgent to address
const CATEGORY_SEVERITY: Record<string, number> = {
  negative_experience: 5,
  support_need: 4,
  pricing_concern: 3,
  competitor_mention: 3,
  feature_request: 2,
  general_discussion: 1,
  positive_feedback: 0,
};

interface PainPointGroup {
  category: string;
  label: string;
  description: string;
  severity: number;
  count: number;
  trend: "rising" | "falling" | "stable";
  platforms: string[];
  monitors: string[];
  sentimentBreakdown: { positive: number; negative: number; neutral: number };
  topMentions: {
    id: string;
    title: string;
    platform: string;
    sentiment: string | null;
    sourceUrl: string;
    createdAt: string;
    monitorName: string;
  }[];
  keywords: string[];
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
      return NextResponse.json({ painPoints: [], plan: userPlan, totalResults: 0 });
    }

    const monitorIds = userMonitors.map((m) => m.id);
    const monitorNameMap = new Map(userMonitors.map((m) => [m.id, m.name]));

    // Fetch results that have pain point categories assigned
    const { data: rawResults } = await cachedQuery(
      "insights:pain-points",
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
            sentimentScore: true,
            painPointCategory: true,
            sourceUrl: true,
            createdAt: true,
            monitorId: true,
          },
          orderBy: desc(results.createdAt),
          limit: 500,
        });
      },
      CACHE_TTL.RESULTS
    );

    // Group by pain point category
    const groupedByCategory = new Map<string, typeof rawResults>();
    for (const result of rawResults) {
      if (!result.painPointCategory) continue;
      const category = result.painPointCategory;
      if (!groupedByCategory.has(category)) {
        groupedByCategory.set(category, []);
      }
      groupedByCategory.get(category)!.push(result);
    }

    // Build pain point groups
    const painPoints: PainPointGroup[] = [];

    for (const [category, categoryResults] of groupedByCategory) {
      // Skip positive feedback from pain points list - it's not a problem to fix
      if (category === "positive_feedback") continue;

      const platforms = Array.from(new Set(categoryResults.map((r) => r.platform)));
      const monitorNames = Array.from(
        new Set(categoryResults.map((r) => monitorNameMap.get(r.monitorId) || "Unknown"))
      );

      // Sentiment breakdown
      let positive = 0, negative = 0, neutral = 0;
      for (const r of categoryResults) {
        if (r.sentiment === "positive") positive++;
        else if (r.sentiment === "negative") negative++;
        else neutral++;
      }

      // Trend: compare last 7 days vs older
      const recentResults = categoryResults.filter(
        (r) => now.getTime() - r.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000
      );
      const olderResults = categoryResults.filter(
        (r) => now.getTime() - r.createdAt.getTime() >= 7 * 24 * 60 * 60 * 1000
      );
      let trend: "rising" | "falling" | "stable" = "stable";
      if (recentResults.length > olderResults.length) trend = "rising";
      else if (recentResults.length < olderResults.length * 0.5) trend = "falling";

      // Extract common keywords from this category
      const keywords = extractTopKeywords(
        categoryResults.map((r) => `${r.title} ${r.content || ""}`),
        5
      );

      // Top mentions (most recent, limit to 5)
      const topMentions = categoryResults.slice(0, 5).map((r) => ({
        id: r.id,
        title: r.title,
        platform: r.platform,
        sentiment: r.sentiment,
        sourceUrl: r.sourceUrl,
        createdAt: r.createdAt.toISOString(),
        monitorName: monitorNameMap.get(r.monitorId) || "Unknown",
      }));

      painPoints.push({
        category,
        label: CATEGORY_LABELS[category] || category,
        description: CATEGORY_DESCRIPTIONS[category] || "",
        severity: CATEGORY_SEVERITY[category] ?? 1,
        count: categoryResults.length,
        trend,
        platforms,
        monitors: monitorNames,
        sentimentBreakdown: { positive, negative, neutral },
        topMentions,
        keywords,
      });
    }

    // Sort by severity (highest first), then by count
    painPoints.sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.count - a.count;
    });

    const response = NextResponse.json({
      painPoints,
      plan: userPlan,
      totalResults: rawResults.length,
    });
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return response;
  } catch (error) {
    logger.error("Pain points API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to fetch pain points" }, { status: 500 });
  }
}

// Simple keyword extraction - top N most frequent significant words
function extractTopKeywords(texts: string[], limit: number): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "up", "about", "into",
    "over", "after", "and", "but", "or", "as", "if", "when", "than",
    "because", "while", "where", "so", "though", "this", "that", "these",
    "those", "it", "its", "they", "them", "their", "we", "us", "our",
    "you", "your", "i", "my", "me", "he", "she", "him", "her", "his",
    "what", "which", "who", "whom", "how", "why", "just", "like", "get",
    "got", "make", "made", "know", "think", "want", "see", "use", "using",
    "used", "any", "all", "some", "most", "other", "more", "very",
    "really", "actually", "basically", "even", "also", "too", "much",
    "many", "few", "little", "own", "same", "different", "such", "only",
    "still", "already", "yet", "here", "there", "now", "then", "today",
    "something", "anything", "everything", "nothing", "someone", "anyone",
    "everyone", "no", "not", "yes", "out", "one", "two", "been", "going",
    "new", "old", "good", "bad", "best", "better", "worst", "worse",
    "first", "last", "next",
  ]);

  const wordCounts = new Map<string, number>();
  for (const text of texts) {
    if (!text) continue;
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    const seen = new Set<string>();
    for (const word of words) {
      if (!seen.has(word)) {
        seen.add(word);
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  return Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}
