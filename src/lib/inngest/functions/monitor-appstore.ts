import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchAppStoreReviews, isApifyConfigured, type AppStoreReviewItem } from "@/lib/apify";
import { isMonitorScheduleActive } from "@/lib/monitor-schedule";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";

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

      // Check if monitor is within its active schedule
      if (!isMonitorScheduleActive(monitor)) {
        continue;
      }

      let monitorMatchCount = 0;
      const newResultIds: string[] = [];

      // For App Store, check platformUrls first, then fall back to keywords
      let appUrl: string | null = null;

      // Check platformUrls (new field)
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.appstore) {
        appUrl = platformUrls.appstore;
      }
      // Fallback: Check keywords for App Store URLs or IDs
      else if (monitor.keywords && monitor.keywords.length > 0) {
        appUrl = monitor.keywords.find(
          (k) => k.includes("apps.apple.com") || k.startsWith("id") || /^\d+$/.test(k)
        ) || null;
      }

      if (!appUrl) {
        continue; // No valid app identifier
      }

      const reviews = await step.run(`fetch-reviews-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
        try {
          const fetchedReviews = await fetchAppStoreReviews(appUrl!, 20);
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
                newResultIds.push(newResult.id);

                // Increment usage count for the user
                await incrementResultsCount(monitor.userId, 1);
              }
            }
          });
        }

      // Trigger AI analysis - batch mode for large volumes, individual for small
      if (newResultIds.length > 0) {
        await step.run(`trigger-analysis-${monitor.id}`, async () => {
          if (newResultIds.length > AI_BATCH_CONFIG.BATCH_THRESHOLD) {
            // Batch mode for cost efficiency (>50 results)
            await inngest.send({
              name: "content/analyze-batch",
              data: {
                monitorId: monitor.id,
                userId: monitor.userId,
                platform: "appstore",
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
