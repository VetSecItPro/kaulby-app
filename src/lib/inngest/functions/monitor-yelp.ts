import { inngest } from "../client";
import { fetchYelpReviews, isApifyConfigured, type YelpReviewItem } from "@/lib/apify";
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
 * Monitor Yelp business reviews
 *
 * For Yelp monitors, platformUrls.yelp should contain a Yelp business page URL.
 * Example: https://www.yelp.com/biz/restaurant-name-city
 *
 * Runs every hour - shouldProcessMonitor() handles tier-based delays:
 * - Team: every 2 hours
 * - Pro: every 4 hours
 * - Free: every 24 hours (but Yelp is Pro+ only)
 */
export const monitorYelp = inngest.createFunction(
  {
    id: "monitor-yelp",
    name: "Monitor Yelp Reviews",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Yelp monitoring" };
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
      if (shouldSkipMonitor(monitor, planMap, "yelp")) continue;

      // Get business URL from platformUrls or keywords
      let businessUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.yelp) {
        businessUrl = platformUrls.yelp;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        const yelpUrl = monitor.keywords.find((k) => k.includes("yelp.com"));
        if (yelpUrl) businessUrl = yelpUrl;
      }
      if (!businessUrl) continue;

      // Fetch reviews (platform-specific)
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          return await fetchYelpReviews(businessUrl!, 30);
        } catch (error) {
          console.error(`Error fetching Yelp reviews for ${businessUrl}:`, error);
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
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Yelp, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
