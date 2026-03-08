/**
 * YouTube Data API v3 Integration Module
 *
 * Uses Google's official YouTube Data API to fetch video comments.
 * This is legally compliant — official API with free quota.
 *
 * Free quota: 10,000 units/day
 * commentThreads.list costs 1 unit per request (up to 100 comments each)
 * = ~1,000,000 comments/day for free
 *
 * Setup:
 * 1. Go to https://console.cloud.google.com
 * 2. Enable "YouTube Data API v3"
 * 3. Create an API key (no OAuth needed for public comments)
 * 4. Add YOUTUBE_API_KEY to .env.local
 */

import { cachedQuery, CACHE_TTL } from "@/lib/cache";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface YouTubeCommentItem {
  commentId: string;
  text: string;
  author: string;
  authorChannelUrl?: string;
  publishedAt: string;
  likeCount: number;
  replyCount?: number;
  videoId: string;
  videoTitle?: string;
  videoUrl?: string;
}

interface YouTubeCommentThread {
  id: string;
  snippet: {
    videoId: string;
    topLevelComment: {
      id: string;
      snippet: {
        textDisplay: string;
        textOriginal: string;
        authorDisplayName: string;
        authorChannelUrl?: string;
        likeCount: number;
        publishedAt: string;
        updatedAt: string;
      };
    };
    totalReplyCount: number;
  };
}

interface YouTubeCommentThreadResponse {
  items?: YouTubeCommentThread[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
  error?: {
    code: number;
    message: string;
    errors: Array<{ reason: string; domain: string; message: string }>;
  };
}

interface YouTubeVideoResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
    };
  }>;
}

// ============================================================================
// API
// ============================================================================

/**
 * Check if YouTube Data API is configured
 */
export function isYouTubeApiConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

/**
 * Extract video ID from a YouTube URL
 */
export function extractVideoId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // If it's already just a video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * Fetch video title from YouTube Data API
 */
async function fetchVideoTitle(
  videoId: string,
  apiKey: string
): Promise<string | undefined> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${apiKey}&fields=items(id,snippet/title)`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

    if (!response.ok) return undefined;

    const data: YouTubeVideoResponse = await response.json();
    return data.items?.[0]?.snippet?.title;
  } catch {
    return undefined;
  }
}

/**
 * Fetch comments for a YouTube video using the official Data API v3
 *
 * @param videoUrl - YouTube video URL or video ID
 * @param limit - Max comments to fetch (default 50, max 100 per request)
 */
export async function fetchYouTubeCommentsApi(
  videoUrl: string,
  limit: number = 50
): Promise<YouTubeCommentItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY not configured");
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    logger.warn("[YouTube] Could not extract video ID from URL", { videoUrl });
    return [];
  }

  // Use caching to reduce API quota usage
  const { data: comments, cached } = await cachedQuery<YouTubeCommentItem[]>(
    "youtube:comments",
    { videoId, limit },
    async () => {
      const allComments: YouTubeCommentItem[] = [];
      let pageToken: string | undefined;
      let remaining = limit;

      // Fetch video title once (costs 1 unit)
      const videoTitle = await fetchVideoTitle(videoId, apiKey);

      // Paginate through comments (each page costs 1 unit)
      while (remaining > 0) {
        const perPage = Math.min(remaining, 100);
        let url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=${perPage}&order=time&textFormat=plainText&key=${apiKey}`;

        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

        if (!response.ok) {
          const errorText = await response.text();
          // Handle specific errors gracefully
          if (response.status === 403) {
            logger.warn("[YouTube] Comments disabled or quota exceeded", {
              videoId,
              status: response.status,
            });
            break;
          }
          throw new Error(
            `YouTube API error: ${response.status} - ${errorText}`
          );
        }

        const data: YouTubeCommentThreadResponse = await response.json();

        if (data.error) {
          throw new Error(
            `YouTube API error: ${data.error.code} - ${data.error.message}`
          );
        }

        if (!data.items || data.items.length === 0) break;

        for (const thread of data.items) {
          const comment = thread.snippet.topLevelComment.snippet;
          allComments.push({
            commentId: thread.snippet.topLevelComment.id,
            text: comment.textOriginal || comment.textDisplay,
            author: comment.authorDisplayName,
            authorChannelUrl: comment.authorChannelUrl,
            publishedAt: comment.publishedAt,
            likeCount: comment.likeCount,
            replyCount: thread.snippet.totalReplyCount,
            videoId,
            videoTitle,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          });
        }

        remaining -= data.items.length;
        pageToken = data.nextPageToken ?? undefined;
        if (!pageToken) break;
      }

      return allComments;
    },
    CACHE_TTL.REVIEWS // 6 hours — comments don't change that frequently
  );

  if (cached) {
    logger.debug("[YouTube] API cache hit", { videoId });
  }

  return comments;
}
