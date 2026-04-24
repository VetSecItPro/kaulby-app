/**
 * Google Play Store review fetching
 *
 * Free self-hosted alternative to Apify for Play Store reviews. Uses the
 * `google-play-scraper` npm package (facundoolano), which scrapes the public
 * Play Store web pages directly — no API key required.
 *
 * Migrated from Apify (neatrat/google-play-store-reviews-scraper) 2026-04-23
 * to eliminate per-run Apify cost on this platform.
 */

import gplay from "google-play-scraper";
import { logger } from "@/lib/logger";

export interface PlayStoreReviewItem {
  reviewId: string;
  userName: string;
  text: string;
  score: number;
  date: string;
  thumbsUpCount?: number;
  replyText?: string;
  replyDate?: string;
  appVersion?: string;
  url?: string;
}

/**
 * Extract the Android package ID from a Play Store URL, or return the input
 * if it already looks like a package ID (e.g. "com.example.app").
 */
function extractAppId(urlOrId: string): string {
  if (urlOrId.includes("play.google.com")) {
    const match = urlOrId.match(/[?&]id=([^&]+)/);
    if (!match) {
      throw new Error(`Invalid Play Store URL (no id param): ${urlOrId}`);
    }
    return match[1];
  }
  return urlOrId;
}

interface GPlayReview {
  id: string;
  userName: string;
  userImage?: string;
  date: string;
  score: number;
  scoreText?: string;
  url?: string;
  title?: string;
  text: string;
  replyDate?: string;
  replyText?: string;
  version?: string;
  thumbsUp?: number;
}

/**
 * Fetch Play Store reviews for an Android app.
 *
 * @param appUrlOrId Full Play Store URL or package ID (e.g. "com.example.app")
 * @param maxReviews Maximum reviews to return. Capped at 150 (library limit).
 *
 * The library returns reviews sorted by NEWEST. The `throttle` option keeps
 * the request rate polite (10 req/sec per upstream docs).
 */
export async function fetchPlayStoreReviews(
  appUrlOrId: string,
  maxReviews: number = 50,
): Promise<PlayStoreReviewItem[]> {
  const appId = extractAppId(appUrlOrId);
  // Library's `num` parameter caps at 150 per upstream — silently clamp so
  // callers don't get surprised by truncation with a thrown error.
  const cappedNum = Math.min(maxReviews, 150);

  try {
    // The library's `.d.ts` types `gplay.sort` as the enum member type rather
    // than the enum container, so `gplay.sort.NEWEST` fails to type-check even
    // though it exists at runtime. Use the numeric constant directly
    // (NEWEST = 2 in lib/constants.js) to avoid a cast.
    const result = await gplay.reviews({
      appId,
      sort: 2,
      num: cappedNum,
      throttle: 10,
    });

    const data = (result.data ?? []) as GPlayReview[];

    logger.info("[PlayStore] Fetched reviews", {
      appId,
      count: data.length,
      requested: cappedNum,
    });

    return data.map((r) => ({
      reviewId: r.id,
      userName: r.userName,
      text: r.text ?? "",
      score: r.score,
      date: typeof r.date === "string" ? r.date : new Date(r.date).toISOString(),
      thumbsUpCount: r.thumbsUp,
      replyText: r.replyText,
      replyDate:
        r.replyDate == null
          ? undefined
          : typeof r.replyDate === "string"
            ? r.replyDate
            : new Date(r.replyDate).toISOString(),
      appVersion: r.version,
      url: r.url,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[PlayStore] Failed to fetch reviews", { appId, error: message });
    throw new Error(`Failed to fetch Play Store reviews for ${appId}: ${message}`);
  }
}
