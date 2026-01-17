import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchAppStoreReviews, isApifyConfigured, type AppStoreReviewItem } from "@/lib/apify";

/**
 * Monitor App Store reviews for iOS apps
 *
 * For App Store monitors, the "keywords" field stores App Store URLs
 * or app IDs to monitor (e.g., "id123456789" or "https://apps.apple.com/us/app/app-name/id123456789")
 *
 * Runs every 6 hours since App Store reviews update less frequently
 */
export const monitorAppStore = inngest.createFunction(
  {
    id: "monitor-appstore",
    name: "Monitor App Store",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour (tier-based delays apply)
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping App Store monitoring" };
    }

    // Get all active monitors that include App Store
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const appStoreMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("appstore")
    );

    if (appStoreMonitors.length === 0) {
      return { message: "No active App Store monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of appStoreMonitors) {
      // Check if user has access to App Store platform
      const access = await canAccessPlatform(monitor.userId, "appstore");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // For App Store, keywords are app URLs or IDs to monitor
      for (const appUrl of monitor.keywords) {
        const reviews = await step.run(`fetch-reviews-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
          try {
            const fetchedReviews = await fetchAppStoreReviews(appUrl, 20);
            return fetchedReviews;
          } catch (error) {
            console.error(`Error fetching App Store reviews for ${appUrl}:`, error);
            return [] as AppStoreReviewItem[];
          }
        });

        // Save reviews as results
        if (reviews.length > 0) {
          await step.run(`save-results-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
            for (const review of reviews) {
              // Generate a unique URL for deduplication
              const reviewUrl = review.url || `appstore-${review.appId || 'unknown'}-${review.id}`;

              // Check if we already have this result
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, reviewUrl),
              });

              if (!existing) {
                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "appstore",
                  sourceUrl: reviewUrl,
                  title: review.title || `${review.rating}-star review`,
                  content: review.text,
                  author: review.userName,
                  postedAt: review.date ? new Date(review.date) : new Date(),
                  metadata: {
                    appStoreId: review.id,
                    appId: review.appId,
                    rating: review.rating,
                    appVersion: review.version,
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
      message: `Scanned App Store, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
