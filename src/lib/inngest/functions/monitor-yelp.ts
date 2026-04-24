import { inngest } from "../client";
import { logger } from "@/lib/logger";
import {
  searchYelpSerper,
  isSerperConfigured,
  type YelpReviewItem,
} from "@/lib/serper";
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
 * Monitor Yelp business reviews via Serper (Google Search)
 *
 * Uses Google Search to find Yelp reviews — legally compliant,
 * no direct scraping of Yelp's site.
 *
 * For Yelp monitors, platformUrls.yelp should contain a Yelp business page URL.
 * Example: https://www.yelp.com/biz/restaurant-name-city
 */
export const monitorYelp = inngest.createFunction(
  {
    id: "monitor-yelp",
    name: "Monitor Yelp Reviews",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "45 1-23/2 * * *" }, // :45 on odd hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    if (!isSerperConfigured()) {
      return { message: "Serper API key not configured, skipping Yelp monitoring" };
    }

    const yelpMonitors = await getActiveMonitors("yelp", step);
    if (yelpMonitors.length === 0) {
      return { message: "No active Yelp monitors" };
    }

    const planMap = await prefetchPlans(yelpMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < yelpMonitors.length; i++) {
      const monitor = yelpMonitors[i];

      await applyStagger(i, yelpMonitors.length, "yelp", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "yelp")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Get business URL from platformUrls, keywords, or companyName
      let businessUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.yelp) {
        businessUrl = platformUrls.yelp;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        const yelpUrl = monitor.keywords.find((k) => k.includes("yelp.com"));
        if (yelpUrl) businessUrl = yelpUrl;
      }
      if (!businessUrl && monitor.companyName) {
        businessUrl = monitor.companyName;
      }
      if (!businessUrl) {
        // Fail loudly rather than silently skip. Users need to know the monitor
        // can't scan Yelp without either a yelp.com URL in keywords or a
        // companyName. This writes lastCheckFailedReason so the UI surfaces it.
        trackScanFailed({
          userId: monitor.userId,
          monitorId: monitor.id,
          platform: "yelp",
          error: new Error("MissingInput: Yelp requires a yelp.com URL in keywords, platformUrls.yelp, or a companyName. None provided — scan skipped."),
        });
        continue;
      }

      // Fetch reviews via Serper (Google Search)
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          return await searchYelpSerper(businessUrl!, 30);
        } catch (error) {
          logger.error("[Yelp] Error searching via Serper", { businessUrl, error: error instanceof Error ? error.message : String(error) });
          return [] as YelpReviewItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<YelpReviewItem>({
        items: reviews,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (r) => r.url || `yelp-review-${r.reviewId}`,
        mapToResult: (r) => ({
          monitorId: monitor.id,
          platform: "yelp" as const,
          sourceUrl: r.url || `yelp-review-${r.reviewId}`,
          title: `${r.rating}-star review${r.businessName ? ` for ${r.businessName}` : ""}`,
          content: r.text,
          author: r.author,
          postedAt: r.date ? new Date(r.date) : new Date(),
          metadata: {
            reviewId: r.reviewId,
            rating: r.rating,
            authorLocation: r.authorLocation,
            businessName: r.businessName,
            hasPhotos: r.photos && r.photos.length > 0,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "yelp", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "yelp" });
    }

    return {
      message: `Scanned Yelp via Serper, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
