import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchPlayStoreReviews, isApifyConfigured, type PlayStoreReviewItem } from "@/lib/apify";

/**
 * Monitor Google Play Store reviews for Android apps
 *
 * For Play Store monitors, the "keywords" field stores Play Store URLs
 * or package IDs to monitor (e.g., "com.example.app" or "https://play.google.com/store/apps/details?id=com.example.app")
 *
 * Runs every 6 hours since Play Store reviews update less frequently
 */
export const monitorPlayStore = inngest.createFunction(
  {
    id: "monitor-playstore",
    name: "Monitor Play Store",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour (tier-based delays apply)
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Play Store monitoring" };
    }

    // Get all active monitors that include Play Store
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const playStoreMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("playstore")
    );

    if (playStoreMonitors.length === 0) {
      return { message: "No active Play Store monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of playStoreMonitors) {
      // Check if user has access to Play Store platform
      const access = await canAccessPlatform(monitor.userId, "playstore");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // For Play Store, check platformUrls first, then fall back to keywords
      let appUrl: string | null = null;

      // Check platformUrls (new field)
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.playstore) {
        appUrl = platformUrls.playstore;
      }
      // Fallback: Check keywords for Play Store URLs or package IDs
      else if (monitor.keywords && monitor.keywords.length > 0) {
        appUrl = monitor.keywords.find(
          (k) => k.includes("play.google.com") || k.includes(".")
        ) || null;
      }

      if (!appUrl) {
        continue; // No valid app identifier
      }

      const reviews = await step.run(`fetch-reviews-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
        try {
          const fetchedReviews = await fetchPlayStoreReviews(appUrl!, 20);
          return fetchedReviews;
        } catch (error) {
          console.error(`Error fetching Play Store reviews for ${appUrl}:`, error);
          return [] as PlayStoreReviewItem[];
        }
      });

      // Save reviews as results
      if (reviews.length > 0) {
          await step.run(`save-results-${monitor.id}-${appUrl.slice(0, 20)}`, async () => {
            for (const review of reviews) {
              // Generate a unique URL for deduplication
              const reviewUrl = review.url || `playstore-${review.reviewId}`;

              // Check if we already have this result
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, reviewUrl),
              });

              if (!existing) {
                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "playstore",
                  sourceUrl: reviewUrl,
                  title: `${review.score}-star review`,
                  content: review.text,
                  author: review.userName,
                  postedAt: review.date ? new Date(review.date) : new Date(),
                  metadata: {
                    playStoreId: review.reviewId,
                    rating: review.score,
                    appVersion: review.appVersion,
                    thumbsUpCount: review.thumbsUpCount,
                    hasReply: !!review.replyText,
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
      message: `Scanned Play Store, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
