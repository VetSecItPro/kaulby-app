"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Loader2,
  ExternalLink,
  Sparkles,
  Network,
  Lock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
    createdAt: string;
  }[];
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  trendDirection: "rising" | "falling" | "stable";
  isAIGenerated?: boolean;
}

interface PlatformCorrelation {
  platform1: string;
  platform2: string;
  sharedTopics: number;
}

interface InsightsData {
  topics: TopicCluster[];
  singlePlatformTopics: TopicCluster[];
  aiTopics: TopicCluster[]; // AI-generated topics for Pro/Team
  platformCorrelation: PlatformCorrelation[];
  totalResults: number;
  plan: "free" | "pro" | "enterprise";
  canHaveMultiplePlatforms: boolean;
  platformsInData: string[];
}

const PLATFORM_COLORS: Record<string, string> = {
  reddit: "bg-orange-500",
  hackernews: "bg-orange-600",
  producthunt: "bg-orange-700",
  devto: "bg-gray-800",
  googlereviews: "bg-blue-500",
  trustpilot: "bg-green-500",
  appstore: "bg-sky-500",
  playstore: "bg-green-600",
  quora: "bg-red-600",
};

const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
  devto: "Dev.to",
  googlereviews: "Google Reviews",
  trustpilot: "Trustpilot",
  appstore: "App Store",
  playstore: "Play Store",
  quora: "Quora",
};

type TimeRange = "7d" | "30d" | "90d";

