import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchYouTubeComments, isApifyConfigured, type YouTubeCommentItem } from "@/lib/apify";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";

/**
 * Monitor YouTube video comments
 *
 * For YouTube monitors, platformUrls.youtube should contain a YouTube video URL.
 * Alternatively, keywords can contain YouTube video URLs to monitor.
 *
 * Runs every hour - shouldProcessMonitor() handles tier-based delays:
 * - Team: every 2 hours
 * - Pro: every 4 hours
 * - Free: every 24 hours (but YouTube is Pro+ only)
 */
export const monitorYouTube = inngest.createFunction(
  {
    id: "monitor-youtube",
    name: "Monitor YouTube Comments",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping YouTube monitoring" };
    }

    // Get all active monitors that include YouTube
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const youtubeMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("youtube")
    );

    if (youtubeMonitors.length === 0) {
      return { message: "No active YouTube monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of youtubeMonitors) {
      // Check if user has access to YouTube platform
      const access = await canAccessPlatform(monitor.userId, "youtube");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay based on tier
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // Get video URL from platformUrls or keywords
      let videoUrl: string | null = null;

      // Check platformUrls first
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.youtube) {
        videoUrl = platformUrls.youtube;
      }
      // Fallback: Check keywords for YouTube URLs
      else if (monitor.keywords && monitor.keywords.length > 0) {
        const ytUrl = monitor.keywords.find(
          (k) => k.includes("youtube.com") || k.includes("youtu.be")
        );
        if (ytUrl) videoUrl = ytUrl;
      }

      if (!videoUrl) {
        continue; // No valid YouTube URL
      }

      // Fetch comments
      const comments = await step.run(`fetch-comments-${monitor.id}`, async () => {
        try {
          const fetchedComments = await fetchYouTubeComments(videoUrl!, 50);
          return fetchedComments;
        } catch (error) {
          console.error(`Error fetching YouTube comments for ${videoUrl}:`, error);
          return [] as YouTubeCommentItem[];
        }
      });

      // Save comments as results and collect IDs for AI analysis
      const newResultIds: string[] = [];

      if (comments.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          for (const comment of comments) {
            const sourceUrl = `https://www.youtube.com/watch?v=${comment.videoId}&lc=${comment.commentId}`;

            // Check if we already have this result
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, sourceUrl),
            });

            if (!existing) {
              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "youtube",
                sourceUrl,
                title: comment.videoTitle || "YouTube Comment",
                content: comment.text,
                author: comment.author,
                postedAt: comment.publishedAt ? new Date(comment.publishedAt) : new Date(),
                metadata: {
                  commentId: comment.commentId,
                  videoId: comment.videoId,
                  likeCount: comment.likeCount,
                  replyCount: comment.replyCount,
                  authorChannelUrl: comment.authorChannelUrl,
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
                  platform: "youtube",
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
      message: `Scanned YouTube, found ${totalResults} new comments`,
      totalResults,
      monitorResults,
    };
  }
);
