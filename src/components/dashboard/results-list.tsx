"use client";

import { useState, useTransition, useMemo, useCallback, useEffect, useRef } from "react";
import { ResultCard, ResultsFilterBar } from "./result-card";
import { markAllResultsViewed } from "@/app/(dashboard)/dashboard/results/actions";
import { Loader2 } from "lucide-react";
import { SelectionToolbar } from "./selection-toolbar";
import {
  SavedViewsDropdown,
  SaveViewDialog,
  type SavedViewFilters,
} from "./saved-views-dropdown";

const PAGE_SIZE = 20;

type ConversationCategory = "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion";

interface Result {
  id: string;
  platform: "reddit" | "hackernews" | "producthunt" | "devto" | "googlereviews" | "trustpilot" | "appstore" | "playstore" | "quora" | "youtube" | "g2" | "yelp" | "amazonreviews" | "indiehackers" | "github" | "hashnode" | "x";
  sourceUrl: string;
  title: string;
  content: string | null;
  author: string | null;
  postedAt: Date | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  aiAnalyzed?: boolean | null;
  painPointCategory: string | null;
  conversationCategory: ConversationCategory | null;
  aiSummary: string | null;
  isViewed: boolean;
  isClicked: boolean;
  isSaved: boolean;
  isHidden: boolean;
  monitor: { name: string } | null;
}

interface ResultsListProps {
  results: Result[];
  hasUnlimitedAi?: boolean;
  /** Keywords to highlight in results */
  highlightKeywords?: string[];
  /** Whether user has export access (Pro+) */
  hasExportAccess?: boolean;
  /** Optional monitor ID for scoped export */
  exportMonitorId?: string;
}

