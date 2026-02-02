import { inngest } from "../client";
import { fetchAppStoreReviews, isApifyConfigured, type AppStoreReviewItem } from "@/lib/apify";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  type MonitorStep,
} from "../utils/monitor-helpers";

/**
 * Monitor App Store reviews for iOS apps
 *
 * For App Store monitors, the "keywords" field stores App Store URLs
 * or app IDs to monitor (e.g., "id123456789" or "https://apps.apple.com/us/app/app-name/id123456789")
 *
 * Runs every 6 hours since App Store reviews update less frequently
 */
export const monitorAppStore = inngest.createFunction(
  {
    id: "monitor-appstore",
    name: "Monitor App Store",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 * * * *" }, // Every hour (tier-based delays apply)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping App Store monitoring" };
    }

    const appStoreMonitors = await getActiveMonitors("appstore", step);
    if (appStoreMonitors.length === 0) {
      return { message: "No active App Store monitors" };
    }

    const planMap = await prefetchPlans(appStoreMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < appStoreMonitors.length; i++) {
      const monitor = appStoreMonitors[i];

      await applyStagger(i, appStoreMonitors.length, "appstore", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "appstore")) continue;

      // Get app URL from platformUrls or keywords
      let appUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.appstore) {
        appUrl = platformUrls.appstore;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        appUrl = monitor.keywords.find(
          (k) => k.includes("apps.apple.com") || k.startsWith("id") || /^\d+$/.test(k)
        ) || null;
      }
      if (!appUrl) continue;

      // Fetch reviews (platform-specific)
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
        try {
          return await fetchAppStoreReviews(appUrl!, 20);
        } catch (error) {
          console.error(`Error fetching App Store reviews for ${appUrl}:`, error);
          return [] as AppStoreReviewItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<AppStoreReviewItem>({
        items: reviews,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (review) => review.url || `appstore-${review.appId || "unknown"}-${review.id}`,
        mapToResult: (review) => ({
          monitorId: monitor.id,
          platform: "appstore" as const,
          sourceUrl: review.url || `appstore-${review.appId || "unknown"}-${review.id}`,
          title: review.title || `${review.rating}-star review`,
          content: review.text,
          author: review.userName,
          postedAt: review.date ? new Date(review.date) : new Date(),
          metadata: {
            appStoreId: review.id,
            appId: review.appId,
            rating: review.rating,
            appVersion: review.version,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "appstore", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned App Store, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
