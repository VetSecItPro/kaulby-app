import { inngest } from "../client";
import { fetchYouTubeComments, isApifyConfigured, type YouTubeCommentItem } from "@/lib/apify";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  type MonitorStep,
} from "../utils/monitor-helpers";

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
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 * * * *" },
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping YouTube monitoring" };
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
      if (shouldSkipMonitor(monitor, planMap, "youtube")) continue;

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

      // Fetch comments (platform-specific)
      const comments = await step.run(`fetch-comments-${monitor.id}`, async () => {
        try {
          return await fetchYouTubeComments(videoUrl!, 50);
        } catch (error) {
          console.error(`Error fetching YouTube comments for ${videoUrl}:`, error);
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
      message: `Scanned YouTube, found ${totalResults} new comments`,
      totalResults,
      monitorResults,
    };
  }
);