// TopicCard component for reusability
function TopicCard({
  topic,
  expandedTopic,
  setExpandedTopic,
  getTrendIcon,
  getTrendLabel,
}: {
  topic: TopicCluster;
  expandedTopic: string | null;
  setExpandedTopic: (topic: string | null) => void;
  getTrendIcon: (direction: string) => React.ReactNode;
  getTrendLabel: (direction: string) => string;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        expandedTopic === topic.topic && "ring-2 ring-primary",
        topic.isAIGenerated && "border-purple-500/30"
      )}
      onClick={() =>
        setExpandedTopic(expandedTopic === topic.topic ? null : topic.topic)
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{topic.topic}</CardTitle>
              {topic.isAIGenerated && (
                <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/50">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
            <CardDescription className="flex items-center gap-1 mt-1">
              {getTrendIcon(topic.trendDirection)}
              <span>{getTrendLabel(topic.trendDirection)}</span>
            </CardDescription>
          </div>
          <Badge variant="secondary">{topic.results.length} mentions</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Platforms */}
        <div className="flex flex-wrap gap-1.5">
          {topic.platforms.map((platform) => (
            <Badge
              key={platform}
              className={cn("text-white text-xs", PLATFORM_COLORS[platform])}
            >
              {PLATFORM_LABELS[platform] || platform}
            </Badge>
          ))}
        </div>

        {/* Sentiment breakdown */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-600">
            {topic.sentimentBreakdown.positive} positive
          </span>
          <span className="text-red-600">
            {topic.sentimentBreakdown.negative} negative
          </span>
          <span className="text-gray-600">
            {topic.sentimentBreakdown.neutral} neutral
          </span>
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1">
          {topic.keywords.slice(0, 5).map((keyword) => (
            <Badge key={keyword} variant="outline" className="text-xs">
              {keyword}
            </Badge>
          ))}
        </div>

        {/* Expanded view: Recent mentions */}
        {expandedTopic === topic.topic && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-sm font-medium">Recent Mentions</p>
            {topic.results.slice(0, 5).map((result) => (
              <a
                key={result.id}
                href={result.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Badge
                  className={cn(
                    "text-white text-xs shrink-0 mt-0.5",
                    PLATFORM_COLORS[result.platform]
                  )}
                >
                  {PLATFORM_LABELS[result.platform] || result.platform}
                </Badge>
                <span className="text-sm line-clamp-1 flex-1">
                  {result.title}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InsightsView() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("30d");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      try {
        const response = await fetch(`/api/insights?range=${range}`);
        if (response.ok) {
          const insights = await response.json();
          setData(insights);
        }
      } catch (error) {
        console.error("Failed to fetch insights:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [range]);

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "falling":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendLabel = (direction: string) => {
    switch (direction) {
      case "rising":
        return "Trending up";
      case "falling":
        return "Declining";
      default:
        return "Stable";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Case 1: Free user - can't have cross-platform (Reddit only)
  if (data && !data.canHaveMultiplePlatforms) {
    return (
      <div className="space-y-6">
        {/* Upgrade prompt for free users */}
        <Card className="border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-yellow-500/5">
          <CardContent className="flex flex-col md:flex-row items-center gap-6 py-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-semibold mb-2">Unlock Cross-Platform Insights</h3>
              <p className="text-muted-foreground mb-4">
                You&apos;re currently on the Free plan which only monitors Reddit.
                Upgrade to Pro to track conversations across all 9 platforms and discover
                trends that span Reddit, Hacker News, Product Hunt, Google Reviews, and more.
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <Link href="/pricing">
                  <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade to Pro
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Show single-platform topics if available */}
        {data.singlePlatformTopics && data.singlePlatformTopics.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Trending Topics on Reddit</h2>
              <div className="text-sm text-muted-foreground">
                Analyzing {data.totalResults} results
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data.singlePlatformTopics.map((topic) => (
                <TopicCard
                  key={topic.topic}
                  topic={topic}
                  expandedTopic={expandedTopic}
                  setExpandedTopic={setExpandedTopic}
                  getTrendIcon={getTrendIcon}
                  getTrendLabel={getTrendLabel}
                />
              ))}
            </div>
          </>
        )}

        {/* If no topics at all */}
        {(!data.singlePlatformTopics || data.singlePlatformTopics.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No trending topics found</h3>
              <p className="text-muted-foreground max-w-md">
                Topics appear when similar keywords are discussed in multiple results.
                Keep monitoring to discover trends in your market.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Case 2: Pro/Team user but no cross-platform topics (show single-platform and AI topics)
  const hasAnyTopics = data && (
    data.topics.length > 0 ||
    data.singlePlatformTopics.length > 0 ||
    (data.aiTopics && data.aiTopics.length > 0)
  );

  if (!data || (!hasAnyTopics && data.topics.length === 0)) {
    // Check if they have single-platform topics or AI topics to show
    const topicsToShow = [
      ...(data?.singlePlatformTopics || []),
      ...(data?.aiTopics || []),
    ];

    if (topicsToShow.length > 0) {
      return (
        <div className="space-y-6">
          {/* Info banner */}
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <Network className="h-5 w-5 text-blue-500 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Cross-platform insights appear when similar topics are discussed across multiple platforms.
                Below are trending topics from your current data.
              </p>
            </CardContent>
          </Card>

          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(["7d", "30d", "90d"] as TimeRange[]).map((r) => (
                <Button
                  key={r}
                  variant={range === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRange(r)}
                >
                  {r === "7d" && "7 Days"}
                  {r === "30d" && "30 Days"}
                  {r === "90d" && "90 Days"}
                </Button>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Analyzing {data?.totalResults ?? 0} results from {data?.platformsInData?.length ?? 0} platform{(data?.platformsInData?.length ?? 0) !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Combined topics (single-platform + AI) */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Trending Topics
              {data?.aiTopics && data.aiTopics.length > 0 && (
                <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/50">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-Enhanced
                </Badge>
              )}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {topicsToShow.map((topic) => (
                <TopicCard
                  key={topic.topic}
                  topic={topic}
                  expandedTopic={expandedTopic}
                  setExpandedTopic={setExpandedTopic}
                  getTrendIcon={getTrendIcon}
                  getTrendLabel={getTrendLabel}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // No topics at all
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No insights yet</h3>
          <p className="text-muted-foreground max-w-md">
            Insights appear when you have monitored results to analyze.
            Keep monitoring to discover emerging trends in your market.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as TimeRange[]).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r)}
            >
              {r === "7d" && "7 Days"}
              {r === "30d" && "30 Days"}
              {r === "90d" && "90 Days"}
            </Button>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          Analyzing {data.totalResults} results
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Cross-Platform Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.topics.length}</div>
            <p className="text-xs text-muted-foreground">
              Topics appearing on multiple platforms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Rising Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.topics.filter((t) => t.trendDirection === "rising").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Gaining traction this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-500" />
              Platform Pairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.platformCorrelation.length}</div>
            <p className="text-xs text-muted-foreground">
              Platforms discussing same topics
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Topic Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Trending Cross-Platform Topics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.topics.map((topic) => (
            <TopicCard
              key={topic.topic}
              topic={topic}
              expandedTopic={expandedTopic}
              setExpandedTopic={setExpandedTopic}
              getTrendIcon={getTrendIcon}
              getTrendLabel={getTrendLabel}
            />
          ))}
        </div>
      </div>

      {/* AI-Generated Topics (when keyword clustering found few topics) */}
      {data.aiTopics && data.aiTopics.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI-Discovered Topics
          </h2>
          <p className="text-sm text-muted-foreground -mt-2">
            Additional themes identified by AI analysis
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.aiTopics.map((topic) => (
              <TopicCard
                key={topic.topic}
                topic={topic}
                expandedTopic={expandedTopic}
                setExpandedTopic={setExpandedTopic}
                getTrendIcon={getTrendIcon}
                getTrendLabel={getTrendLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* Platform Correlation */}
      {data.platformCorrelation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Correlation</CardTitle>
            <CardDescription>
              Which platforms discuss the same topics most often
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.platformCorrelation.slice(0, 5).map((correlation) => (
                <div
                  key={`${correlation.platform1}-${correlation.platform2}`}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn("text-white", PLATFORM_COLORS[correlation.platform1])}
                    >
                      {PLATFORM_LABELS[correlation.platform1] || correlation.platform1}
                    </Badge>
                    <span className="text-muted-foreground">+</span>
                    <Badge
                      className={cn("text-white", PLATFORM_COLORS[correlation.platform2])}
                    >
                      {PLATFORM_LABELS[correlation.platform2] || correlation.platform2}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {correlation.sharedTopics} shared{" "}
                    {correlation.sharedTopics === 1 ? "topic" : "topics"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
