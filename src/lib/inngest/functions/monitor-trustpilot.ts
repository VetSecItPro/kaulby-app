import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchTrustpilotReviews, isApifyConfigured, type TrustpilotReviewItem } from "@/lib/apify";

/**
 * Monitor Trustpilot reviews for companies
 *
 * For Trustpilot monitors, the "keywords" field stores Trustpilot URLs
 * or company domains to monitor (e.g., "example.com" or "https://trustpilot.com/review/example.com")
 *
 * Runs every 4 hours since Trustpilot reviews update more frequently than Google
 */
export const monitorTrustpilot = inngest.createFunction(
  {
    id: "monitor-trustpilot",
    name: "Monitor Trustpilot",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour (tier-based delays apply)
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Trustpilot monitoring" };
    }

    // Get all active monitors that include Trustpilot
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const trustpilotMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("trustpilot")
    );

    if (trustpilotMonitors.length === 0) {
      return { message: "No active Trustpilot monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of trustpilotMonitors) {
      // Check if user has access to Trustpilot platform
      const access = await canAccessPlatform(monitor.userId, "trustpilot");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // For Trustpilot, keywords are company URLs or domains to monitor
      for (const companyUrl of monitor.keywords) {
        const reviews = await step.run(`fetch-reviews-${monitor.id}-${companyUrl.slice(0, 20)}`, async () => {
          try {
            const fetchedReviews = await fetchTrustpilotReviews(companyUrl, 20);
            return fetchedReviews;
          } catch (error) {
            console.error(`Error fetching Trustpilot reviews for ${companyUrl}:`, error);
            return [] as TrustpilotReviewItem[];
          }
        });

        // Save reviews as results
        if (reviews.length > 0) {
          await step.run(`save-results-${monitor.id}-${companyUrl.slice(0, 20)}`, async () => {
            for (const review of reviews) {
              // Check if we already have this result
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, review.url || `trustpilot-${review.id}`),
              });

              if (!existing) {
                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "trustpilot",
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
      message: `Scanned Trustpilot, found ${totalResults} new reviews`,
      totalResults,
      monitorResults,
    };
  }
);
