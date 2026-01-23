import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, desc } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { getUserPlan } from "@/lib/limits";
import { getPlanLimits, type PlanKey } from "@/lib/plans";
import { jsonCompletion, MODELS } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

// Thresholds - keep reasonable for meaningful clusters
// AI fallback handles sparse data
const THRESHOLDS = {
  free: {
    minKeywordOccurrence: 2,    // Keyword must appear in 2+ results
    minResultsPerTopic: 2,      // Topic needs 2+ results
    requireMultiplePlatforms: true,  // Must span platforms for cross-platform section
    useAiFallback: false,       // Free users don't get AI insights
  },
  pro: {
    minKeywordOccurrence: 2,    // Keep evidence-based
    minResultsPerTopic: 2,      // Meaningful clusters
    requireMultiplePlatforms: false, // Show single-platform topics
    useAiFallback: true,        // AI fills gaps when < 3 topics found
  },
  enterprise: {
    minKeywordOccurrence: 2,
    minResultsPerTopic: 2,
    requireMultiplePlatforms: false,
    useAiFallback: true,
  },
} as const;

// AI-powered topic extraction for Pro/Team users
interface AITopic {
  topic: string;
  description: string;
  resultIds: string[];
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  keywords: string[];
}

async function extractTopicsWithAI(
  resultsData: {
    id: string;
    title: string;
    content: string | null;
    platform: string;
    sentiment: string | null;
  }[]
): Promise<AITopic[]> {
  if (resultsData.length === 0) return [];

  // Limit to 50 results to control costs (~$0.005 per call with Gemini Flash)
  const limitedResults = resultsData.slice(0, 50);

  const prompt = `Analyze these community discussions and identify 3-5 main topics/themes being discussed.

DISCUSSIONS:
${limitedResults.map((r, i) => `[${i + 1}] (${r.platform}) ${r.title}${r.content ? `: ${r.content.slice(0, 200)}` : ""}`).join("\n")}

Return JSON array with topics:
{
  "topics": [
    {
      "topic": "Short topic name (2-4 words)",
      "description": "One sentence description",
      "resultIds": [indices of related discussions, e.g. 1, 3, 7],
      "sentiment": "positive" | "negative" | "mixed" | "neutral",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

Rules:
- Group related discussions into themes
- Each discussion can belong to multiple topics
- Focus on actionable business insights
- Identify pain points, feature requests, and sentiment trends`;

  try {
    const response = await jsonCompletion<{ topics: Array<{
      topic: string;
      description: string;
      resultIds: number[];
      sentiment: "positive" | "negative" | "mixed" | "neutral";
      keywords: string[];
    }> }>({
      messages: [{ role: "user", content: prompt }],
      model: MODELS.primary, // Gemini Flash - very cheap
    });

    // Map result indices back to actual IDs
    return response.data.topics.map(t => ({
      ...t,
      resultIds: t.resultIds
        .filter(idx => idx >= 1 && idx <= limitedResults.length)
        .map(idx => limitedResults[idx - 1].id),
    }));
  } catch (error) {
    console.error("AI topic extraction failed:", error);
    return [];
  }
}

interface TopicCluster {
  topic: string;
  keywords: string[];
  platforms: string[];
  results: {
    id: string;
    title: string;
    platform: string;
    sentiment: string | null;
    sourceUrl: string;
    createdAt: Date;
  }[];
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  trendDirection: "rising" | "falling" | "stable";
  isAIGenerated?: boolean; // True if topic was identified by AI
}

