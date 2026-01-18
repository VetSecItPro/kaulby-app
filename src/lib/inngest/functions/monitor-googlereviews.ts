import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchGoogleReviews, isApifyConfigured, type GoogleReviewItem } from "@/lib/apify";

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
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Google Reviews monitoring" };
    }

    // Get all active monitors that include Google Reviews
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const googleMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("googlereviews")
    );

    if (googleMonitors.length === 0) {
      return { message: "No active Google Reviews monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of googleMonitors) {
      // Check if user has access to Google Reviews platform
      const access = await canAccessPlatform(monitor.userId, "googlereviews");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // For Google Reviews, check platformUrls first, then fall back to keywords/companyName
      let businessUrl: string | null = null;

      // Check platformUrls (new field)
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.googlereviews) {
        businessUrl = platformUrls.googlereviews;
      }
      // Fallback: Check keywords for Google URLs
      else if (monitor.keywords && monitor.keywords.length > 0) {
        const googleUrl = monitor.keywords.find(
          (k) => k.includes("google") || k.includes("maps") || k.startsWith("ChI")
        );
        if (googleUrl) businessUrl = googleUrl;
      }
      // Fallback: Use companyName as search term
      if (!businessUrl && monitor.companyName) {
        // For business name searches, use a Google Maps search URL
        businessUrl = `https://www.google.com/maps/search/${encodeURIComponent(monitor.companyName)}`;
      }

      if (!businessUrl) {
        continue; // No valid business identifier
      }

      // Process single business URL
      const reviews = await step.run(`fetch-reviews-${monitor.id}-${businessUrl.slice(0, 20)}`, async () => {
        try {
          const fetchedReviews = await fetchGoogleReviews(businessUrl!, 20);
          return fetchedReviews;
        } catch (error) {
          console.error(`Error fetching Google Reviews for ${businessUrl}:`, error);
          return [] as GoogleReviewItem[];
        }
      });

      // Save reviews as results
      if (reviews.length > 0) {
        await step.run(`save-results-${monitor.id}-${businessUrl.slice(0, 20)}`, async () => {
            for (const review of reviews) {
              // Check if we already have this result
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, review.reviewUrl || `google-review-${review.reviewId}`),
              });

              if (!existing) {
                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "googlereviews",
                  sourceUrl: review.reviewUrl || `google-review-${review.reviewId}`,
                  title: `${review.stars}-star review from ${review.name}`,
                  content: review.text,
                  author: review.name,
                  postedAt: review.publishedAtDate ? new Date(review.publishedAtDate) : new Date(),
                  metadata: {
                    reviewId: review.reviewId,
                    rating: review.stars,
                    reviewerUrl: review.reviewerUrl,
                    placeId: review.placeId,
                  },
                }).returning();

                totalResults++;
                monitorMatchCount++;

                // Increment usage count for the user
                await incrementResultsCount(monitor.userId, 1);

                // Trigger content analysis
                await inngest.send({
                  name: "content/analyze",
                  data: {
                    resultId: newResult.id,
                    userId: monitor.userId,
                  },
                });
              }
            }
          });
        }


      // Update monitor stats
      monitorResults[monitor.id] = monitorMatchCount;

      await step.run(`update-monitor-stats-${monitor.id}`, async () => {
        await db
          .update(monitors)
          .set({
            lastCheckedAt: new Date(),
            newMatchCount: monitorMatchCount,
            updatedAt: new Date(),
          })
          .where(eq(monitors.id, monitor.id));
      });
    }

    return {
      message: `Scanned Google Reviews, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