export function ResultsList({ results, hasUnlimitedAi = true, highlightKeywords = [], hasExportAccess, exportMonitorId }: ResultsListProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "saved" | "hidden">("all");
  const [categoryFilter, setCategoryFilter] = useState<ConversationCategory | null>(null);
  const [isPending, startTransition] = useTransition();
  const [allMarkedRead, setAllMarkedRead] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  // Task 2.2: bulk selection state - a Set gives O(1) toggle on click.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saveViewOpen, setSaveViewOpen] = useState(false);

  // Memoize count calculations - only recalculate when results or allMarkedRead changes
  const { unviewedCount, savedCount, hiddenCount, totalCount, categoryCounts } = useMemo(() => {
    const visibleResults = results.filter((r) => !r.isHidden);

    // Calculate category counts from visible (non-hidden) results
    const counts: Record<ConversationCategory, number> = {
      pain_point: 0,
      solution_request: 0,
      advice_request: 0,
      money_talk: 0,
      hot_discussion: 0,
    };

    visibleResults.forEach((r) => {
      if (r.conversationCategory && counts[r.conversationCategory] !== undefined) {
        counts[r.conversationCategory]++;
      }
    });

    return {
      unviewedCount: results.filter((r) => !r.isViewed && !allMarkedRead && !r.isHidden).length,
      savedCount: results.filter((r) => r.isSaved && !r.isHidden).length,
      hiddenCount: results.filter((r) => r.isHidden).length,
      totalCount: visibleResults.length,
      categoryCounts: counts,
    };
  }, [results, allMarkedRead]);

  // Memoize filtered results - only recalculate when dependencies change
  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      // First apply status filter (all, unread, saved, hidden)
      let passesStatusFilter = false;
      switch (filter) {
        case "unread":
          passesStatusFilter = !result.isViewed && !allMarkedRead && !result.isHidden;
          break;
        case "saved":
          passesStatusFilter = result.isSaved && !result.isHidden;
          break;
        case "hidden":
          passesStatusFilter = result.isHidden;
          break;
        case "all":
        default:
          passesStatusFilter = !result.isHidden;
      }

      if (!passesStatusFilter) return false;

      // Then apply category filter if set
      if (categoryFilter) {
        return result.conversationCategory === categoryFilter;
      }

      return true;
    });
  }, [results, filter, categoryFilter, allMarkedRead]);

  // Memoize callback to prevent unnecessary re-renders of child components
  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      await markAllResultsViewed();
      setAllMarkedRead(true);
    });
  }, []);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    // Filter changes invalidate the current selection - ids that are no
    // longer visible shouldn't remain selected.
    setSelectedIds(new Set());
  }, [filter, categoryFilter]);

  // Task 2.2: selection handlers
  const handleSelectionChange = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleSelectionActionComplete = useCallback(() => {
    // Same-as-clear after a successful batch action; the server revalidates
    // the route so fresh state will flow down via RSC props.
    setSelectedIds(new Set());
  }, []);

  const totalFiltered = filteredResults.length;
  const displayedResults = filteredResults.slice(0, visibleCount);
  const hasMoreToShow = visibleCount < totalFiltered;

  // Task 2.2: Cmd/Ctrl+A selects all currently visible results; Escape clears.
  // Scoped to when there is at least one displayed result to avoid hijacking
  // the browser's select-all in empty states.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focus is in an input/textarea/contenteditable - users
      // typing in the search bar expect native select-all.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        const displayed = filteredResults.slice(0, visibleCount);
        if (displayed.length === 0) return;
        e.preventDefault();
        setSelectedIds(new Set(displayed.map((r) => r.id)));
      } else if (e.key === "Escape" && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredResults, visibleCount, selectedIds.size]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < totalFiltered) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, totalFiltered));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, totalFiltered]);

  // Task 2.2: apply a saved-view's filters. categoryFilter is typed on the
  // parent so we only accept the subset we know how to apply; other dimensions
  // (platform, sentiment, leadScoreMin) live in the parent view and are
  // ignored here until the parent wires them through.
  const handleApplySavedView = useCallback((filters: SavedViewFilters) => {
    if (filters.statusFilter) setFilter(filters.statusFilter);
    if (filters.categoryFilter !== undefined) {
      setCategoryFilter(
        (filters.categoryFilter as ConversationCategory | null) ?? null
      );
    }
  }, []);

  const currentFilters: SavedViewFilters = {
    statusFilter: filter,
    categoryFilter: categoryFilter ?? null,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <SavedViewsDropdown onApplyView={handleApplySavedView} />
      </div>

      <SelectionToolbar
        selectedIds={Array.from(selectedIds)}
        visibleCount={filteredResults.length}
        onActionComplete={handleSelectionActionComplete}
        onClear={handleClearSelection}
        onSaveView={() => setSaveViewOpen(true)}
        inHiddenView={filter === "hidden"}
      />

      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        filters={currentFilters}
      />

      <ResultsFilterBar
        totalCount={totalCount}
        unviewedCount={unviewedCount}
        savedCount={savedCount}
        hiddenCount={hiddenCount}
        filter={filter}
        onFilterChange={setFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categoryCounts={categoryCounts}
        onMarkAllRead={handleMarkAllRead}
        isPending={isPending}
        filteredCount={filteredResults.length}
        searchKeywords={highlightKeywords}
        hasExportAccess={hasExportAccess}
        exportMonitorId={exportMonitorId}
      />

      <div className="grid gap-4">
        {filteredResults.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="max-w-md mx-auto">
              {/* A11Y: Empty state for filtered results - FIX-323 */}
              <p className="text-lg font-medium text-muted-foreground mb-2">
                No results match your filters
              </p>
              <p className="text-sm text-muted-foreground">
                {categoryFilter && `Try clearing the "${categoryFilter.replace("_", " ")}" filter or `}
                {filter !== "all" && `switching to "All" results`}
              </p>
            </div>
          </div>
        ) : (
          <>
            {displayedResults.map((result, index) => (
              <ResultCard
                key={result.id}
                result={result}
                showHidden={filter === "hidden"}
                isAiBlurred={!hasUnlimitedAi && index > 0}
                highlightKeywords={highlightKeywords}
                selected={selectedIds.has(result.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}

            {/* Sentinel element for IntersectionObserver */}
            <div ref={loadMoreRef} className="h-1" />

            {/* Loading spinner while more results are being revealed */}
            {hasMoreToShow && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading more results...
                </span>
              </div>
            )}

            {/* End-of-list message */}
            {!hasMoreToShow && totalFiltered > PAGE_SIZE && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No more results
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
