import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { fetchPlayStoreReviews, isApifyConfigured, type PlayStoreReviewItem } from "@/lib/apify";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  updateSkippedMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  hasAnyActiveMonitors,
  trackScanFailed,
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
  { cron: "24 1-23/2 * * *" }, // :24 on odd hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

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
      if (shouldSkipMonitor(monitor, planMap, "playstore")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

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
      if (!appUrl) {
        trackScanFailed({
          userId: monitor.userId,
          monitorId: monitor.id,
          platform: "playstore",
          error: new Error("MissingInput: Play Store requires a play.google.com URL or a package name (e.g. com.example.app) in keywords or platformUrls.playstore. None provided — scan skipped."),
        });
        continue;
      }

      // Fetch reviews (platform-specific)
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
        try {
          return await fetchPlayStoreReviews(appUrl!, 20);
        } catch (error) {
          logger.error("[PlayStore] Error fetching reviews", { appUrl, error: error instanceof Error ? error.message : String(error) });
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
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "playstore" });
    }

    return {
      message: `Scanned Play Store, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
