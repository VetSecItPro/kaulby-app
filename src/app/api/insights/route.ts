import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, inArray, gte, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
}

// Simple keyword extraction - find common significant words across results
function extractKeywords(texts: string[]): string[] {
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
    .filter(([, count]) => count >= 2) // Appears in at least 2 results
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
  }[]
): TopicCluster[] {
  // Group results by their primary keywords
  const keywordGroups = new Map<string, typeof resultsData>();

  resultsData.forEach((result) => {
    const text = `${result.title} ${result.content || ""}`;
    const keywords = extractKeywords([text]);
    if (keywords.length > 0) {
      const primaryKeyword = keywords[0];
      if (!keywordGroups.has(primaryKeyword)) {
        keywordGroups.set(primaryKeyword, []);
      }
      keywordGroups.get(primaryKeyword)!.push(result);
    }
  });

  // Convert to clusters, only keeping cross-platform topics
  const clusters: TopicCluster[] = [];

  keywordGroups.forEach((groupResults, keyword) => {
    const platforms = Array.from(new Set(groupResults.map((r) => r.platform)));

    // Only include if topic appears on multiple platforms
    if (platforms.length >= 2) {
      const allTexts = groupResults.map((r) => `${r.title} ${r.content || ""}`);
      const keywords = extractKeywords(allTexts);

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

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        platformCorrelation: [],
        totalResults: 0,
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

    if (userResults.length === 0) {
      return NextResponse.json({
        topics: [],
        platformCorrelation: [],
        totalResults: 0,
      });
    }

    // Find cross-platform topic clusters
    const topics = findTopicClusters(userResults);

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
      platformCorrelation,
      totalResults: userResults.length,
    });
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
