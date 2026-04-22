import { inngest } from "../client";
import { logger } from "@/lib/logger";
import {
  fetchTrustpilotResilient,
  isTrustpilotConfigured,
  type TrustpilotReviewItem,
} from "@/lib/trustpilot";
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
 * Monitor Trustpilot reviews with Apify-primary + Serper-fallback chain.
 *
 * Primary: happitap/trustpilot-scraper (no SerpApi §1201 exposure).
 * Fallback: Serper site:trustpilot.com (legacy path, HIGH legal risk).
 *
 * See src/lib/trustpilot.ts and .mdmp/apify-platform-cost-audit-2026-04-21.md.
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
  { cron: "28 */2 * * *" }, // :28 on even hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    if (!isTrustpilotConfigured()) {
      return { message: "Neither Apify nor Serper configured — skipping Trustpilot monitoring" };
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

      // Fetch reviews — tries Apify first, falls back to Serper on error/empty.
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${companyUrl.slice(0, 20)}`, async () => {
        try {
          const { items, source } = await fetchTrustpilotResilient(companyUrl!, 20);
          logger.info("[Trustpilot] monitor fetch", { monitorId: monitor.id, source, count: items.length });
          return items;
        } catch (error) {
          logger.error("[Trustpilot] Error fetching reviews", { companyUrl, error: error instanceof Error ? error.message : String(error) });
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
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "trustpilot" });
    }

    return {
      message: `Scanned Trustpilot (apify primary + serper fallback), found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
