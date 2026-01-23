"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Compass,
  TrendingUp,
  Sparkles,
  Search,
  Plus,
  ArrowRight,
  Flame,
  MessageSquare,
  Target,
  Zap,
  Lock,
} from "lucide-react";
import {
  SourceSuggestions,
  PlatformCoverage,
} from "./source-suggestions";
import { getPlatformDisplayName, getPlatformBadgeColor, platforms, type Platform } from "@/lib/platform-utils";
import { cn } from "@/lib/utils";

interface TrendingTopic {
  title: string;
  platform: string;
  engagement: number;
  category: string | null;
}

interface PlatformActivity {
  count: number;
  topTopics: string[];
}

interface DiscoverViewProps {
  activePlatforms: string[];
  keywords: string[];
  monitorCount: number;
  isPro: boolean;
  trendingData: {
    platformActivity: Record<string, PlatformActivity>;
    hotTopics: TrendingTopic[];
    totalTrending: number;
  };
}

/**
 * Keyword suggestion based on trending topics
 */
const SUGGESTED_KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  tech: ["AI", "startup", "SaaS", "developer", "API", "automation"],
  business: ["pricing", "competitor", "market", "growth", "funding"],
  product: ["feature", "bug", "UX", "feedback", "review"],
  marketing: ["brand", "content", "SEO", "social media", "ads"],
};

/**
 * Platform recommendation cards
 */
const PLATFORM_RECOMMENDATIONS: Record<Platform, {
  headline: string;
  description: string;
  bestFor: string;
  tip: string;
}> = {
  reddit: {
    headline: "The Front Page of the Internet",
    description: "Discover niche communities discussing your topics",
    bestFor: "Finding engaged audiences and honest feedback",
    tip: "Monitor specific subreddits related to your industry",
  },
  hackernews: {
    headline: "Tech Industry Pulse",
    description: "Where developers and founders share insights",
    bestFor: "Developer tools, SaaS, and tech products",
    tip: "Great for finding early adopters and technical users",
  },
  producthunt: {
    headline: "Product Launch Central",
    description: "Track competitor launches and market trends",
    bestFor: "Competitive intelligence and launch monitoring",
    tip: "Monitor your competitors' product launches",
  },
  googlereviews: {
    headline: "Local Business Intelligence",
    description: "Track what customers say about businesses",
    bestFor: "Local services, agencies, and B2B services",
    tip: "Monitor your business and competitors",
  },
  trustpilot: {
    headline: "Business Trust Signals",
    description: "Professional reviews and reputation tracking",
    bestFor: "B2B companies and e-commerce",
    tip: "Track competitor satisfaction scores",
  },
  appstore: {
    headline: "iOS App Feedback",
    description: "Direct user feedback on mobile apps",
    bestFor: "iOS apps and competitor app analysis",
    tip: "Monitor feature requests and bug reports",
  },
  playstore: {
    headline: "Android App Insights",
    description: "Android user reviews and ratings",
    bestFor: "Android apps and market research",
    tip: "Compare ratings with iOS versions",
  },
  quora: {
    headline: "Question & Answer Hub",
    description: "Where people ask genuine questions",
    bestFor: "Thought leadership and SEO content ideas",
    tip: "Find questions your product can answer",
  },
  youtube: {
    headline: "Video Comment Insights",
    description: "Track discussions in video comments",
    bestFor: "Consumer products, tech reviews, and tutorials",
    tip: "Monitor product review and tutorial video comments",
  },
  g2: {
    headline: "B2B Software Reviews",
    description: "Professional software comparison and reviews",
    bestFor: "SaaS products and competitor analysis",
    tip: "Track competitor feature gaps and user complaints",
  },
  yelp: {
    headline: "Local Business Reviews",
    description: "Customer feedback on local businesses",
    bestFor: "Restaurants, services, and retail businesses",
    tip: "Monitor reputation and competitor feedback",
  },
  amazonreviews: {
    headline: "E-commerce Product Reviews",
    description: "Customer feedback on Amazon products",
    bestFor: "E-commerce brands and product manufacturers",
    tip: "Track competitor products and feature requests",
  },
};

/**
 * Platform card for discovery
 */
