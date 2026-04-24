import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { fetchGoogleReviews, isApifyConfigured, type GoogleReviewItem } from "@/lib/apify";
import { searchGoogleReviewsSerper, isSerperConfigured } from "@/lib/serper";
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
 * Monitor Google Reviews for businesses
 *
 * For Google Reviews monitors, the "keywords" field stores Google Maps URLs
 * or business identifiers to monitor (e.g., "https://maps.google.com/?cid=123")
 * If no URL is provided, companyName is used as a search term.
 *
 * Runs every hour - shouldProcessMonitor() handles tier-based delays:
 * - Enterprise: every hour (real-time)
 * - Pro: every 4 hours
 * - Free: every 24 hours
 */
export const monitorGoogleReviews = inngest.createFunction(
  {
    id: "monitor-googlereviews",
    name: "Monitor Google Reviews",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  // Every 4h — reviews are low-velocity. See docs/planning/apify-cost-optimization-2026-04-24.md Change 4.
  { cron: "21 */4 * * *" }, // :21 every 4 hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    if (!isApifyConfigured() && !isSerperConfigured()) {
      return { message: "Neither Apify nor Serper configured, skipping Google Reviews monitoring" };
    }

    const googleMonitors = await getActiveMonitors("googlereviews", step);
    if (googleMonitors.length === 0) {
      return { message: "No active Google Reviews monitors" };
    }

    const planMap = await prefetchPlans(googleMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < googleMonitors.length; i++) {
      const monitor = googleMonitors[i];

      await applyStagger(i, googleMonitors.length, "googlereviews", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "googlereviews")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Get business URL from platformUrls or keywords
      let businessUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.googlereviews) {
        businessUrl = platformUrls.googlereviews;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        const googleUrl = monitor.keywords.find(
          (k) => k.includes("google") || k.includes("maps") || k.startsWith("ChI")
        );
        if (googleUrl) businessUrl = googleUrl;
      }

      // Determine if we have a direct place URL/ID (Apify can handle) or just a company name (Serper search)
      const hasDirectUrl = !!businessUrl;
      const searchTerm = monitor.companyName || "";
      if (!hasDirectUrl && !searchTerm) continue;

      // Fetch reviews: Apify for direct URLs, Serper for company name search
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${(businessUrl || searchTerm).slice(0, 20)}`, async () => {
        // Strategy 1: Direct URL/Place ID → use Apify (most accurate)
        if (hasDirectUrl) {
          try {
            const apifyResults = await fetchGoogleReviews(businessUrl!, 20);
            if (apifyResults.length > 0) return apifyResults;
          } catch (error) {
            logger.warn("[GoogleReviews] Apify failed, falling back to Serper", { businessUrl, error: error instanceof Error ? error.message : String(error) });
          }
        }

        // Strategy 2: Company name search or Apify fallback → use Serper
        const query = hasDirectUrl ? businessUrl! : searchTerm;
        try {
          const serperResults = await searchGoogleReviewsSerper(query, 20);
          // Map Serper results to GoogleReviewItem format
          return serperResults.map((r) => ({
            reviewId: r.reviewId,
            name: r.name,
            text: r.text,
            stars: r.stars,
            publishedAtDate: r.publishedAtDate,
            reviewUrl: r.reviewUrl,
            reviewerUrl: undefined,
            placeId: r.placeId,
          })) as GoogleReviewItem[];
        } catch (error) {
          logger.error("[GoogleReviews] All fetch methods failed", { query, error: error instanceof Error ? error.message : String(error) });
          return [] as GoogleReviewItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<GoogleReviewItem>({
        items: reviews,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (r) => r.reviewUrl || `google-review-${r.reviewId}`,
        mapToResult: (r) => ({
          monitorId: monitor.id,
          platform: "googlereviews" as const,
          sourceUrl: r.reviewUrl || `google-review-${r.reviewId}`,
          title: `${r.stars}-star review from ${r.name}`,
          content: r.text,
          author: r.name,
          postedAt: r.publishedAtDate ? new Date(r.publishedAtDate) : new Date(),
          metadata: {
            reviewId: r.reviewId,
            rating: r.stars,
            reviewerUrl: r.reviewerUrl,
            placeId: r.placeId,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "googlereviews", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "googlereviews" });
    }

    return {
      message: `Scanned Google Reviews, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
