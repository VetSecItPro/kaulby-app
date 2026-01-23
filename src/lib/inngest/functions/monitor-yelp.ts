import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchYelpReviews, isApifyConfigured, type YelpReviewItem } from "@/lib/apify";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";

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
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Yelp monitoring" };
    }

    // Get all active monitors that include Yelp
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const yelpMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("yelp")
    );

    if (yelpMonitors.length === 0) {
      return { message: "No active Yelp monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of yelpMonitors) {
      // Check if user has access to Yelp platform
      const access = await canAccessPlatform(monitor.userId, "yelp");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay based on tier
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // Get business URL from platformUrls or keywords
      let businessUrl: string | null = null;

      // Check platformUrls first
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.yelp) {
        businessUrl = platformUrls.yelp;
      }
      // Fallback: Check keywords for Yelp URLs
      else if (monitor.keywords && monitor.keywords.length > 0) {
        const yelpUrl = monitor.keywords.find((k) => k.includes("yelp.com"));
        if (yelpUrl) businessUrl = yelpUrl;
      }

      if (!businessUrl) {
        continue; // No valid Yelp URL
      }

      // Fetch reviews
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          const fetchedReviews = await fetchYelpReviews(businessUrl!, 30);
          return fetchedReviews;
        } catch (error) {
          console.error(`Error fetching Yelp reviews for ${businessUrl}:`, error);
          return [] as YelpReviewItem[];
        }
      });

      // Save reviews as results and collect IDs for AI analysis
      const newResultIds: string[] = [];

      if (reviews.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          for (const review of reviews) {
            const sourceUrl = review.url || `yelp-review-${review.reviewId}`;

            // Check if we already have this result
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, sourceUrl),
            });

            if (!existing) {
              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "yelp",
                sourceUrl,
                title: `${review.rating}-star review${review.businessName ? ` for ${review.businessName}` : ""}`,
                content: review.text,
                author: review.author,
                postedAt: review.date ? new Date(review.date) : new Date(),
                metadata: {
                  reviewId: review.reviewId,
                  rating: review.rating,
                  authorLocation: review.authorLocation,
                  businessName: review.businessName,
                  hasPhotos: review.photos && review.photos.length > 0,
                },
              }).returning();

              totalResults++;
              monitorMatchCount++;
              newResultIds.push(newResult.id);

              // Increment usage count for the user
              await incrementResultsCount(monitor.userId, 1);
            }
          }
        });

        // Trigger AI analysis - batch mode for large volumes, individual for small
        if (newResultIds.length > 0) {
          await step.run(`trigger-analysis-${monitor.id}`, async () => {
            if (newResultIds.length > AI_BATCH_CONFIG.BATCH_THRESHOLD) {
              // Batch mode for cost efficiency
              await inngest.send({
                name: "content/analyze-batch",
                data: {
                  monitorId: monitor.id,
                  userId: monitor.userId,
                  platform: "yelp",
                  resultIds: newResultIds,
                  totalCount: newResultIds.length,
                },
              });
            } else {
              // Individual analysis for small volumes
              for (const resultId of newResultIds) {
                await inngest.send({
                  name: "content/analyze",
                  data: {
                    resultId,
                    userId: monitor.userId,
                  },
                });
              }
            }
          });
        }
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
      message: `Scanned Yelp, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
