"use client";

import useSWR, { SWRConfiguration } from "swr";
import useSWRMutation from "swr/mutation";
import { authFetcher, postFetcher } from "./fetcher";
import { SWR_KEYS, SWR_CONFIG } from "./keys";
import type { Monitor, Result } from "@/lib/db/schema";

/**
 * Hook for fetching user's monitors with caching
 */
export function useMonitors(userId: string | null, config?: SWRConfiguration) {
  return useSWR<Monitor[]>(
    userId ? SWR_KEYS.monitors(userId) : null,
    authFetcher,
    {
      ...SWR_CONFIG,
      ...config,
    }
  );
}

/**
 * Hook for fetching a single monitor
 */
export function useMonitor(monitorId: string | null, config?: SWRConfiguration) {
  return useSWR<Monitor>(
    monitorId ? SWR_KEYS.monitor(monitorId) : null,
    authFetcher,
    {
      ...SWR_CONFIG,
      ...config,
    }
  );
}

/**
 * Hook for fetching results with pagination
 */
export function useResults(
  monitorId: string | null,
  page?: number,
  config?: SWRConfiguration
) {
  return useSWR<{ results: Result[]; total: number; page: number; totalPages: number }>(
    monitorId ? SWR_KEYS.results(monitorId, page) : null,
    authFetcher,
    {
      ...SWR_CONFIG,
      ...config,
    }
  );
}

/**
 * Hook for fetching all user results
 */
export function useAllResults(
  userId: string | null,
  page?: number,
  config?: SWRConfiguration
) {
  return useSWR<{ results: Result[]; total: number; page: number; totalPages: number }>(
    userId ? SWR_KEYS.allResults(userId, page) : null,
    authFetcher,
    {
      ...SWR_CONFIG,
      ...config,
    }
  );
}

/**
 * Hook for fetching dashboard stats
 */
export function useStats(userId: string | null, config?: SWRConfiguration) {
  return useSWR<{
    totalMonitors: number;
    totalResults: number;
    newResults24h: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number };
  }>(
    userId ? SWR_KEYS.stats(userId) : null,
    authFetcher,
    {
      ...SWR_CONFIG,
      ...config,
    }
  );
}

/**
 * Hook for fetching dashboard insights
 */
export function useInsights(userId: string | null, config?: SWRConfiguration) {
  return useSWR<{
    topKeywords: string[];
    trendingTopics: string[];
    sentimentTrend: Array<{ date: string; positive: number; negative: number }>;
  }>(
    userId ? SWR_KEYS.insights(userId) : null,
    authFetcher,
    {
      ...SWR_CONFIG,
      // Insights can be stale longer - refresh less often
      dedupingInterval: 60000,
      ...config,
    }
  );
}

/**
 * Mutation hook for creating a monitor
 */
export function useCreateMonitor() {
  return useSWRMutation("/api/monitors", postFetcher<Monitor>);
}

/**
 * Mutation hook for updating a monitor
 */
export function useUpdateMonitor(monitorId: string) {
  return useSWRMutation(`/api/monitors/${monitorId}`, async (url, { arg }: { arg: Partial<Monitor> }) => {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(arg),
    });
    if (!res.ok) throw new Error("Failed to update monitor");
    return res.json();
  });
}

/**
 * Mutation hook for deleting a monitor
 */
export function useDeleteMonitor(monitorId: string) {
  return useSWRMutation(`/api/monitors/${monitorId}`, async (url) => {
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to delete monitor");
    return res.json();
  });
}

/**
 * Mutation hook for triggering a manual scan
 */
export function useTriggerScan(monitorId: string) {
  return useSWRMutation(`/api/monitors/${monitorId}/scan`, async (url) => {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to trigger scan");
    return res.json();
  });
}
