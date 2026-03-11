import { inngest } from "../client";
import { logger } from "@/lib/logger";
import {
  fetchYouTubeCommentsApi,
  isYouTubeApiConfigured,
  type YouTubeCommentItem,
} from "@/lib/youtube";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  updateSkippedMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  type MonitorStep,
} from "../utils/monitor-helpers";

/**
 * Monitor YouTube video comments via official YouTube Data API v3
 *
 * Uses Google's official API — legally compliant, free quota (10k units/day).
 *
 * For YouTube monitors, platformUrls.youtube should contain a YouTube video URL.
 * Alternatively, keywords can contain YouTube video URLs to monitor.
 */
export const monitorYouTube = inngest.createFunction(
  {
    id: "monitor-youtube",
    name: "Monitor YouTube Comments",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 */2 * * *" }, // Every 2 hours (matches fastest plan tier)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isYouTubeApiConfigured()) {
      return { message: "YouTube API key not configured, skipping YouTube monitoring" };
    }

    const youtubeMonitors = await getActiveMonitors("youtube", step);
    if (youtubeMonitors.length === 0) {
      return { message: "No active YouTube monitors" };
    }

    const planMap = await prefetchPlans(youtubeMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < youtubeMonitors.length; i++) {
      const monitor = youtubeMonitors[i];

      await applyStagger(i, youtubeMonitors.length, "youtube", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "youtube")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Get video URL from platformUrls or keywords
      let videoUrl: string | null = null;
      const platformUrls = monitor.platformUrls as Record<string, string> | null;
      if (platformUrls?.youtube) {
        videoUrl = platformUrls.youtube;
      } else if (monitor.keywords && monitor.keywords.length > 0) {
        const ytUrl = monitor.keywords.find(
          (k) => k.includes("youtube.com") || k.includes("youtu.be")
        );
        if (ytUrl) videoUrl = ytUrl;
      }
      if (!videoUrl) continue;

      // Fetch comments via YouTube Data API v3
      const comments = await step.run(`fetch-comments-${monitor.id}`, async () => {
        try {
          return await fetchYouTubeCommentsApi(videoUrl!, 50);
        } catch (error) {
          logger.error("[YouTube] Error fetching comments via API", { videoUrl, error: error instanceof Error ? error.message : String(error) });
          return [] as YouTubeCommentItem[];
        }
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<YouTubeCommentItem>({
        items: comments,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (c) =>
          `https://www.youtube.com/watch?v=${c.videoId}&lc=${c.commentId}`,
        mapToResult: (c) => ({
          monitorId: monitor.id,
          platform: "youtube" as const,
          sourceUrl: `https://www.youtube.com/watch?v=${c.videoId}&lc=${c.commentId}`,
          title: c.videoTitle || "YouTube Comment",
          content: c.text,
          author: c.author,
          postedAt: c.publishedAt ? new Date(c.publishedAt) : new Date(),
          metadata: {
            commentId: c.commentId,
            videoId: c.videoId,
            likeCount: c.likeCount,
            replyCount: c.replyCount,
            authorChannelUrl: c.authorChannelUrl,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "youtube", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned YouTube via API, found ${totalResults} new comments`,
      totalResults,
      monitorResults,
    };
  }
);