// Simple keyword extraction - find common significant words across results
function extractKeywords(texts: string[], minOccurrence: number = 2): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "up", "about", "into", "over", "after", "and", "but", "or",
    "as", "if", "when", "than", "because", "while", "where", "so", "though",
    "this", "that", "these", "those", "it", "its", "they", "them", "their",
    "we", "us", "our", "you", "your", "i", "my", "me", "he", "she", "him",
    "her", "his", "what", "which", "who", "whom", "how", "why", "just",
    "like", "get", "got", "make", "made", "know", "think", "want", "see",
    "use", "using", "used", "any", "all", "some", "most", "other", "more",
    "very", "really", "actually", "basically", "even", "also", "too",
    "much", "many", "few", "little", "own", "same", "different", "such",
    "only", "just", "still", "already", "yet", "here", "there", "now",
    "then", "today", "yesterday", "tomorrow", "new", "old", "good", "bad",
    "best", "better", "worst", "worse", "first", "last", "next", "going",
    "something", "anything", "everything", "nothing", "someone", "anyone",
    "everyone", "no", "not", "yes", "out", "one", "two", "been", "being",
  ]);

  const wordCounts = new Map<string, number>();

  texts.forEach((text) => {
    if (!text) return;
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    const seen = new Set<string>();
    words.forEach((word) => {
      if (!seen.has(word)) {
        seen.add(word);
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });
  });

  return Array.from(wordCounts.entries())
    .filter(([, count]) => count >= minOccurrence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// Group results by shared keywords to find cross-platform topics
function findTopicClusters(
  resultsData: {
    id: string;
    title: string;
    content: string | null;
    platform: string;
    sentiment: string | null;
    sourceUrl: string;
    createdAt: Date;
  }[],
  thresholds: typeof THRESHOLDS[keyof typeof THRESHOLDS]
): TopicCluster[] {
  // Group results by their primary keywords
  const keywordGroups = new Map<string, typeof resultsData>();

  resultsData.forEach((result) => {
    const text = `${result.title} ${result.content || ""}`;
    const keywords = extractKeywords([text], thresholds.minKeywordOccurrence);
    if (keywords.length > 0) {
      const primaryKeyword = keywords[0];
      if (!keywordGroups.has(primaryKeyword)) {
        keywordGroups.set(primaryKeyword, []);
      }
      keywordGroups.get(primaryKeyword)!.push(result);
    }
  });

  // Convert to clusters
  const clusters: TopicCluster[] = [];

  keywordGroups.forEach((groupResults, keyword) => {
    const platforms = Array.from(new Set(groupResults.map((r) => r.platform)));

    // Check platform requirement based on thresholds
    const meetsplatformRequirement = thresholds.requireMultiplePlatforms
      ? platforms.length >= 2
      : true;

    // Check minimum results requirement
    const meetsResultsRequirement = groupResults.length >= thresholds.minResultsPerTopic;

    if (meetsplatformRequirement && meetsResultsRequirement) {
      const allTexts = groupResults.map((r) => `${r.title} ${r.content || ""}`);
      const keywords = extractKeywords(allTexts, thresholds.minKeywordOccurrence);

      // Calculate sentiment breakdown
      let positive = 0,
        negative = 0,
        neutral = 0;
      groupResults.forEach((r) => {
        if (r.sentiment === "positive") positive++;
        else if (r.sentiment === "negative") negative++;
        else neutral++;
      });

      // Determine trend direction based on recency
      const now = new Date();
      const recentResults = groupResults.filter(
        (r) => now.getTime() - r.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000
      );
      const olderResults = groupResults.filter(
        (r) => now.getTime() - r.createdAt.getTime() >= 7 * 24 * 60 * 60 * 1000
      );

      let trendDirection: "rising" | "falling" | "stable" = "stable";
      if (recentResults.length > olderResults.length) {
        trendDirection = "rising";
      } else if (recentResults.length < olderResults.length * 0.5) {
        trendDirection = "falling";
      }

      // Create topic name from top keywords
      const topicName = keywords.slice(0, 3).join(" ") || keyword;

      clusters.push({
        topic: topicName
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        keywords,
        platforms,
        results: groupResults.map((r) => ({
          id: r.id,
          title: r.title,
          platform: r.platform,
          sentiment: r.sentiment,
          sourceUrl: r.sourceUrl,
          createdAt: r.createdAt,
        })),
        sentimentBreakdown: { positive, negative, neutral },
        trendDirection,
      });
    }
  });

  // Sort by result count (most discussed topics first)
  return clusters.sort((a, b) => b.results.length - a.results.length).slice(0, 10);
}

// Find trending topics within a single platform
function findSinglePlatformTopics(
  resultsData: {
    id: string;
    title: string;
    content: string | null;
    platform: string;
    sentiment: string | null;
    sourceUrl: string;
    createdAt: Date;
  }[],
  thresholds: typeof THRESHOLDS[keyof typeof THRESHOLDS]
): TopicCluster[] {
  // Group results by their primary keywords (regardless of platform)
  const keywordGroups = new Map<string, typeof resultsData>();

  resultsData.forEach((result) => {
    const text = `${result.title} ${result.content || ""}`;
    const keywords = extractKeywords([text], thresholds.minKeywordOccurrence);
    if (keywords.length > 0) {
      const primaryKeyword = keywords[0];
      if (!keywordGroups.has(primaryKeyword)) {
        keywordGroups.set(primaryKeyword, []);
      }
      keywordGroups.get(primaryKeyword)!.push(result);
    }
  });

  // Convert to clusters - use threshold for minimum results
  const clusters: TopicCluster[] = [];

  keywordGroups.forEach((groupResults, keyword) => {
    if (groupResults.length >= thresholds.minResultsPerTopic) {
      const platforms = Array.from(new Set(groupResults.map((r) => r.platform)));
      const allTexts = groupResults.map((r) => `${r.title} ${r.content || ""}`);
      const keywords = extractKeywords(allTexts, thresholds.minKeywordOccurrence);

      // Calculate sentiment breakdown
      let positive = 0, negative = 0, neutral = 0;
      groupResults.forEach((r) => {
        if (r.sentiment === "positive") positive++;
        else if (r.sentiment === "negative") negative++;
        else neutral++;
      });

      // Determine trend direction
      const now = new Date();
      const recentResults = groupResults.filter(
        (r) => now.getTime() - r.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000
      );
      const olderResults = groupResults.filter(
        (r) => now.getTime() - r.createdAt.getTime() >= 7 * 24 * 60 * 60 * 1000
      );

      let trendDirection: "rising" | "falling" | "stable" = "stable";
      if (recentResults.length > olderResults.length) {
        trendDirection = "rising";
      } else if (recentResults.length < olderResults.length * 0.5) {
        trendDirection = "falling";
      }

      const topicName = keywords.slice(0, 3).join(" ") || keyword;

      clusters.push({
        topic: topicName
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        keywords,
        platforms,
        results: groupResults.map((r) => ({
          id: r.id,
          title: r.title,
          platform: r.platform,
          sentiment: r.sentiment,
          sourceUrl: r.sourceUrl,
          createdAt: r.createdAt,
        })),
        sentimentBreakdown: { positive, negative, neutral },
        trendDirection,
      });
    }
  });

  return clusters.sort((a, b) => b.results.length - a.results.length).slice(0, 10);
}

// Convert AI-generated topics to TopicCluster format
function convertAITopicsToCluster(
  aiTopics: AITopic[],
  resultsData: {
    id: string;
    title: string;
    content: string | null;
    platform: string;
    sentiment: string | null;
    sourceUrl: string;
    createdAt: Date;
  }[]
): TopicCluster[] {
  const resultMap = new Map(resultsData.map(r => [r.id, r]));

  return aiTopics.map(aiTopic => {
    const matchedResults = aiTopic.resultIds
      .map(id => resultMap.get(id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    const platforms = Array.from(new Set(matchedResults.map(r => r.platform)));

    // Calculate sentiment from matched results
    let positive = 0, negative = 0, neutral = 0;
    matchedResults.forEach(r => {
      if (r.sentiment === "positive") positive++;
      else if (r.sentiment === "negative") negative++;
      else neutral++;
    });

    // Map AI sentiment to trend direction
    const trendDirection: "rising" | "falling" | "stable" =
      aiTopic.sentiment === "positive" ? "rising" :
      aiTopic.sentiment === "negative" ? "falling" : "stable";

    return {
      topic: aiTopic.topic,
      keywords: aiTopic.keywords,
      platforms,
      results: matchedResults.map(r => ({
        id: r.id,
        title: r.title,
        platform: r.platform,
        sentiment: r.sentiment,
        sourceUrl: r.sourceUrl,
        createdAt: r.createdAt,
      })),
      sentimentBreakdown: { positive, negative, neutral },
      trendDirection,
      isAIGenerated: true, // Flag for UI to indicate AI-powered insight
    };
  }).filter(c => c.results.length > 0);
}

export async function GET(request: Request) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's plan info
    const userPlan = await getUserPlan(userId);
    const planLimits = getPlanLimits(userPlan);
    const availablePlatforms = planLimits.platforms;
    const canHaveMultiplePlatforms = availablePlatforms.length > 1;

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    // Calculate start date
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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
      columns: { id: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json({
        topics: [],
        singlePlatformTopics: [],
        platformCorrelation: [],
        totalResults: 0,
        plan: userPlan,
        canHaveMultiplePlatforms,
        platformsInData: [],
      });
    }

    const monitorIds = userMonitors.map((m) => m.id);

    // Fetch results for analysis
    const userResults = await db.query.results.findMany({
      where: and(
        inArray(results.monitorId, monitorIds),
        gte(results.createdAt, startDate)
      ),
      columns: {
        id: true,
        title: true,
        content: true,
        platform: true,
        sentiment: true,
        sourceUrl: true,
        createdAt: true,
      },
      orderBy: desc(results.createdAt),
      limit: 500, // Analyze up to 500 recent results
    });

    // Calculate which platforms appear in the user's data
    const platformsInData = Array.from(new Set(userResults.map((r) => r.platform)));

    if (userResults.length === 0) {
      return NextResponse.json({
        topics: [],
        singlePlatformTopics: [],
        aiTopics: [],
        platformCorrelation: [],
        totalResults: 0,
        plan: userPlan,
        canHaveMultiplePlatforms,
        platformsInData: [],
      });
    }

    // Get plan-specific thresholds
    const thresholds = THRESHOLDS[userPlan as keyof typeof THRESHOLDS] || THRESHOLDS.free;

    // Find cross-platform topic clusters
    const topics = findTopicClusters(userResults, thresholds);

    // Find single-platform topics (for paid users, always show; for free, only as fallback)
    const singlePlatformTopics = !thresholds.requireMultiplePlatforms || topics.length === 0
      ? findSinglePlatformTopics(userResults, thresholds)
      : [];

    // AI-powered topic extraction for Pro/Team when keyword clustering finds < 3 topics
    let aiTopics: TopicCluster[] = [];
    const totalKeywordTopics = topics.length + singlePlatformTopics.length;

    if (thresholds.useAiFallback && totalKeywordTopics < 3 && userResults.length >= 3) {
      console.log(`[Insights] Using AI fallback for user - found ${totalKeywordTopics} keyword topics from ${userResults.length} results`);
      const aiExtractedTopics = await extractTopicsWithAI(userResults);
      aiTopics = convertAITopicsToCluster(aiExtractedTopics, userResults);
    }

    // Calculate platform correlation (which platforms often discuss the same topics)
    const platformPairs = new Map<string, number>();
    topics.forEach((topic) => {
      const platforms = topic.platforms;
      for (let i = 0; i < platforms.length; i++) {
        for (let j = i + 1; j < platforms.length; j++) {
          const key = [platforms[i], platforms[j]].sort().join("-");
          platformPairs.set(key, (platformPairs.get(key) || 0) + 1);
        }
      }
    });

    const platformCorrelation = Array.from(platformPairs.entries())
      .map(([pair, count]) => {
        const [platform1, platform2] = pair.split("-");
        return { platform1, platform2, sharedTopics: count };
      })
      .sort((a, b) => b.sharedTopics - a.sharedTopics);

    return NextResponse.json({
      topics,
      singlePlatformTopics,
      aiTopics, // AI-generated topics for Pro/Team when keyword clustering is sparse
      platformCorrelation,
      totalResults: userResults.length,
      plan: userPlan as PlanKey,
      canHaveMultiplePlatforms,
      platformsInData,
    });
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
