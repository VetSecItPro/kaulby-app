"use client";

import type { PlanKey } from "@/lib/plans";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr-fetcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  ExternalLink,
  Sparkles,
  Network,
  Lock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Target,
  ShieldAlert,
  MessageSquareWarning,
  CircleDollarSign,
  Users,
  Wrench,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { track as trackClient } from "@/lib/analytics-client";

// ============================================================================
// TYPES
// ============================================================================

interface TopicCluster {
  topic: string;
  keywords: string[];
  platforms: string[];
  monitors: string[];
  results: {
    id: string;
    title: string;
    platform: string;
    sentiment: string | null;
    sourceUrl: string;
    createdAt: string;
    monitorName?: string;
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
  aiTopics: TopicCluster[];
  platformCorrelation: PlatformCorrelation[];
  totalResults: number;
  plan: PlanKey;
  canHaveMultiplePlatforms: boolean;
  platformsInData: string[];
}

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

interface PainPointsData {
  painPoints: PainPointGroup[];
  plan: string;
  totalResults: number;
}

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

interface RecommendationsData {
  recommendations: Recommendation[];
  plan: string;
  totalAnalyzed: number;
  requiresUpgrade?: boolean;
  message?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

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
  youtube: "bg-red-500",
  github: "bg-gray-700",
  g2: "bg-red-700",
  yelp: "bg-red-600",
  amazonreviews: "bg-amber-600",
  indiehackers: "bg-blue-600",
  hashnode: "bg-blue-700",
  x: "bg-gray-900",
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
  youtube: "YouTube",
  github: "GitHub",
  g2: "G2",
  yelp: "Yelp",
  amazonreviews: "Amazon Reviews",
  indiehackers: "Indie Hackers",
  hashnode: "Hashnode",
  x: "X (Twitter)",
};

const PRIORITY_CONFIG = {
  critical: { color: "bg-red-500 text-white", label: "Critical" },
  high: { color: "bg-orange-500 text-white", label: "High" },
  medium: { color: "bg-yellow-500 text-black", label: "Medium" },
  low: { color: "bg-blue-500 text-white", label: "Low" },
};

const EFFORT_LABELS: Record<string, string> = {
  quick_win: "Quick Win",
  moderate: "Moderate Effort",
  significant: "Significant Effort",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  negative_experience: <ShieldAlert className="h-5 w-5 text-red-500" />,
  support_need: <Wrench className="h-5 w-5 text-orange-500" />,
  pricing_concern: <CircleDollarSign className="h-5 w-5 text-yellow-500" />,
  competitor_mention: <Users className="h-5 w-5 text-blue-500" />,
  feature_request: <Lightbulb className="h-5 w-5 text-purple-500" />,
  general_discussion: <MessageSquareWarning className="h-5 w-5 text-gray-500" />,
};

const REC_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  customer_service: <Users className="h-5 w-5 text-blue-500" />,
  product: <Wrench className="h-5 w-5 text-purple-500" />,
  pricing: <CircleDollarSign className="h-5 w-5 text-yellow-500" />,
  reputation: <ShieldAlert className="h-5 w-5 text-red-500" />,
  competitive: <Target className="h-5 w-5 text-orange-500" />,
  documentation: <BookOpen className="h-5 w-5 text-green-500" />,
};

type TimeRange = "7d" | "30d" | "90d";
type InsightTab = "pain-points" | "recommendations" | "trending";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

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
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{topic.topic}</CardTitle>
              {topic.isAIGenerated && (
                <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/50">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
            {topic.monitors && topic.monitors.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {topic.monitors.slice(0, 3).map((monitorName) => (
                  <Button
                    key={monitorName}
                    variant="secondary"
                    size="sm"
                    className="h-5 px-2 text-xs font-medium text-black bg-gray-200 hover:bg-gray-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {monitorName}
                  </Button>
                ))}
                {topic.monitors.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{topic.monitors.length - 3} more
                  </span>
                )}
              </div>
            )}
            <CardDescription className="flex items-center gap-1">
              {getTrendIcon(topic.trendDirection)}
              <span>{getTrendLabel(topic.trendDirection)}</span>
            </CardDescription>
          </div>
          <Badge variant="secondary">{topic.results.length} mentions</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="flex flex-wrap gap-1">
          {topic.keywords.slice(0, 5).map((keyword) => (
            <Badge key={keyword} variant="outline" className="text-xs">
              {keyword}
            </Badge>
          ))}
        </div>
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

