"use client";

import { useState, useTransition } from "react";
import { ResultCard, ResultsFilterBar } from "./result-card";
import { markAllResultsViewed } from "@/app/(dashboard)/dashboard/results/actions";

interface Result {
  id: string;
  platform: "reddit" | "hackernews" | "producthunt" | "devto" | "twitter";
  sourceUrl: string;
  title: string;
  content: string | null;
  author: string | null;
  postedAt: Date | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  painPointCategory: string | null;
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

  // Calculate counts
  const unviewedCount = results.filter((r) => !r.isViewed && !allMarkedRead).length;
  const savedCount = results.filter((r) => r.isSaved).length;
  const hiddenCount = results.filter((r) => r.isHidden).length;
  const totalCount = results.filter((r) => !r.isHidden).length;

  // Filter results based on selected filter
  const filteredResults = results.filter((result) => {
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

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllResultsViewed();
      setAllMarkedRead(true);
    });
  };

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
