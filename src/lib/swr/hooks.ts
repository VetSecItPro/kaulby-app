"use client";

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { fetcher, postFetcher } from './fetcher';
import { SWR_KEYS } from './keys';

// Types
interface Monitor {
  id: string;
  name: string;
  companyName: string | null;
  keywords: string[];
  platforms: string[];
  isActive: boolean;
  lastCheckedAt: Date | null;
  newMatchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Result {
  id: string;
  monitorId: string;
  platform: string;
  title: string;
  content: string | null;
  sourceUrl: string;
  author: string | null;
  sentiment: string | null;
  createdAt: Date;
}

interface Stats {
  totalMonitors: number;
  activeMonitors: number;
  totalResults: number;
  recentResults: number;
}

// SWR Config defaults
const defaultConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 30000, // 30s dedup
  errorRetryCount: 3,
};

/**
 * Hook to fetch all monitors
 */
export function useMonitors() {
  const { data, error, isLoading, mutate } = useSWR<{ monitors: Monitor[] }>(
    SWR_KEYS.monitors(),
    fetcher,
    defaultConfig
  );

  return {
    monitors: data?.monitors ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Hook to fetch a single monitor
 */
export function useMonitor(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ monitor: Monitor }>(
    id ? SWR_KEYS.monitor(id) : null,
    fetcher,
    defaultConfig
  );

  return {
    monitor: data?.monitor,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Hook to fetch results with optional monitor filter
 */
export function useResults(monitorId?: string) {
  const { data, error, isLoading, mutate } = useSWR<{ results: Result[] }>(
    SWR_KEYS.results(monitorId),
    fetcher,
    {
      ...defaultConfig,
      refreshInterval: 60000, // Refresh every minute for results
    }
  );

  return {
    results: data?.results ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Hook to fetch dashboard stats
 */
export function useStats() {
  const { data, error, isLoading, mutate } = useSWR<Stats>(
    SWR_KEYS.stats(),
    fetcher,
    {
      ...defaultConfig,
      refreshInterval: 120000, // Refresh every 2 minutes
    }
  );

  return {
    stats: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

/**
 * Hook to delete a monitor with optimistic updates
 */
export function useDeleteMonitor() {
  const { trigger, isMutating } = useSWRMutation(
    SWR_KEYS.monitors(),
    async (url: string, { arg }: { arg: { id: string } }) => {
      const response = await fetch(`/api/monitors/${arg.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete monitor');
      return response.json();
    }
  );

  return {
    deleteMonitor: trigger,
    isDeleting: isMutating,
  };
}

/**
 * Hook to trigger a monitor scan
 */
export function useScanMonitor() {
  const { trigger, isMutating } = useSWRMutation(
    '/api/monitors/scan',
    postFetcher
  );

  return {
    scanMonitor: trigger,
    isScanning: isMutating,
  };
}
