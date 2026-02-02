import { inngest } from "../client";
import { fetchGoogleReviews, isApifyConfigured, type GoogleReviewItem } from "@/lib/apify";
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
  { cron: "0 * * * *" }, // Every hour
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Google Reviews monitoring" };
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
      if (shouldSkipMonitor(monitor, planMap, "googlereviews")) continue;

      // Get business URL from platformUrls, keywords, or companyName
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
      // Fallback: Use companyName as search term
      if (!businessUrl && monitor.companyName) {
        businessUrl = `https://www.google.com/maps/search/${encodeURIComponent(monitor.companyName)}`;
      }
      if (!businessUrl) continue;

      // Fetch reviews (platform-specific)
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${businessUrl.slice(0, 20)}`, async () => {
        try {
          return await fetchGoogleReviews(businessUrl!, 20);
        } catch (error) {
          console.error(`Error fetching Google Reviews for ${businessUrl}:`, error);
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
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Google Reviews, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
