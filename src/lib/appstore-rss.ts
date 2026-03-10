/**
 * Apple App Store RSS Feed Integration
 *
 * Uses Apple's free, official RSS feed to fetch app reviews.
 * No scraping, no API key needed — completely free and legal.
 *
 * Feed URL format:
 *   https://itunes.apple.com/{country}/rss/customerreviews/id={appId}/sortBy=mostRecent/json
 *
 * Returns up to 50 most recent reviews per request.
 */

import { logger } from "@/lib/logger";

export interface AppStoreRssReview {
  id: string;
  title: string;
  text: string;
  rating: number;
  date: string;
  userName: string;
  version?: string;
  appId?: string;
  url?: string;
  voteSum?: number;
  voteCount?: number;
}

interface RssEntry {
  author?: { name?: { label?: string } };
  updated?: { label?: string };
  "im:rating"?: { label?: string };
  "im:version"?: { label?: string };
  id?: { label?: string };
  title?: { label?: string };
  content?: { label?: string };
  link?: { attributes?: { href?: string } } | Array<{ attributes?: { href?: string } }>;
  "im:voteSum"?: { label?: string };
  "im:voteCount"?: { label?: string };
}

interface RssFeed {
  feed?: {
    entry?: RssEntry[];
  };
}

/**
 * Extract Apple App ID from a URL or string.
 * Supports:
 *   - Full URL: https://apps.apple.com/us/app/app-name/id123456789
 *   - ID string: id123456789
 *   - Numeric: 123456789
 */
function extractAppId(input: string): string | null {
  // Full App Store URL
  const urlMatch = input.match(/\/id(\d+)/);
  if (urlMatch) return urlMatch[1];

  // "id" prefix
  if (input.startsWith("id")) {
    const digits = input.slice(2);
    if (/^\d+$/.test(digits)) return digits;
  }

  // Pure numeric
  if (/^\d+$/.test(input)) return input;

  return null;
}

/**
 * Extract country code from App Store URL.
 * Default: "us"
 */
function extractCountry(input: string): string {
  const match = input.match(/apps\.apple\.com\/([a-z]{2})\//i);
  return match?.[1]?.toLowerCase() || "us";
}

/**
 * Fetch App Store reviews via Apple's RSS feed.
 *
 * @param appUrlOrId - App Store URL, app ID (id123456789), or numeric ID
 * @param maxReviews - Max reviews to return (RSS returns up to 50)
 * @returns Array of reviews with full text, rating, author, date, and version
 */
export async function fetchAppStoreRss(
  appUrlOrId: string,
  maxReviews: number = 50
): Promise<AppStoreRssReview[]> {
  const appId = extractAppId(appUrlOrId);
  if (!appId) {
    logger.warn("[AppStore RSS] Could not extract app ID", { input: appUrlOrId });
    return [];
  }

  const country = extractCountry(appUrlOrId);
  const feedUrl = `https://itunes.apple.com/${country}/rss/customerreviews/id=${appId}/sortBy=mostRecent/json`;

  try {
    const response = await fetch(feedUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Kaulby/1.0)",
      },
    });

    if (!response.ok) {
      logger.error("[AppStore RSS] Feed returned error", {
        status: response.status,
        appId,
        country,
      });
      return [];
    }

    const data: RssFeed = await response.json();
    const entries = data.feed?.entry || [];

    // First entry is often the app metadata, not a review — filter by checking for im:rating
    const reviews = entries
      .filter((e) => e["im:rating"]?.label)
      .slice(0, maxReviews)
      .map((entry): AppStoreRssReview => {
        // Handle link being either object or array
        const linkObj = Array.isArray(entry.link) ? entry.link[0] : entry.link;

        return {
          id: entry.id?.label || `appstore-rss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: entry.title?.label || "",
          text: entry.content?.label || "",
          rating: parseInt(entry["im:rating"]?.label || "0", 10),
          date: entry.updated?.label || new Date().toISOString(),
          userName: entry.author?.name?.label || "App Store User",
          version: entry["im:version"]?.label,
          appId,
          url: linkObj?.attributes?.href,
          voteSum: entry["im:voteSum"]?.label ? parseInt(entry["im:voteSum"].label, 10) : undefined,
          voteCount: entry["im:voteCount"]?.label ? parseInt(entry["im:voteCount"].label, 10) : undefined,
        };
      });

    logger.info("[AppStore RSS] Fetched reviews", {
      appId,
      country,
      count: reviews.length,
    });

    return reviews;
  } catch (error) {
    logger.error("[AppStore RSS] Failed to fetch", {
      appId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
