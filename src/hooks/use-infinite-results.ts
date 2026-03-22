"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

type ConversationCategory =
  | "pain_point"
  | "solution_request"
  | "advice_request"
  | "money_talk"
  | "hot_discussion";

export interface Result {
  id: string;
  platform:
    | "reddit"
    | "hackernews"
    | "producthunt"
    | "devto"
    | "googlereviews"
    | "trustpilot"
    | "appstore"
    | "playstore"
    | "quora"
    | "youtube"
    | "g2"
    | "yelp"
    | "amazonreviews"
    | "indiehackers"
    | "github"
    | "hashnode"
    | "x";
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

interface UseInfiniteResultsOptions {
  visibleResults: Result[];
  totalPages: number;
}

interface UseInfiniteResultsReturn {
  allResults: Result[];
  loadMoreRef: React.RefObject<HTMLDivElement>;
  hasMore: boolean;
  loadingMore: boolean;
}

export function useInfiniteResults({
  visibleResults,
  totalPages,
}: UseInfiniteResultsOptions): UseInfiniteResultsReturn {
  const [loadedResults, setLoadedResults] = useState<Result[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(totalPages > 1);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Combine initial results with loaded results
  const allResults = useMemo(() => {
    return [...visibleResults, ...loadedResults];
  }, [visibleResults, loadedResults]);

  // Refs for stable handleLoadMore (avoids IntersectionObserver reconnection)
  const cursorRef = useRef(cursor);
  const visibleResultsRef = useRef(visibleResults);
  cursorRef.current = cursor;
  visibleResultsRef.current = visibleResults;

  // Abort controller ref for cancelling in-flight fetches
  const abortRef = useRef<AbortController | null>(null);

  // Load more results
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingMore(true);
    try {
      const cursorValue = cursorRef.current;
      const visResults = visibleResultsRef.current;

      const cursorParam = cursorValue || (() => {
        let lastPostedAt: string | null = null;
        setLoadedResults((prev) => {
          const lastResult =
            prev.length > 0
              ? prev[prev.length - 1]
              : visResults[visResults.length - 1];
          lastPostedAt = lastResult?.postedAt
            ? new Date(lastResult.postedAt).toISOString()
            : null;
          return prev;
        });
        return lastPostedAt;
      })();

      const url = cursorParam
        ? `/api/results?cursor=${encodeURIComponent(cursorParam)}&limit=20`
        : "/api/results?limit=20";

      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();

      if (res.ok) {
        const newResults: Result[] = data.items.map(
          (item: Record<string, unknown>) => ({
            ...item,
            postedAt: item.postedAt ? new Date(item.postedAt as string) : null,
          })
        );
        setLoadedResults((prev) => {
          const combined = [...prev, ...newResults];
          return combined.length > 500 ? combined.slice(-500) : combined;
        });
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      // Ignore abort errors — they're expected when cancelling in-flight requests
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to load more results:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // IntersectionObserver for auto-loading more results
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, handleLoadMore]);

  return { allResults, loadMoreRef, hasMore, loadingMore };
}
