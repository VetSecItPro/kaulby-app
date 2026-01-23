import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchG2Reviews, isApifyConfigured, type G2ReviewItem } from "@/lib/apify";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";

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
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping G2 monitoring" };
    }

    // Get all active monitors that include G2
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const g2Monitors = activeMonitors.filter((m) =>
      m.platforms.includes("g2")
    );

    if (g2Monitors.length === 0) {
      return { message: "No active G2 monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of g2Monitors) {
      // Check if user has access to G2 platform
      const access = await canAccessPlatform(monitor.userId, "g2");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay based on tier
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // Get product URL from platformUrls or keywords
      let productUrl: string | null = null;

      // Check platformUrls first
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.g2) {
        productUrl = platformUrls.g2;
      }
      // Fallback: Check keywords for G2 URLs
      else if (monitor.keywords && monitor.keywords.length > 0) {
        const g2Url = monitor.keywords.find((k) => k.includes("g2.com"));
        if (g2Url) productUrl = g2Url;
      }

      if (!productUrl) {
        continue; // No valid G2 URL
      }

      // Fetch reviews
      const reviews = await step.run(`fetch-reviews-${monitor.id}`, async () => {
        try {
          const fetchedReviews = await fetchG2Reviews(productUrl!, 30);
          return fetchedReviews;
        } catch (error) {
          console.error(`Error fetching G2 reviews for ${productUrl}:`, error);
          return [] as G2ReviewItem[];
        }
      });

      // Save reviews as results and collect IDs for AI analysis
      const newResultIds: string[] = [];

      if (reviews.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          for (const review of reviews) {
            const sourceUrl = review.url || `g2-review-${review.reviewId}`;

            // Check if we already have this result
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, sourceUrl),
            });

            if (!existing) {
              // Combine pros/cons with main text
              let content = review.text;
              if (review.pros) content += `\n\nPros: ${review.pros}`;
              if (review.cons) content += `\n\nCons: ${review.cons}`;

              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "g2",
                sourceUrl,
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
                  platform: "g2",
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
      message: `Scanned G2, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
