/**
 * Indie Hackers JSON feed parser — shared between cron + on-demand paths.
 *
 * IH publishes https://www.indiehackers.com/feed.json (RSS-in-JSON format).
 * Both the cron monitor and the on-demand scan use this as part of their
 * fetch chain. Extracted here so the parsing logic lives in one place.
 *
 * Cron-specific HTML-scraping fallback stays in monitor-indiehackers.ts.
 * On-demand-specific Serper-first strategy stays in scan-on-demand.ts.
 */
import { logger } from "@/lib/logger";

export interface IndieHackersPost {
  id: string;
  title: string;
  body: string;
  author: string;
  url: string;
  createdAt: string;
  upvotes: number;
  commentCount: number;
  category?: string;
}

export interface IHFeedResult {
  posts: IndieHackersPost[];
  httpStatus?: number;
  errorMessage?: string;
}

/**
 * Fetch + parse Indie Hackers' public JSON feed.
 * Returns {posts: []} on any HTTP error so callers can cleanly chain to
 * their platform-specific fallback strategy (Serper, HTML scrape, etc).
 */
export async function fetchIndieHackersFeed(maxPosts: number = 50): Promise<IHFeedResult> {
  try {
    const response = await fetch("https://www.indiehackers.com/feed.json", {
      headers: {
        "User-Agent": "Kaulby/1.0 (Community Monitoring Tool)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    const httpStatus = response.status;

    if (!response.ok) {
      return { posts: [], httpStatus, errorMessage: `feed HTTP ${httpStatus}` };
    }

    const data = await response.json();
    const posts: IndieHackersPost[] = [];

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items.slice(0, maxPosts)) {
        posts.push({
          id: item.id || item.url || "",
          title: item.title || "",
          body: item.content_text || item.content_html || "",
          author: item.author?.name || item.authors?.[0]?.name || "Unknown",
          url: item.url || "",
          createdAt: item.date_published || new Date().toISOString(),
          upvotes: 0, // not available in feed
          commentCount: 0, // not available in feed
          category: item.tags?.[0] || undefined,
        });
      }
    }

    return { posts, httpStatus };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[IndieHackers] feed fetch failed", { error: errorMessage });
    return { posts: [], errorMessage };
  }
}
