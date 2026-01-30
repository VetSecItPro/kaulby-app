"use client";

import { useState, useEffect, memo } from "react";
import { ChevronDown, ChevronRight, MessageSquare, Globe, Smile, BarChart3, Loader2, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
/**
 * Results Sidebar - GummySearch-style filtering sidebar
 *
 * Shows:
 * - Platform breakdown with counts
 * - Community/subreddit breakdown
 * - Sentiment distribution
 * - Engagement histogram
 */

// Platform display configuration
const platformConfig: Record<string, { label: string; color: string }> = {
  reddit: { label: "Reddit", color: "bg-orange-500" },
  hackernews: { label: "Hacker News", color: "bg-orange-600" },
  producthunt: { label: "Product Hunt", color: "bg-red-500" },
  devto: { label: "Dev.to", color: "bg-gray-800 dark:bg-gray-200" },
  googlereviews: { label: "Google Reviews", color: "bg-blue-500" },
  trustpilot: { label: "Trustpilot", color: "bg-green-500" },
  appstore: { label: "App Store", color: "bg-blue-600" },
  playstore: { label: "Play Store", color: "bg-green-600" },
  quora: { label: "Quora", color: "bg-red-600" },
};

// Sentiment display configuration
const sentimentConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  positive: { label: "Positive", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500" },
  negative: { label: "Negative", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500" },
  neutral: { label: "Neutral", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-500" },
};

interface AggregationsData {
  total: number;
  platforms: { platform: string; count: number }[];
  communities: { platform: string; community: string; count: number }[];
  categories: { category: string; count: number }[];
  sentiments: { sentiment: string; count: number }[];
  engagement: { label: string; min: number; max: number; count: number }[];
}

interface ResultsSidebarProps {
  /** Monitor ID to filter by (optional) */
  monitorId?: string;
  /** Date range start (ISO string) */
  dateFrom?: string;
  /** Date range end (ISO string) */
  dateTo?: string;
  /** Currently selected platform filter */
  selectedPlatform?: string | null;
  /** Called when platform filter changes */
  onPlatformChange?: (platform: string | null) => void;
  /** Currently selected community filter */
  selectedCommunity?: string | null;
  /** Called when community filter changes */
  onCommunityChange?: (community: string | null) => void;
  /** Currently selected sentiment filter */
  selectedSentiment?: string | null;
  /** Called when sentiment filter changes */
  onSentimentChange?: (sentiment: string | null) => void;
  /** Currently selected engagement range */
  selectedEngagement?: { min: number; max: number } | null;
  /** Called when engagement filter changes */
  onEngagementChange?: (range: { min: number; max: number } | null) => void;
  /** Additional CSS classes */
  className?: string;
}

export const ResultsSidebar = memo(function ResultsSidebar({
  monitorId,
  dateFrom,
  dateTo,
  selectedPlatform,
  onPlatformChange,
  selectedCommunity,
  onCommunityChange,
  selectedSentiment,
  onSentimentChange,
  selectedEngagement,
  onEngagementChange,
  className,
}: ResultsSidebarProps) {
  const [data, setData] = useState<AggregationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section collapse state
  const [platformsOpen, setPlatformsOpen] = useState(true);
  const [communitiesOpen, setCommunitiesOpen] = useState(true);
  const [sentimentsOpen, setSentimentsOpen] = useState(true);
  const [engagementOpen, setEngagementOpen] = useState(true);

  // Track which platforms have expanded community lists
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});

  // Fetch aggregations data
  useEffect(() => {
    async function fetchAggregations() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (monitorId) params.set("monitorId", monitorId);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(`/api/results/aggregations?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch aggregations");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAggregations();
  }, [monitorId, dateFrom, dateTo]);

  // Group communities by platform
  const communitiesByPlatform = data?.communities.reduce(
    (acc, c) => {
      if (!acc[c.platform]) {
        acc[c.platform] = [];
      }
      acc[c.platform].push(c);
      return acc;
    },
    {} as Record<string, typeof data.communities>
  );

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 text-sm text-destructive", className)}>
        {error}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        No results to filter
      </div>
    );
  }

  const hasActiveFilters =
    selectedPlatform || selectedCommunity || selectedSentiment || selectedEngagement;

  return (
    <div className={cn("h-full overflow-auto", className)}>
      <div className="space-y-4 p-4">
        {/* Header with total and clear filters */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            <span className="text-lg font-bold">{data.total}</span>
            <span className="text-muted-foreground ml-1">results</span>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onPlatformChange?.(null);
                onCommunityChange?.(null);
                onSentimentChange?.(null);
                onEngagementChange?.(null);
              }}
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Platform Section */}
        <Collapsible open={platformsOpen} onOpenChange={setPlatformsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-8">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="text-sm font-medium">Platforms</span>
              </div>
              {platformsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {data.platforms.map(({ platform, count }) => {
              const config = platformConfig[platform] || { label: platform, color: "bg-gray-500" };
              const isSelected = selectedPlatform === platform;

              return (
                <button
                  key={platform}
                  onClick={() => onPlatformChange?.(isSelected ? null : platform)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.color)} />
                    <span>{config.label}</span>
                  </div>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </CollapsibleContent>
        </Collapsible>

        {/* Communities Section */}
        {communitiesByPlatform && Object.keys(communitiesByPlatform).length > 0 && (
          <Collapsible open={communitiesOpen} onOpenChange={setCommunitiesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-8">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm font-medium">Communities</span>
                </div>
                {communitiesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2">
              {Object.entries(communitiesByPlatform).map(([platform, communities]) => {
                const platformLabel = platformConfig[platform]?.label || platform;
                const isExpanded = expandedPlatforms[platform] || false;
                // Show top 5 communities per platform, or all if expanded
                const visibleCommunities = isExpanded ? communities : communities.slice(0, 5);
                const hasMore = communities.length > 5;

                return (
                  <div key={platform} className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2">
                      {platformLabel}
                    </div>
                    {visibleCommunities.map(({ community, count }) => {
                      const isSelected = selectedCommunity === `${platform}:${community}`;

                      return (
                        <button
                          key={`${platform}:${community}`}
                          onClick={() =>
                            onCommunityChange?.(
                              isSelected ? null : `${platform}:${community}`
                            )
                          }
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          <span className="truncate">{community}</span>
                          <Badge variant="secondary" className="h-5 px-1.5 text-xs flex-shrink-0">
                            {count}
                          </Badge>
                        </button>
                      );
                    })}
                    {hasMore && (
                      <button
                        onClick={() =>
                          setExpandedPlatforms((prev) => ({
                            ...prev,
                            [platform]: !prev[platform],
                          }))
                        }
                        className="w-full flex items-center gap-1 px-2 py-1 text-xs text-teal-500 hover:text-teal-600 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Show {communities.length - 5} more
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Sentiment Section */}
        {data.sentiments.length > 0 && (
          <Collapsible open={sentimentsOpen} onOpenChange={setSentimentsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-8">
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4" />
                  <span className="text-sm font-medium">Sentiment</span>
                </div>
                {sentimentsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {data.sentiments.map(({ sentiment, count }) => {
                const config = sentimentConfig[sentiment] || {
                  label: sentiment,
                  color: "text-gray-600",
                  bgColor: "bg-gray-500",
                };
                const isSelected = selectedSentiment === sentiment;
                const percentage = Math.round((count / data.total) * 100);

                return (
                  <button
                    key={sentiment}
                    onClick={() => onSentimentChange?.(isSelected ? null : sentiment)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", config.bgColor)} />
                      <span className={config.color}>{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {count}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Engagement Section */}
        {data.engagement.length > 0 && (
          <Collapsible open={engagementOpen} onOpenChange={setEngagementOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-8">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-medium">Engagement</span>
                </div>
                {engagementOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {data.engagement.map(({ label, min, max, count }) => {
                const isSelected =
                  selectedEngagement?.min === min && selectedEngagement?.max === max;

                return (
                  <button
                    key={label}
                    onClick={() =>
                      onEngagementChange?.(isSelected ? null : { min, max })
                    }
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <span>{label}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
});
