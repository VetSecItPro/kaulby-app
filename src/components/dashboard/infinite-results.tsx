"use client";

import { useState, useCallback } from "react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Loader2 } from "lucide-react";

export interface InfiniteResultItem {
  id: string;
  title: string;
  content: string | null;
  platform: string;
  sourceUrl: string;
  author: string | null;
  postedAt: string | null;
  sentiment: string | null;
  painPointCategory: string | null;
  conversationCategory: string | null;
  aiSummary: string | null;
  isViewed: boolean;
  isClicked: boolean;
  isSaved: boolean;
  isHidden: boolean;
  createdAt: string;
  monitor: {
    name: string;
    keywords: string[];
  } | null;
}

interface InfiniteResultsProps {
  /** Initial server-rendered results */
  initialResults: InfiniteResultItem[];
  /** Total count from server */
  totalCount: number;
  /** Whether there are more results beyond initial load */
  initialHasMore: boolean;
  /** The cursor for the next page (last item's createdAt) */
  initialCursor: string | null;
  /** Optional monitor ID filter */
  monitorId?: string;
  /** Render function for each result item */
  renderResult: (result: InfiniteResultItem) => React.ReactNode;
}

export function InfiniteResults({
  initialResults,
  totalCount,
  initialHasMore,
  initialCursor,
  monitorId,
  renderResult,
}: InfiniteResultsProps) {
  const [results, setResults] = useState<InfiniteResultItem[]>(initialResults);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(initialCursor);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !cursor) return;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        cursor,
        limit: "30",
      });
      if (monitorId) {
        params.set("monitorId", monitorId);
      }

      const res = await fetch(`/api/results?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load more results");

      const data = await res.json();
      setResults((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (error) {
      console.error("Failed to load more results:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cursor, hasMore, isLoading, monitorId]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
  });

  return (
    <div>
      <div className="space-y-4">
        {results.map((result) => (
          <div key={result.id}>{renderResult(result)}</div>
        ))}
      </div>

      {/* Sentinel element for intersection observer */}
      <div ref={sentinelRef} className="h-1" />

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading more results...</span>
        </div>
      )}

      {/* End of results */}
      {!hasMore && results.length > 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground" aria-live="polite" role="status">
          Showing all {totalCount.toLocaleString()} results
        </div>
      )}
    </div>
  );
}
