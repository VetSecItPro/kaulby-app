"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { ResultsList } from "./results-list";
import { ResultsSidebar } from "./results-sidebar";
import { DateRangePicker } from "./date-range-picker";
import { SearchInputWithHelp } from "./search-help-tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HiddenResultsBanner, RefreshDelayBanner } from "./upgrade-prompt";
import { EmptyState, ScanningState } from "./empty-states";
import { Download, Lock, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useInfiniteResults } from "@/hooks/use-infinite-results";
import type { Result } from "@/hooks/use-infinite-results";

const MobileResults = dynamic(() => import("@/components/mobile/mobile-results").then(m => m.MobileResults), { ssr: false });
const ThemesPanel = dynamic(() => import("./themes-panel").then(m => m.ThemesPanel), { ssr: false });
const SavedSearches = dynamic(() => import("./saved-searches").then(m => m.SavedSearches), { ssr: false });
const SearchBuilder = dynamic(() => import("./search-builder").then(m => m.SearchBuilder), { ssr: false });
import type { PlanKey } from "@/lib/plans";
import { parseSearchQuery, matchesQuery } from "@/lib/search-parser";

type ConversationCategory = "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion";

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

// Renders both layouts on SSR to avoid hydration mismatch,
// then after mount switches to rendering only the active one.
export function ResponsiveResults({
  results,
  totalCount,
  page,
  totalPages,
  hasMonitors,
  planInfo,
}: ResponsiveResultsProps) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    setMounted(true);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Filter results based on visibility limit for free tier
  const visibleResults = planInfo?.isLimited
    ? results.slice(0, planInfo.visibleLimit)
    : results;

  const sharedProps = {
    results,
    visibleResults,
    totalCount,
    page,
    totalPages,
    hasMonitors,
    planInfo,
  };

  // SSR + first paint: render both with CSS visibility (prevents hydration mismatch)
  if (!mounted) {
    return (
      <>
        {/* Mobile/Tablet view - hidden on lg and above */}
        <div className="lg:hidden">
          <MobileResultsView {...sharedProps} />
        </div>

        {/* Desktop view - hidden below lg */}
        <div className="hidden lg:block">
          <DesktopResultsView {...sharedProps} />
        </div>
      </>
    );
  }

  // After mount: render only the active layout
  return isDesktop
    ? <DesktopResultsView {...sharedProps} />
    : <MobileResultsView {...sharedProps} />;
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

  // Infinite scroll via shared hook
  const { allResults, loadMoreRef, hasMore, loadingMore } = useInfiniteResults({
    visibleResults,
    totalPages,
  });

  // Apply filters
  const filteredResults = useMemo(() => {
    return allResults.filter((result) => {
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
  }, [allResults, selectedPlatform, selectedSentiment, searchQuery]);

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
            <Button variant="outline" size="icon" className="relative" aria-label="Open filters">
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
              <button onClick={() => setSelectedPlatform(null)} aria-label={`Remove ${selectedPlatform} filter`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedSentiment && (
            <Badge variant="secondary" className="gap-1">
              {selectedSentiment}
              <button onClick={() => setSelectedSentiment(null)} aria-label={`Remove ${selectedSentiment} filter`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              &quot;{searchQuery}&quot;
              <button onClick={() => setSearchQuery("")} aria-label="Remove search filter">
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

      {/* Infinite scroll sentinel */}
      <div ref={loadMoreRef} className="h-1" />
      {hasMore && (
        <div className="flex items-center justify-center py-6 pb-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading more results...
          </span>
        </div>
      )}
      {!hasMore && allResults.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No more results
        </p>
      )}
    </div>
  );
}

function DesktopResultsView(props: ViewProps) {
  const { results, visibleResults, totalCount, totalPages, hasMonitors, planInfo } = props;
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

  // Infinite scroll via shared hook
  const { allResults, loadMoreRef, hasMore } = useInfiniteResults({
    visibleResults,
    totalPages,
  });

  const canExport = planInfo?.plan === "pro" || planInfo?.plan === "team";

  // Extract keywords from all monitors for highlighting
  const allKeywords = useMemo(() => {
    const keywords = new Set<string>();
    allResults.forEach((r) => {
      r.monitor?.keywords?.forEach((k) => keywords.add(k));
    });
    // Also add search query terms
    if (searchQuery) {
      const parsed = parseSearchQuery(searchQuery);
      parsed.required.forEach((t) => keywords.add(t.term));
      parsed.optional.forEach((t) => keywords.add(t.term));
    }
    return Array.from(keywords);
  }, [allResults, searchQuery]);

  // Calculate category counts for themes panel
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      pain_point: 0,
      solution_request: 0,
      advice_request: 0,
      money_talk: 0,
      hot_discussion: 0,
    };
    allResults.forEach((r) => {
      if (r.conversationCategory && !r.isHidden) {
        counts[r.conversationCategory] = (counts[r.conversationCategory] || 0) + 1;
      }
    });
    return counts;
  }, [allResults]);

  // Apply all filters
  const filteredResults = useMemo(() => {
    return allResults.filter((result) => {
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
    allResults,
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
        try {
          const a = document.createElement("a");
          a.href = url;
          a.download = `kaulby-results-${new Date().toISOString().split("T")[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } finally {
          window.URL.revokeObjectURL(url);
        }
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
    return allResults.filter((r) => r.conversationCategory).slice(0, 10);
  }, [allResults]);

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
            <SearchBuilder onApply={setSearchQuery} />
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
            <SavedSearches
              currentQuery={searchQuery}
              currentFilters={{
                platforms: selectedPlatform ? [selectedPlatform] : undefined,
                sentiments: selectedSentiment ? [selectedSentiment] : undefined,
                categories: selectedCategory ? [selectedCategory] : undefined,
              }}
              onSelectSearch={(query, filters) => {
                setSearchQuery(query);
                if (filters) {
                  if (filters.platforms?.length) {
                    setSelectedPlatform(filters.platforms[0]);
                  } else {
                    setSelectedPlatform(null);
                  }
                  if (filters.sentiments?.length) {
                    setSelectedSentiment(filters.sentiments[0]);
                  } else {
                    setSelectedSentiment(null);
                  }
                  if (filters.categories?.length) {
                    setSelectedCategory(filters.categories[0] as ConversationCategory);
                  } else {
                    setSelectedCategory(null);
                  }
                }
              }}
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
                  hasExportAccess={canExport}
                />

                {/* Hidden Results Banner (after visible results, before pagination) */}
                {planInfo && planInfo.hiddenCount > 0 && (
                  <HiddenResultsBanner
                    hiddenCount={planInfo.hiddenCount}
                    totalCount={totalCount}
                  />
                )}

                {/* Infinite scroll sentinel */}
                <div ref={loadMoreRef} className="h-1" />
                {hasMore && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Loading more results...
                    </span>
                  </div>
                )}
                {!hasMore && allResults.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground pt-4">
                    No more results
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
