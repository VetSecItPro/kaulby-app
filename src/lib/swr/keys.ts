/**
 * SWR Cache Keys - Centralized key management for data caching
 *
 * Using functions instead of strings enables:
 * 1. Type-safe parameters
 * 2. Consistent key generation
 * 3. Easy invalidation with pattern matching
 */

export const SWR_KEYS = {
  // Dashboard data
  monitors: (userId: string) => `/api/monitors?userId=${userId}` as const,
  monitor: (monitorId: string) => `/api/monitors/${monitorId}` as const,

  // Results
  results: (monitorId: string, page?: number) =>
    page
      ? `/api/results?monitorId=${monitorId}&page=${page}` as const
      : `/api/results?monitorId=${monitorId}` as const,
  allResults: (userId: string, page?: number) =>
    page
      ? `/api/results?userId=${userId}&page=${page}` as const
      : `/api/results?userId=${userId}` as const,

  // Stats and insights
  stats: (userId: string) => `/api/stats?userId=${userId}` as const,
  insights: (userId: string) => `/api/insights?userId=${userId}` as const,

  // User data
  user: (userId: string) => `/api/users/${userId}` as const,
  subscription: (userId: string) => `/api/subscription?userId=${userId}` as const,

  // Audiences
  audiences: (userId: string) => `/api/audiences?userId=${userId}` as const,
  audience: (audienceId: string) => `/api/audiences/${audienceId}` as const,

  // Webhooks
  webhooks: (userId: string) => `/api/webhooks?userId=${userId}` as const,

  // Team/workspace
  workspace: (workspaceId: string) => `/api/workspaces/${workspaceId}` as const,
  workspaceMembers: (workspaceId: string) => `/api/workspaces/${workspaceId}/members` as const,
} as const;

/**
 * SWR Configuration defaults
 * These can be overridden per-hook when needed
 */
export const SWR_CONFIG = {
  // Don't refetch on window focus for dashboard data (reduces API calls)
  revalidateOnFocus: false,

  // Dedupe requests within 30 seconds
  dedupingInterval: 30000,

  // Keep previous data while revalidating for smoother UX
  keepPreviousData: true,

  // Retry failed requests with exponential backoff
  errorRetryCount: 3,
  errorRetryInterval: 1000,

  // Refresh interval - disable by default, enable per-component
  refreshInterval: 0,
} as const;

/**
 * Generate prefetch keys for parallel data loading
 */
export function getPrefetchKeys(userId: string) {
  return [
    SWR_KEYS.monitors(userId),
    SWR_KEYS.stats(userId),
  ];
}
