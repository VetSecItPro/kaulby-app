import { inngest } from "../client";
import { logger } from "@/lib/logger";
import {
  searchAmazonSerper,
  isSerperConfigured,
  type AmazonReviewItem,
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
  type MonitorStep,
} from "../utils/monitor-helpers";

/**
 * Monitor Amazon product reviews via Serper (Google Search)
 *
 * Uses Google Search to find Amazon reviews — legally compliant,
 * no direct scraping of Amazon's site.
 *
 * For Amazon monitors, platformUrls.amazonreviews should contain an Amazon product URL or ASIN.
 * Example: https://amazon.com/dp/B08N5WRWNW or just B08N5WRWNW
 */
export const monitorAmazon = inngest.createFunction(
  {
    id: "monitor-amazon",
    name: "Monitor Amazon Reviews",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 */2 * * *" }, // Every 2 hours (matches fastest plan tier)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isSerperConfigured()) {
      return { message: "Serper API key not configured, skipping Amazon monitoring" };
    }

    const amazonMonitors = await getActiveMonitors("amazonreviews", step);
    if (amazonMonitors.length === 0) {
      return { message: "No active Amazon Reviews monitors" };
    }

    const planMap = await prefetchPlans(amazonMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < amazonMonitors.length; i++) {
      const monitor = amazonMonitors[i];

      await applyStagger(i, amazonMonitors.length, "amazonreviews", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "amazonreviews")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Get product URL/ASIN from platformUrls or keywords
      let productUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.amazonreviews) {
        productUrl = platformUrls.amazonreviews;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        const amazonUrl = monitor.keywords.find(
          (k) => k.includes("amazon.com") || k.includes("amazon.") || /^[A-Z0-9]{10}$/i.test(k)
        );
        if (amazonUrl) productUrl = amazonUrl;
      }
      if (!productUrl) continue;

      // Fetch reviews via Serper (Google Search)
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          return await searchAmazonSerper(productUrl!, 30);
        } catch (error) {
          logger.error("[Amazon] Error searching via Serper", { productUrl, error: error instanceof Error ? error.message : String(error) });
          return [] as AmazonReviewItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<AmazonReviewItem>({
        items: reviews,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (review) => review.url || `amazon-review-${review.reviewId}`,
        mapToResult: (review) => ({
          monitorId: monitor.id,
          platform: "amazonreviews" as const,
          sourceUrl: review.url || `amazon-review-${review.reviewId}`,
          title: review.title || `${review.rating}-star review`,
          content: review.text,
          author: review.author,
          postedAt: review.date ? new Date(review.date) : new Date(),
          metadata: {
            reviewId: review.reviewId,
            rating: review.rating,
            verifiedPurchase: review.verifiedPurchase,
            helpfulVotes: review.helpfulVotes,
            productName: review.productName,
            productAsin: review.productAsin,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "amazonreviews", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Amazon via Serper, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
