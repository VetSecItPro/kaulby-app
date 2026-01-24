/**
 * SWR Cache Keys
 * Centralized key management for consistent cache invalidation
 */

export const SWR_KEYS = {
  // Monitor keys
  monitors: () => '/api/monitors' as const,
  monitor: (id: string) => `/api/monitors/${id}` as const,
  
  // Results keys
  results: (monitorId?: string) => 
    monitorId ? `/api/results?monitorId=${monitorId}` : '/api/results' as const,
  
  // Stats keys
  stats: () => '/api/stats' as const,
  
  // User keys
  user: () => '/api/user' as const,
  usage: () => '/api/usage' as const,
  
  // Alerts keys
  alerts: (monitorId?: string) =>
    monitorId ? `/api/alerts?monitorId=${monitorId}` : '/api/alerts' as const,
};

/**
 * Helper to invalidate related keys
 */
export function getRelatedKeys(key: string): string[] {
  if (key.startsWith('/api/monitors')) {
    return [SWR_KEYS.monitors(), SWR_KEYS.stats()];
  }
  if (key.startsWith('/api/results')) {
    return [SWR_KEYS.stats()];
  }
  return [];
}
