import { inngest } from "../client";
import { logger } from "@/lib/logger";
import {
  searchG2Serper,
  isSerperConfigured,
  type G2ReviewItem,
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
  type MonitorStep,
} from "../utils/monitor-helpers";

/**
 * Monitor G2 software reviews via Serper (Google Search)
 *
 * Uses Google Search to find G2 reviews — legally compliant,
 * no direct scraping of G2's site.
 *
 * For G2 monitors, platformUrls.g2 should contain a G2 product page URL.
 * Example: https://www.g2.com/products/slack/reviews
 */
export const monitorG2 = inngest.createFunction(
  {
    id: "monitor-g2",
    name: "Monitor G2 Reviews",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "38 1-23/2 * * *" }, // :38 on odd hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    if (!isSerperConfigured()) {
      return { message: "Serper API key not configured, skipping G2 monitoring" };
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
      if (shouldSkipMonitor(monitor, planMap, "g2")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Get product URL from platformUrls, keywords, or companyName
      let productUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.g2) {
        productUrl = platformUrls.g2;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        const g2Url = monitor.keywords.find((k) => k.includes("g2.com"));
        if (g2Url) productUrl = g2Url;
      }
      if (!productUrl && monitor.companyName) {
        productUrl = monitor.companyName;
      }
      if (!productUrl) continue;

      // Fetch reviews via Serper (Google Search)
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          return await searchG2Serper(productUrl!, 30);
        } catch (error) {
          logger.error("[G2] Error searching via Serper", { productUrl, error: error instanceof Error ? error.message : String(error) });
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
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "g2" });
    }

    return {
      message: `Scanned G2 via Serper, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
