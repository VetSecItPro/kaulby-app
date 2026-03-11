import { inngest } from "../client";
import { logger } from "@/lib/logger";
import {
  searchTrustpilotSerper,
  isSerperConfigured,
  type TrustpilotReviewItem,
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
 * Monitor Trustpilot reviews via Serper (Google Search)
 *
 * Uses Google Search to find Trustpilot reviews — legally compliant,
 * no direct scraping of Trustpilot's site.
 *
 * For Trustpilot monitors, the "keywords" field stores Trustpilot URLs
 * or company domains to monitor (e.g., "example.com" or "https://trustpilot.com/review/example.com")
 */
export const monitorTrustpilot = inngest.createFunction(
  {
    id: "monitor-trustpilot",
    name: "Monitor Trustpilot",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 */2 * * *" }, // Every 2 hours (matches fastest plan tier)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isSerperConfigured()) {
      return { message: "Serper API key not configured, skipping Trustpilot monitoring" };
    }

    const trustpilotMonitors = await getActiveMonitors("trustpilot", step);
    if (trustpilotMonitors.length === 0) {
      return { message: "No active Trustpilot monitors" };
    }

    const planMap = await prefetchPlans(trustpilotMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < trustpilotMonitors.length; i++) {
      const monitor = trustpilotMonitors[i];

      await applyStagger(i, trustpilotMonitors.length, "trustpilot", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "trustpilot")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Get company URL from platformUrls, keywords, or companyName
      let companyUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.trustpilot) {
        companyUrl = platformUrls.trustpilot;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        companyUrl = monitor.keywords.find(
          (k) => k.includes("trustpilot") || k.includes(".com") || k.includes(".io")
        ) || monitor.keywords[0];
      } else if (monitor.companyName) {
        companyUrl = monitor.companyName.toLowerCase().replace(/\s+/g, "");
      }
      if (!companyUrl) continue;

      // Fetch reviews via Serper (Google Search)
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${companyUrl.slice(0, 20)}`, async () => {
        try {
          return await searchTrustpilotSerper(companyUrl!, 20);
        } catch (error) {
          logger.error("[Trustpilot] Error searching via Serper", { companyUrl, error: error instanceof Error ? error.message : String(error) });
          return [] as TrustpilotReviewItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<TrustpilotReviewItem>({
        items: reviews,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (review) => review.url || `trustpilot-${review.id}`,
        mapToResult: (review) => ({
          monitorId: monitor.id,
          platform: "trustpilot" as const,
          sourceUrl: review.url || `trustpilot-${review.id}`,
          title: review.title || `${review.rating}-star review`,
          content: review.text,
          author: review.author,
          postedAt: review.date ? new Date(review.date) : new Date(),
          metadata: {
            trustpilotId: review.id,
            rating: review.rating,
            authorLocation: review.authorLocation,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "trustpilot", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Trustpilot via Serper, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
