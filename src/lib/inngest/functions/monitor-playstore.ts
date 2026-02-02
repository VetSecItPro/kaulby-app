import { inngest } from "../client";
import { fetchPlayStoreReviews, isApifyConfigured, type PlayStoreReviewItem } from "@/lib/apify";
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
 * Monitor Google Play Store reviews for Android apps
 *
 * For Play Store monitors, the "keywords" field stores Play Store URLs
 * or package IDs to monitor (e.g., "com.example.app" or "https://play.google.com/store/apps/details?id=com.example.app")
 *
 * Runs every hour - shouldProcessMonitor() handles tier-based delays:
 * - Team: every 2 hours
 * - Pro: every 4 hours
 * - Free: every 24 hours (but Play Store is Team only)
 */
export const monitorPlayStore = inngest.createFunction(
  {
    id: "monitor-playstore",
    name: "Monitor Play Store",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 * * * *" }, // Every hour (tier-based delays apply)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Play Store monitoring" };
    }

    const playStoreMonitors = await getActiveMonitors("playstore", step);
    if (playStoreMonitors.length === 0) {
      return { message: "No active Play Store monitors" };
    }

    const planMap = await prefetchPlans(playStoreMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < playStoreMonitors.length; i++) {
      const monitor = playStoreMonitors[i];

      await applyStagger(i, playStoreMonitors.length, "playstore", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "playstore")) continue;

      // Get app URL from platformUrls or keywords
      let appUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.playstore) {
        appUrl = platformUrls.playstore;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        appUrl = monitor.keywords.find(
          (k) => k.includes("play.google.com") || k.includes(".")
        ) || null;
      }
      if (!appUrl) continue;

      // Fetch reviews (platform-specific)
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
        try {
          return await fetchPlayStoreReviews(appUrl!, 20);
        } catch (error) {
          console.error(`Error fetching Play Store reviews for ${appUrl}:`, error);
          return [] as PlayStoreReviewItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<PlayStoreReviewItem>({
        items: reviews,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (r) => r.url || `playstore-${r.reviewId}`,
        mapToResult: (r) => ({
          monitorId: monitor.id,
          platform: "playstore" as const,
          sourceUrl: r.url || `playstore-${r.reviewId}`,
          title: `${r.score}-star review`,
          content: r.text,
          author: r.userName,
          postedAt: r.date ? new Date(r.date) : new Date(),
          metadata: {
            playStoreId: r.reviewId,
            rating: r.score,
            appVersion: r.appVersion,
            thumbsUpCount: r.thumbsUpCount,
            hasReply: !!r.replyText,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "playstore", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Play Store, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
