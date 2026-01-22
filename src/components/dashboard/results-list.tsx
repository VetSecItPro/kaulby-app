"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { ResultCard, ResultsFilterBar } from "./result-card";
import { markAllResultsViewed } from "@/app/(dashboard)/dashboard/results/actions";

type ConversationCategory = "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion";

interface Result {
  id: string;
  platform: "reddit" | "hackernews" | "producthunt" | "devto" | "twitter" | "googlereviews" | "trustpilot" | "appstore" | "playstore" | "quora";
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
  monitor: { name: string } | null;
}

interface ResultsListProps {
  results: Result[];
  hasUnlimitedAi?: boolean;
  /** Keywords to highlight in results */
  highlightKeywords?: string[];
}

export function ResultsList({ results, hasUnlimitedAi = true, highlightKeywords = [] }: ResultsListProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "saved" | "hidden">("all");
  const [categoryFilter, setCategoryFilter] = useState<ConversationCategory | null>(null);
  const [isPending, startTransition] = useTransition();
  const [allMarkedRead, setAllMarkedRead] = useState(false);

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

  return (
    <div className="space-y-4">
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
      />

      <div className="grid gap-4">
        {filteredResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {categoryFilter && `No ${categoryFilter.replace("_", " ")} results`}
            {!categoryFilter && filter === "unread" && "No unread results"}
            {!categoryFilter && filter === "saved" && "No saved results"}
            {!categoryFilter && filter === "hidden" && "No hidden results"}
            {!categoryFilter && filter === "all" && "No results found"}
          </div>
        ) : (
          filteredResults.map((result, index) => (
            <ResultCard
              key={result.id}
              result={result}
              showHidden={filter === "hidden"}
              isAiBlurred={!hasUnlimitedAi && index > 0}
              highlightKeywords={highlightKeywords}
            />
          ))
        )}
      </div>
    </div>
  );
}
