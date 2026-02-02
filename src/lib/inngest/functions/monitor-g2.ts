import { inngest } from "../client";
import { fetchG2Reviews, isApifyConfigured, type G2ReviewItem } from "@/lib/apify";
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
 * Monitor G2 software reviews
 *
 * For G2 monitors, platformUrls.g2 should contain a G2 product page URL.
 * Example: https://www.g2.com/products/slack/reviews
 *
 * Runs every hour - shouldProcessMonitor() handles tier-based delays:
 * - Team: every 2 hours
 * - Pro: every 4 hours
 * - Free: every 24 hours (but G2 is Pro+ only)
 */
export const monitorG2 = inngest.createFunction(
  {
    id: "monitor-g2",
    name: "Monitor G2 Reviews",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping G2 monitoring" };
    }

    const g2Monitors = await getActiveMonitors("g2", step);
    if (g2Monitors.length === 0) {
      return { message: "No active G2 monitors" };
    }

    const planMap = await prefetchPlans(g2Monitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < g2Monitors.length; i++) {
      const monitor = g2Monitors[i];

      await applyStagger(i, g2Monitors.length, "g2", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "g2")) continue;

      // Get product URL from platformUrls or keywords
      let productUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.g2) {
        productUrl = platformUrls.g2;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        const g2Url = monitor.keywords.find((k) => k.includes("g2.com"));
        if (g2Url) productUrl = g2Url;
      }
      if (!productUrl) continue;

      // Fetch reviews (platform-specific)
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          return await fetchG2Reviews(productUrl!, 30);
        } catch (error) {
          console.error(`Error fetching G2 reviews for ${productUrl}:`, error);
          return [] as G2ReviewItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<G2ReviewItem>({
        items: reviews,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (review) => review.url || `g2-review-${review.reviewId}`,
        mapToResult: (review) => {
          let content = review.text;
          if (review.pros) content += `\n\nPros: ${review.pros}`;
          if (review.cons) content += `\n\nCons: ${review.cons}`;

          return {
            monitorId: monitor.id,
            platform: "g2" as const,
            sourceUrl: review.url || `g2-review-${review.reviewId}`,
            title: review.title || `${review.rating}-star review`,
            content,
            author: review.author,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              reviewId: review.reviewId,
              rating: review.rating,
              authorRole: review.authorRole,
              companySize: review.companySize,
              industry: review.industry,
              productName: review.productName,
            },
          };
        },
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "g2", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned G2, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
