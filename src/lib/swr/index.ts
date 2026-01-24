// SWR - Client-side data caching and revalidation
// This module provides hooks for fetching data with automatic caching

export { fetcher, authFetcher, postFetcher, FetchError } from "./fetcher";
export { SWR_KEYS, SWR_CONFIG, getPrefetchKeys } from "./keys";
export {
  useMonitors,
  useMonitor,
  useResults,
  useAllResults,
  useStats,
  useInsights,
  useCreateMonitor,
  useUpdateMonitor,
  useDeleteMonitor,
  useTriggerScan,
} from "./hooks";