function PlatformDiscoveryCard({
  platform,
  isActive,
  isPro,
  activity,
}: {
  platform: Platform;
  isActive: boolean;
  isPro: boolean;
  activity?: PlatformActivity;
}) {
  const isFree = platform === "reddit";
  const canAccess = isPro || isFree;
  const info = PLATFORM_RECOMMENDATIONS[platform];

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all hover:shadow-md flex flex-col h-full",
        isActive && "border-primary/50 bg-primary/5",
        !canAccess && "opacity-60"
      )}
    >
      {isActive && (
        <div className="absolute top-0 right-0 p-2">
          <Badge variant="default" className="text-[10px]">
            Active
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn("text-xs", getPlatformBadgeColor(platform, "light"))}
          >
            {getPlatformDisplayName(platform)}
          </Badge>
          {!canAccess && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Lock className="h-2.5 w-2.5" />
              Pro
            </Badge>
          )}
        </div>
        <CardTitle className="text-base mt-2">{info.headline}</CardTitle>
        <CardDescription className="text-sm">
          {info.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col flex-1">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Best for: </span>
          {info.bestFor}
        </div>

        {activity && activity.count > 0 && (
          <div className="flex items-center gap-2 text-xs mt-3">
            <Flame className="h-3 w-3 text-orange-500" />
            <span className="text-muted-foreground">
              {activity.count} trending posts this week
            </span>
          </div>
        )}

        <div className="mt-auto pt-4">
          {isActive ? (
            <Link href="/dashboard/results">
              <Button
                variant="outline"
                size="sm"
                className="bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
              >
                View Results
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          ) : canAccess ? (
            <Link href="/dashboard/monitors/new">
              <Button size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Start Monitoring
              </Button>
            </Link>
          ) : (
            <Link href="/pricing">
              <Button variant="outline" size="sm">
                <Lock className="h-3 w-3 mr-1" />
                Upgrade to Pro
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Trending topic card
 */
function TrendingTopicCard({ topic }: { topic: TrendingTopic }) {
  const categoryLabels: Record<string, string> = {
    solution_request: "Looking for solutions",
    pain_point: "Pain point",
    advice_request: "Seeking advice",
    money_talk: "Budget discussion",
    hot_discussion: "Hot topic",
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 shrink-0">
        <Flame className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-2">{topic.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant="secondary"
            className={cn("text-[10px]", getPlatformBadgeColor(topic.platform, "light"))}
          >
            {getPlatformDisplayName(topic.platform)}
          </Badge>
          {topic.category && (
            <span className="text-[10px] text-muted-foreground">
              {categoryLabels[topic.category] || topic.category}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {topic.engagement} engagement
          </span>
        </div>
      </div>
    </div>
  );
}

type TabValue = "platforms" | "trending" | "keywords";

/**
 * Main Discover View component
 */
export function DiscoverView({
  activePlatforms,
  keywords,
  monitorCount,
  isPro,
  trendingData,
}: DiscoverViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<TabValue>("platforms");

  // Filter platforms based on search
  const filteredPlatforms = useMemo(() => {
    if (!searchQuery) return platforms;
    const query = searchQuery.toLowerCase();
    return platforms.filter(
      (p) =>
        getPlatformDisplayName(p).toLowerCase().includes(query) ||
        PLATFORM_RECOMMENDATIONS[p].description.toLowerCase().includes(query) ||
        PLATFORM_RECOMMENDATIONS[p].bestFor.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Suggested keywords based on trending
  const suggestedKeywords = useMemo(() => {
    const suggestions = new Set<string>();

    // Add keywords from trending topics
    trendingData.hotTopics.forEach((topic) => {
      const words = topic.title.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (word.length > 4 && !keywords.includes(word)) {
          suggestions.add(word);
        }
      });
    });

    // Add category-based suggestions
    Object.values(SUGGESTED_KEYWORDS_BY_CATEGORY).flat().forEach((kw) => {
      if (!keywords.includes(kw.toLowerCase())) {
        suggestions.add(kw);
      }
    });

    return Array.from(suggestions).slice(0, 12);
  }, [trendingData.hotTopics, keywords]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Compass className="h-8 w-8 text-primary" />
          Discover
        </h1>
        <p className="text-muted-foreground mt-1">
          Expand your monitoring coverage and find new opportunities across all 12 platforms.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platforms Active</p>
                <p className="text-2xl font-bold">{activePlatforms.length}/12</p>
              </div>
              <Target className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Keywords Tracked</p>
                <p className="text-2xl font-bold">{keywords.length}</p>
              </div>
              <Search className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Monitors</p>
                <p className="text-2xl font-bold">{monitorCount}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trending Now</p>
                <p className="text-2xl font-bold">{trendingData.totalTrending}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Platform Coverage</CardTitle>
          <CardDescription>
            See which platforms you&apos;re monitoring and discover opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformCoverage activePlatforms={activePlatforms} isPro={isPro} />
        </CardContent>
      </Card>

      {/* Main Content with Tab Navigation */}
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b pb-4">
          <Button
            variant={selectedTab === "platforms" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedTab("platforms")}
            className="gap-1"
          >
            <Compass className="h-4 w-4" />
            Platforms
          </Button>
          <Button
            variant={selectedTab === "trending" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedTab("trending")}
            className="gap-1"
          >
            <Flame className="h-4 w-4" />
            Trending
          </Button>
          <Button
            variant={selectedTab === "keywords" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedTab("keywords")}
            className="gap-1"
          >
            <Sparkles className="h-4 w-4" />
            Keywords
          </Button>
        </div>

        {/* Platforms Tab Content */}
        {selectedTab === "platforms" && (
          <div className="space-y-6">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search platforms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Platform Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPlatforms.map((platform) => (
                <PlatformDiscoveryCard
                  key={platform}
                  platform={platform}
                  isActive={activePlatforms.includes(platform)}
                  isPro={isPro}
                  activity={trendingData.platformActivity[platform]}
                />
              ))}
            </div>

            {filteredPlatforms.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No platforms match your search.
              </div>
            )}
          </div>
        )}

        {/* Trending Tab Content */}
        {selectedTab === "trending" && (
          <div className="space-y-6">
            {trendingData.hotTopics.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Hot Topics This Week
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      High-engagement discussions across platforms
                    </p>
                  </div>
                  <Link href="/dashboard/results">
                    <Button variant="outline" size="sm">
                      View All Results
                    </Button>
                  </Link>
                </div>

                <div className="space-y-3">
                  {trendingData.hotTopics.map((topic, idx) => (
                    <TrendingTopicCard key={idx} topic={topic} />
                  ))}
                </div>
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Flame className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No trending data yet</h3>
                  <p className="text-muted-foreground max-w-md">
                    Start monitoring more platforms to see trending topics and hot discussions.
                  </p>
                  <Link href="/dashboard/monitors/new">
                    <Button className="mt-4">
                      <Plus className="h-4 w-4 mr-1" />
                      Create Monitor
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Keywords Tab Content */}
        {selectedTab === "keywords" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Suggested Keywords
              </h2>
              <p className="text-sm text-muted-foreground">
                Keywords you might want to track based on trending topics
              </p>
            </div>

            {/* Current Keywords */}
            {keywords.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Your Current Keywords</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                      <Badge key={kw} variant="secondary">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Keywords */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Try These Keywords
                </CardTitle>
                <CardDescription>
                  Click to add to your next monitor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {suggestedKeywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {kw}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Keyword Categories */}
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(SUGGESTED_KEYWORDS_BY_CATEGORY).map(([category, kws]) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium capitalize">
                      {category} Keywords
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {kws.map((kw) => (
                        <Badge
                          key={kw}
                          variant={keywords.includes(kw.toLowerCase()) ? "secondary" : "outline"}
                          className={cn(
                            "text-xs",
                            !keywords.includes(kw.toLowerCase()) && "cursor-pointer hover:bg-muted"
                          )}
                        >
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="flex items-center justify-between py-6">
                <div>
                  <h3 className="font-semibold">Ready to expand your monitoring?</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a new monitor with these keywords
                  </p>
                </div>
                <Link href="/dashboard/monitors/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-1" />
                    New Monitor
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Smart Suggestions */}
      <SourceSuggestions
        currentPlatforms={activePlatforms}
        keywords={keywords}
        isPro={isPro}
      />
    </div>
  );
}
