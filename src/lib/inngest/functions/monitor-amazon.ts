import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchAmazonReviews, isApifyConfigured, type AmazonReviewItem } from "@/lib/apify";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";
import { calculateStaggerDelay, formatStaggerDuration, addJitter, getStaggerWindow } from "../utils/stagger";

/**
 * Monitor Amazon product reviews
 *
 * For Amazon monitors, platformUrls.amazonreviews should contain an Amazon product URL or ASIN.
 * Example: https://amazon.com/dp/B08N5WRWNW or just B08N5WRWNW
 *
 * Runs every hour - shouldProcessMonitor() handles tier-based delays:
 * - Team: every 2 hours
 * - Pro: every 4 hours
 * - Free: every 24 hours (but Amazon is Pro+ only)
 */
export const monitorAmazon = inngest.createFunction(
  {
    id: "monitor-amazon",
    name: "Monitor Amazon Reviews",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Amazon monitoring" };
    }

    // Get all active monitors that include Amazon Reviews
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const amazonMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("amazonreviews")
    );

    if (amazonMonitors.length === 0) {
      return { message: "No active Amazon Reviews monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    // Calculate stagger window for high-volume Amazon processing
    const staggerWindow = getStaggerWindow("amazonreviews");

    for (let i = 0; i < amazonMonitors.length; i++) {
      const monitor = amazonMonitors[i];

      // Stagger execution to prevent thundering herd
      if (i > 0 && amazonMonitors.length > 3) {
        const baseDelay = calculateStaggerDelay(i, amazonMonitors.length, staggerWindow);
        const delayWithJitter = addJitter(baseDelay, 10);
        const delayStr = formatStaggerDuration(delayWithJitter);
        await step.sleep(`stagger-${monitor.id}`, delayStr);
      }

      // Check if user has access to Amazon Reviews platform
      const access = await canAccessPlatform(monitor.userId, "amazonreviews");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay based on tier
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // Get product URL/ASIN from platformUrls or keywords
      let productUrl: string | null = null;

      // Check platformUrls first
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.amazonreviews) {
        productUrl = platformUrls.amazonreviews;
      }
      // Fallback: Check keywords for Amazon URLs or ASINs
      else if (monitor.keywords && monitor.keywords.length > 0) {
        const amazonUrl = monitor.keywords.find(
          (k) => k.includes("amazon.com") || k.includes("amazon.") || /^[A-Z0-9]{10}$/i.test(k)
        );
        if (amazonUrl) productUrl = amazonUrl;
      }

      if (!productUrl) {
        continue; // No valid Amazon URL/ASIN
      }

      // Fetch reviews
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          const fetchedReviews = await fetchAmazonReviews(productUrl!, 30);
          return fetchedReviews;
        } catch (error) {
          console.error(`Error fetching Amazon reviews for ${productUrl}:`, error);
          return [] as AmazonReviewItem[];
        }
      });

      // Save reviews as results and collect IDs for AI analysis
      const newResultIds: string[] = [];

      if (reviews.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          for (const review of reviews) {
            const sourceUrl = review.url || `amazon-review-${review.reviewId}`;

            // Check if we already have this result
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, sourceUrl),
            });

            if (!existing) {
              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "amazonreviews",
                sourceUrl,
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
                  platform: "amazonreviews",
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
      message: `Scanned Amazon, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