function PainPointCard({
  painPoint,
  expanded,
  onToggle,
}: {
  painPoint: PainPointGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "falling":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case "rising":
        return "Increasing";
      case "falling":
        return "Decreasing";
      default:
        return "Stable";
    }
  };

  const severityColor = painPoint.severity >= 4
    ? "border-red-500/40"
    : painPoint.severity >= 3
    ? "border-orange-500/30"
    : "border-yellow-500/20";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        expanded && "ring-2 ring-primary",
        severityColor
      )}
      onClick={onToggle}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {CATEGORY_ICONS[painPoint.category] || <AlertTriangle className="h-5 w-5 text-gray-500" />}
            <div>
              <CardTitle className="text-base">{painPoint.label}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {painPoint.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{painPoint.count} mentions</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Trend */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {getTrendIcon(painPoint.trend)}
          <span>{getTrendLabel(painPoint.trend)}</span>
        </div>

        {/* Platforms */}
        <div className="flex flex-wrap gap-1.5">
          {painPoint.platforms.map((platform) => (
            <Badge
              key={platform}
              className={cn("text-white text-xs", PLATFORM_COLORS[platform])}
            >
              {PLATFORM_LABELS[platform] || platform}
            </Badge>
          ))}
        </div>

        {/* Sentiment */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-600">
            {painPoint.sentimentBreakdown.positive} positive
          </span>
          <span className="text-red-600">
            {painPoint.sentimentBreakdown.negative} negative
          </span>
          <span className="text-gray-600">
            {painPoint.sentimentBreakdown.neutral} neutral
          </span>
        </div>

        {/* Keywords */}
        {painPoint.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {painPoint.keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        {/* Monitors */}
        {painPoint.monitors.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {painPoint.monitors.slice(0, 3).map((name) => (
              <Button
                key={name}
                variant="secondary"
                size="sm"
                className="h-5 px-2 text-xs font-medium text-black bg-gray-200 hover:bg-gray-300"
                onClick={(e) => e.stopPropagation()}
              >
                {name}
              </Button>
            ))}
            {painPoint.monitors.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{painPoint.monitors.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Expanded: Top mentions */}
        {expanded && painPoint.topMentions.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-sm font-medium">Recent Mentions</p>
            {painPoint.topMentions.map((mention) => (
              <a
                key={mention.id}
                href={mention.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Badge
                  className={cn(
                    "text-white text-xs shrink-0 mt-0.5",
                    PLATFORM_COLORS[mention.platform]
                  )}
                >
                  {PLATFORM_LABELS[mention.platform] || mention.platform}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="text-sm line-clamp-1">{mention.title}</span>
                  <span className="text-xs text-muted-foreground">
                    via {mention.monitorName}
                  </span>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  rec,
  expanded,
  onToggle,
}: {
  rec: Recommendation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const priority = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        expanded && "ring-2 ring-primary"
      )}
      onClick={onToggle}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {REC_CATEGORY_ICONS[rec.category] || <Target className="h-5 w-5 text-gray-500" />}
            <div>
              <CardTitle className="text-base">{rec.title}</CardTitle>
              <CardDescription className="text-sm mt-1">
                {rec.description}
              </CardDescription>
            </div>
          </div>
          <Badge className={cn("shrink-0", priority.color)}>
            {priority.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Impact & Effort */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{rec.impact}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {EFFORT_LABELS[rec.effort] || rec.effort}
          </Badge>
          <Badge variant="outline" className="text-xs capitalize">
            {rec.category.replace("_", " ")}
          </Badge>
        </div>

        {/* Expanded: Action steps */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <p className="text-sm font-medium">Action Steps</p>
            <div className="space-y-2">
              {rec.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">{i + 1}</span>
                  </div>
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
            {rec.relatedPainPoints.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">Related Pain Points:</p>
                <div className="flex flex-wrap gap-1">
                  {rec.relatedPainPoints.map((pp) => (
                    <Badge key={pp} variant="outline" className="text-xs capitalize">
                      {pp.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expand hint */}
        {!expanded && rec.actions.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            <span>{rec.actions.length} action steps - click to expand</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-60" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function InsightsView() {
  const [activeTab, setActiveTab] = useState<InsightTab>("pain-points");
  const [range, setRange] = useState<TimeRange>("30d");

  // Data fetching via SWR
  const { data: painPointsData, isLoading: painPointsLoading } = useSWR<PainPointsData>(
    `/api/insights/pain-points?range=${range}`,
    fetcher
  );

  const { data: recsData, isLoading: recsLoading } = useSWR<RecommendationsData>(
    activeTab === "recommendations" ? `/api/insights/recommendations?range=${range}` : null,
    fetcher
  );

  const { data: insightsData, isLoading: insightsLoading } = useSWR<InsightsData>(
    activeTab === "trending" ? `/api/insights?range=${range}` : null,
    fetcher
  );

  // UI states
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [expandedPainPoint, setExpandedPainPoint] = useState<string | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

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
              onClick={() => {
                setRange(r);
                // Analytics: engagement signal for insights time-range usage.
                trackClient("ui.insights_range_changed", { range: r });
              }}
            >
              {r === "7d" && "7 Days"}
              {r === "30d" && "30 Days"}
              {r === "90d" && "90 Days"}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as InsightTab);
          // Analytics: which insight views users actually explore (pain-points
          // is the default - recommendations/trending are the discovery paths).
          trackClient("ui.tab_switched", { pageSection: "insights", tabName: v });
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pain-points" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Pain Points</span>
            <span className="sm:hidden">Issues</span>
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Recommendations</span>
            <span className="sm:hidden">Actions</span>
          </TabsTrigger>
          <TabsTrigger value="trending" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Trending Topics</span>
            <span className="sm:hidden">Trends</span>
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB 1: PAIN POINTS                                               */}
        {/* ================================================================ */}
        <TabsContent value="pain-points" className="mt-6">
          {painPointsLoading ? (
            <InsightsSkeleton />
          ) : !painPointsData || painPointsData.painPoints.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pain points detected yet</h3>
                <p className="text-muted-foreground max-w-md">
                  Pain points are identified when AI analyzes your monitored mentions.
                  Keep monitoring to discover what users are complaining about.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid gap-4 md:grid-cols-3" aria-live="polite" role="status">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Total Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{painPointsData.painPoints.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Categories detected
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-red-500" />
                      Rising Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {painPointsData.painPoints.filter((p) => p.trend === "rising").length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Getting worse this week
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MessageSquareWarning className="h-4 w-4 text-orange-500" />
                      Total Mentions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{painPointsData.totalResults}</div>
                    <p className="text-xs text-muted-foreground">
                      Categorized mentions
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Pain point cards */}
              <div className="grid gap-4 md:grid-cols-2">
                {painPointsData.painPoints.map((pp) => (
                  <PainPointCard
                    key={pp.category}
                    painPoint={pp}
                    expanded={expandedPainPoint === pp.category}
                    onToggle={() =>
                      setExpandedPainPoint(
                        expandedPainPoint === pp.category ? null : pp.category
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 2: RECOMMENDATIONS                                           */}
        {/* ================================================================ */}
        <TabsContent value="recommendations" className="mt-6">
          {recsLoading ? (
            <InsightsSkeleton />
          ) : recsData?.requiresUpgrade ? (
            <Card className="border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-yellow-500/5">
              <CardContent className="flex flex-col md:flex-row items-center gap-6 py-8">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20">
                  <Lock className="h-8 w-8 text-amber-500" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-semibold mb-2">Get AI-Powered Action Plans</h3>
                  <p className="text-muted-foreground mb-4">
                    Get AI-powered action plans to fix what customers complain about
                    most. Prioritized recommendations with actionable steps to improve
                    your product, customer service, and reputation.
                  </p>
                  <Link href="/pricing">
                    <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                      <Zap className="h-4 w-4 mr-2" />
                      Upgrade to Pro
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : !recsData || recsData.recommendations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {recsData?.message || "No recommendations yet"}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Recommendations are generated from your pain point data.
                  Keep monitoring to collect enough mentions for AI analysis.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{recsData.recommendations.length}</div>
                    <p className="text-xs text-muted-foreground">AI-generated action items</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Critical/High
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {recsData.recommendations.filter(
                        (r) => r.priority === "critical" || r.priority === "high"
                      ).length}
                    </div>
                    <p className="text-xs text-muted-foreground">Urgent items to address</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-500" />
                      Quick Wins
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {recsData.recommendations.filter((r) => r.effort === "quick_win").length}
                    </div>
                    <p className="text-xs text-muted-foreground">Low effort, high impact</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendation cards */}
              <div className="space-y-4">
                {recsData.recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.title}
                    rec={rec}
                    expanded={expandedRec === rec.title}
                    onToggle={() =>
                      setExpandedRec(expandedRec === rec.title ? null : rec.title)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 3: TRENDING TOPICS                                           */}
        {/* ================================================================ */}
        <TabsContent value="trending" className="mt-6">
          {insightsLoading ? (
            <InsightsSkeleton />
          ) : !insightsData ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Loading trending topics...</h3>
                <p className="text-muted-foreground max-w-md">
                  Analyzing your monitored results for cross-platform trends.
                </p>
              </CardContent>
            </Card>
          ) : (
            <TrendingTopicsContent
              data={insightsData}
              expandedTopic={expandedTopic}
              setExpandedTopic={setExpandedTopic}
              getTrendIcon={getTrendIcon}
              getTrendLabel={getTrendLabel}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// TRENDING TOPICS TAB CONTENT (extracted from original)
// ============================================================================

function TrendingTopicsContent({
  data,
  expandedTopic,
  setExpandedTopic,
  getTrendIcon,
  getTrendLabel,
}: {
  data: InsightsData;
  expandedTopic: string | null;
  setExpandedTopic: (topic: string | null) => void;
  getTrendIcon: (direction: string) => React.ReactNode;
  getTrendLabel: (direction: string) => string;
}) {
  // Free user upgrade prompt
  if (!data.canHaveMultiplePlatforms) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-yellow-500/5">
          <CardContent className="flex flex-col md:flex-row items-center gap-6 py-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-semibold mb-2">See Pain Points Across All 16 Platforms</h3>
              <p className="text-muted-foreground mb-4">
                You&apos;re only seeing Reddit right now. Upgrade to Pro to discover
                pain points, competitor gaps, and buying signals across Hacker News,
                Product Hunt, Google Reviews, Trustpilot, and 12 more platforms.
              </p>
              <Link href="/pricing">
                <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

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

  // Combine all topics for stats
  const allTopics = [
    ...data.topics,
    ...(data.singlePlatformTopics || []),
    ...(data.aiTopics || []),
  ];

  if (allTopics.length === 0) {
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

  const risingCount = allTopics.filter((t) => t.trendDirection === "rising").length;
  const totalMentions = allTopics.reduce((sum, t) => sum + t.results.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Discovered Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allTopics.length}</div>
            <p className="text-xs text-muted-foreground">
              {data.topics.length > 0
                ? `${data.topics.length} cross-platform`
                : "From your monitored results"}
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
            <div className="text-2xl font-bold">{risingCount}</div>
            <p className="text-xs text-muted-foreground">Gaining traction this period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-500" />
              Total Mentions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMentions}</div>
            <p className="text-xs text-muted-foreground">
              Across {data.platformsInData.length} platform
              {data.platformsInData.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cross-platform topics */}
      {data.topics.length > 0 && (
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
      )}

      {/* Single-platform or AI topics */}
      {(data.singlePlatformTopics.length > 0 || (data.aiTopics && data.aiTopics.length > 0)) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {data.aiTopics && data.aiTopics.length > 0 ? (
              <>
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI-Enhanced Topics
              </>
            ) : (
              "Trending Topics"
            )}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[...(data.singlePlatformTopics || []), ...(data.aiTopics || [])].map((topic) => (
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
