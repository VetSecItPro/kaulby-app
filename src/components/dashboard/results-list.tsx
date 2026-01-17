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
}

export function ResultsList({ results, hasUnlimitedAi = true }: ResultsListProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "saved" | "hidden">("all");
  const [isPending, startTransition] = useTransition();
  const [allMarkedRead, setAllMarkedRead] = useState(false);

  // Memoize count calculations - only recalculate when results or allMarkedRead changes
  const { unviewedCount, savedCount, hiddenCount, totalCount } = useMemo(() => ({
    unviewedCount: results.filter((r) => !r.isViewed && !allMarkedRead).length,
    savedCount: results.filter((r) => r.isSaved).length,
    hiddenCount: results.filter((r) => r.isHidden).length,
    totalCount: results.filter((r) => !r.isHidden).length,
  }), [results, allMarkedRead]);

  // Memoize filtered results - only recalculate when dependencies change
  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      switch (filter) {
        case "unread":
          return !result.isViewed && !allMarkedRead && !result.isHidden;
        case "saved":
          return result.isSaved && !result.isHidden;
        case "hidden":
          return result.isHidden;
        case "all":
        default:
          return !result.isHidden;
      }
    });
  }, [results, filter, allMarkedRead]);

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
        onMarkAllRead={handleMarkAllRead}
        isPending={isPending}
      />

      <div className="grid gap-4">
        {filteredResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {filter === "unread" && "No unread results"}
            {filter === "saved" && "No saved results"}
            {filter === "hidden" && "No hidden results"}
            {filter === "all" && "No results found"}
          </div>
        ) : (
          filteredResults.map((result, index) => (
            <ResultCard
              key={result.id}
              result={result}
              showHidden={filter === "hidden"}
              isAiBlurred={!hasUnlimitedAi && index > 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
