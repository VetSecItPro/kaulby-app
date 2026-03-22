"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr-fetcher";
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

interface ApiPage {
  items: InfiniteResultItem[];
  hasMore: boolean;
  nextCursor: string | null;
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
  const getKey = (pageIndex: number, previousPageData: ApiPage | null) => {
    // First page uses server-rendered data (no fetch needed)
    if (pageIndex === 0) return null;

    // If previous page said no more, stop
    if (previousPageData && !previousPageData.hasMore) return null;

    const cursor = previousPageData?.nextCursor;
    if (!cursor) return null;

    const params = new URLSearchParams({ cursor, limit: "30" });
    if (monitorId) params.set("monitorId", monitorId);
    return `/api/results?${params.toString()}`;
  };

  const { data: pages, size, setSize, isValidating } = useSWRInfinite<ApiPage>(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      fallbackData: [{
        items: initialResults,
        hasMore: initialHasMore,
        nextCursor: initialCursor,
      }],
    }
  );

  const allResults = pages ? pages.flatMap((page) => page.items) : initialResults;
  const hasMore = pages ? pages[pages.length - 1]?.hasMore ?? false : initialHasMore;
  const isLoading = isValidating;

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: () => setSize(size + 1),
  });

  return (
    <div>
      <div className="space-y-4">
        {allResults.map((result) => (
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
      {!hasMore && allResults.length > 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground" aria-live="polite" role="status">
          Showing all {totalCount.toLocaleString()} results
        </div>
      )}
    </div>
  );
}
