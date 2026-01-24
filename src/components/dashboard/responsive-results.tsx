"use client";

import { useState, useMemo, useCallback } from "react";
import { MobileResults } from "@/components/mobile/mobile-results";
import { ResultsList } from "./results-list";
import { ResultsSidebar } from "./results-sidebar";
import { ThemesPanel } from "./themes-panel";
import { DateRangePicker } from "./date-range-picker";
import { SearchInputWithHelp } from "./search-help-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HiddenResultsBanner, RefreshDelayBanner } from "./upgrade-prompt";
import { EmptyState, ScanningState } from "./empty-states";
import { Download, Lock, SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Link from "next/link";
import type { PlanKey } from "@/lib/plans";
import { parseSearchQuery, matchesQuery } from "@/lib/search-parser";

type ConversationCategory = "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion";

interface Result {
  id: string;
  platform: "reddit" | "hackernews" | "producthunt" | "devto" | "googlereviews" | "trustpilot" | "appstore" | "playstore" | "quora" | "youtube" | "g2" | "yelp" | "amazonreviews" | "indiehackers" | "github" | "hashnode";
  sourceUrl: string;
  title: string;
  content: string | null;
  author: string | null;
  postedAt: Date | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  painPointCategory: string | null;
  conversationCategory: ConversationCategory | null;
  aiSummary: string | null;
  isViewed: boolean;
  isClicked: boolean;
  isSaved: boolean;
  isHidden: boolean;
  monitor: { name: string; keywords?: string[] } | null;
}

interface PlanInfo {
  plan: PlanKey;
  visibleLimit: number;
  isLimited: boolean;
  hiddenCount: number;
  hasUnlimitedAi: boolean;
  refreshDelayHours: number;
  nextRefreshAt: Date | null;
}

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface ResponsiveResultsProps {
  results: Result[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMonitors: boolean;
  planInfo?: PlanInfo;
}

// CSS-based responsive - renders both layouts, CSS handles visibility
// This prevents hydration mismatch from JS device detection
export function ResponsiveResults({
  results,
  totalCount,
  page,
  totalPages,
  hasMonitors,
  planInfo,
}: ResponsiveResultsProps) {
  // Filter results based on visibility limit for free tier
  const visibleResults = planInfo?.isLimited
    ? results.slice(0, planInfo.visibleLimit)
    : results;

  return (
    <>
      {/* Mobile/Tablet view - hidden on lg and above */}
      <div className="lg:hidden">
        <MobileResultsView
          results={results}
          visibleResults={visibleResults}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          hasMonitors={hasMonitors}
          planInfo={planInfo}
        />
      </div>

      {/* Desktop view - hidden below lg */}
      <div className="hidden lg:block">
        <DesktopResultsView
          results={results}
          visibleResults={visibleResults}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          hasMonitors={hasMonitors}
          planInfo={planInfo}
        />
      </div>
    </>
  );
}

interface ViewProps {
  results: Result[];
  visibleResults: Result[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMonitors: boolean;
  planInfo?: PlanInfo;
}

function MobileResultsView({
  results,
  visibleResults,
  page,
  totalPages,
  hasMonitors,
  planInfo,
}: ViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null);

  // Apply filters
  const filteredResults = useMemo(() => {
    return visibleResults.filter((result) => {
      // Platform filter
      if (selectedPlatform && result.platform !== selectedPlatform) return false;

      // Sentiment filter
      if (selectedSentiment && result.sentiment !== selectedSentiment) return false;

      // Search query filter
      if (searchQuery) {
        const parsed = parseSearchQuery(searchQuery);
        const match = matchesQuery(
          {
            title: result.title,
            body: result.content || undefined,
            author: result.author || undefined,
          },
          parsed
        );
        if (!match.matches) return false;
      }

      return true;
    });
  }, [visibleResults, selectedPlatform, selectedSentiment, searchQuery]);

  if (results.length === 0 && !hasMonitors) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="text-muted-foreground text-sm">Mentions found by your monitors</p>
        </div>
        <EmptyState
          type="monitors"
          title="No results yet"
          description="Create a monitor to start tracking mentions across the web."
        />
      </div>
    );
  }

  const hasFilters = selectedPlatform || selectedSentiment || searchQuery;

  return (
    <div className="space-y-4">
      {/* Mobile Header with Search & Filter Button */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchInputWithHelp
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search results..."
            className="w-full"
          />
        </div>
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <SlidersHorizontal className="h-4 w-4" />
              {hasFilters && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <ResultsSidebar
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
              selectedSentiment={selectedSentiment}
              onSentimentChange={setSelectedSentiment}
              className="border-0"
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filters Display */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedPlatform && (
            <Badge variant="secondary" className="gap-1">
              {selectedPlatform}
              <button onClick={() => setSelectedPlatform(null)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedSentiment && (
            <Badge variant="secondary" className="gap-1">
              {selectedSentiment}
              <button onClick={() => setSelectedSentiment(null)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              &quot;{searchQuery}&quot;
              <button onClick={() => setSearchQuery("")}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      <MobileResults
        results={filteredResults}
        totalCount={filteredResults.length}
        page={page}
        totalPages={totalPages}
        planInfo={planInfo}
      />
    </div>
  );
}

function DesktopResultsView({
  results,
  visibleResults,
  totalCount,
  page,
  totalPages,
  hasMonitors,
  planInfo,
}: ViewProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // Filter state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState<{ min: number; max: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ConversationCategory | null>(null);

  const canExport = planInfo?.plan === "pro" || planInfo?.plan === "enterprise";

  // Extract keywords from all monitors for highlighting
  const allKeywords = useMemo(() => {
    const keywords = new Set<string>();
    visibleResults.forEach((r) => {
      r.monitor?.keywords?.forEach((k) => keywords.add(k));
    });
    // Also add search query terms
    if (searchQuery) {
      const parsed = parseSearchQuery(searchQuery);
      parsed.required.forEach((t) => keywords.add(t.term));
      parsed.optional.forEach((t) => keywords.add(t.term));
    }
    return Array.from(keywords);
  }, [visibleResults, searchQuery]);

  // Calculate category counts for themes panel
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      pain_point: 0,
      solution_request: 0,
      advice_request: 0,
      money_talk: 0,
      hot_discussion: 0,
    };
    visibleResults.forEach((r) => {
      if (r.conversationCategory && !r.isHidden) {
        counts[r.conversationCategory] = (counts[r.conversationCategory] || 0) + 1;
      }
    });
    return counts;
  }, [visibleResults]);

  // Apply all filters
  const filteredResults = useMemo(() => {
    return visibleResults.filter((result) => {
      // Platform filter
      if (selectedPlatform && result.platform !== selectedPlatform) return false;

      // Community filter (extract from sourceUrl)
      if (selectedCommunity) {
        const [platform, community] = selectedCommunity.split(":");
        if (result.platform !== platform) return false;
        // Check if sourceUrl contains the community
        if (!result.sourceUrl.toLowerCase().includes(community.toLowerCase())) return false;
      }

      // Sentiment filter
      if (selectedSentiment && result.sentiment !== selectedSentiment) return false;

      // Category filter
      if (selectedCategory && result.conversationCategory !== selectedCategory) return false;

      // Engagement filter
      if (selectedEngagement) {
        const engagement = 0; // We don't have engagementScore in the current result type
        if (engagement < selectedEngagement.min || engagement > selectedEngagement.max) return false;
      }

      // Date range filter
      if (dateRange && result.postedAt) {
        const postedAt = new Date(result.postedAt);
        if (dateRange.from && postedAt < dateRange.from) return false;
        if (dateRange.to && postedAt > dateRange.to) return false;
      }

      // Search query filter
      if (searchQuery) {
        const parsed = parseSearchQuery(searchQuery);
        const match = matchesQuery(
          {
            title: result.title,
            body: result.content || undefined,
            author: result.author || undefined,
          },
          parsed
        );
        if (!match.matches) return false;
      }

      return true;
    });
  }, [
    visibleResults,
    selectedPlatform,
    selectedCommunity,
    selectedSentiment,
    selectedCategory,
    selectedEngagement,
    dateRange,
    searchQuery,
  ]);

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/results/export");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kaulby-results-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearFilters = useCallback(() => {
    setSelectedPlatform(null);
    setSelectedCommunity(null);
    setSelectedSentiment(null);
    setSelectedEngagement(null);
    setSelectedCategory(null);
    setDateRange(null);
    setSearchQuery("");
  }, []);

  const hasActiveFilters =
    selectedPlatform ||
    selectedCommunity ||
    selectedSentiment ||
    selectedEngagement ||
    selectedCategory ||
    dateRange ||
    searchQuery;

  // Get sample results for themes panel preview
  const sampleResults = useMemo(() => {
    return visibleResults.filter((r) => r.conversationCategory).slice(0, 10);
  }, [visibleResults]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            Mentions and discussions found by your monitors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <Badge variant="outline" className="text-sm">
              {filteredResults.length !== totalCount
                ? `${filteredResults.length} of ${totalCount} results`
                : `${totalCount} total results`}
            </Badge>
          )}
          {totalCount > 0 && (
            canExport ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="gap-2">
                <Lock className="h-4 w-4" />
                Export (Pro)
              </Button>
            )
          )}
        </div>
      </div>

      {/* Refresh Delay Banner */}
      {planInfo && planInfo.refreshDelayHours > 0 && (
        <RefreshDelayBanner
          delayHours={planInfo.refreshDelayHours}
          nextRefreshAt={planInfo.nextRefreshAt}
          subscriptionStatus={planInfo.plan}
        />
      )}

      {/* Search & Filter Bar */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Search and Date Range Row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-md">
              <SearchInputWithHelp
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search results... (try: title:bug OR &quot;pricing feedback&quot;)"
              />
            </div>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showSidebar ? "Hide Filters" : "Show Filters"}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Themes Panel - Quick Category Filters */}
          <ThemesPanel
            categoryCounts={categoryCounts}
            sampleResults={sampleResults}
            selectedCategory={selectedCategory}
            onCategoryClick={setSelectedCategory}
            variant="tabs"
          />
        </div>
      )}

      {/* Main Content */}
      {results.length === 0 && !hasMonitors ? (
        <EmptyState
          type="monitors"
          title="No results yet"
          description="Create a monitor to start tracking mentions across the web."
        />
      ) : results.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="p-0">
            <ScanningState />
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar */}
          {showSidebar && (
            <aside className="w-64 flex-shrink-0">
              <div className="sticky top-4">
                <Card>
                  <ResultsSidebar
                    selectedPlatform={selectedPlatform}
                    onPlatformChange={setSelectedPlatform}
                    selectedCommunity={selectedCommunity}
                    onCommunityChange={setSelectedCommunity}
                    selectedSentiment={selectedSentiment}
                    onSentimentChange={setSelectedSentiment}
                    selectedEngagement={selectedEngagement}
                    onEngagementChange={setSelectedEngagement}
                    dateFrom={dateRange?.from?.toISOString()}
                    dateTo={dateRange?.to?.toISOString()}
                  />
                </Card>
              </div>
            </aside>
          )}

          {/* Results */}
          <div className="flex-1 min-w-0 space-y-4">
            {filteredResults.length === 0 && hasActiveFilters ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No results match your current filters.
                </p>
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              </Card>
            ) : (
              <>
                <ResultsList
                  results={filteredResults}
                  hasUnlimitedAi={planInfo?.hasUnlimitedAi ?? true}
                  highlightKeywords={allKeywords}
                />

                {/* Hidden Results Banner (after visible results, before pagination) */}
                {planInfo && planInfo.hiddenCount > 0 && (
                  <HiddenResultsBanner
                    hiddenCount={planInfo.hiddenCount}
                    totalCount={totalCount}
                  />
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2">
                    {page > 1 && (
                      <Link href={`/dashboard/results?page=${page - 1}`}>
                        <Button variant="outline">Previous</Button>
                      </Link>
                    )}
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages && (
                      <Link href={`/dashboard/results?page=${page + 1}`}>
                        <Button variant="outline">Next</Button>
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
