/**
 * Apify API client for scraping reviews and Q&A platforms
 *
 * Uses Apify actors to scrape data:
 * - Google Reviews: compass/google-maps-reviews-scraper
 * - Trustpilot: epctex/trustpilot-scraper
 * - App Store: alexey/app-store-scraper
 * - Play Store: epctex/google-play-scraper
 * - Quora: jupri/quora-scraper
 */

const APIFY_API_BASE = "https://api.apify.com/v2";

// Actor IDs for different scrapers
const ACTORS = {
  googleReviews: "compass/google-maps-reviews-scraper",
  trustpilot: "epctex/trustpilot-scraper",
  appStore: "alexey/app-store-scraper",
  playStore: "epctex/google-play-scraper",
  quora: "jupri/quora-scraper",
} as const;

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

// ApifyDatasetResponse type for typed dataset results (if needed in future)
// interface ApifyDatasetResponse<T> { data: T[]; }

interface GoogleReviewItem {
  reviewId: string;
  name: string;
  text: string;
  publishedAtDate: string;
  stars: number;
  reviewUrl: string;
  reviewerUrl?: string;
  placeId?: string;
}

interface TrustpilotReviewItem {
  id: string;
  title: string;
  text: string;
  rating: number;
  date: string;
  author: string;
  authorLocation?: string;
  url: string;
}

interface AppStoreReviewItem {
  id: string;
  title: string;
  text: string;
  rating: number;
  date: string;
  userName: string;
  version?: string;
  appId?: string;
  url?: string;
}

interface PlayStoreReviewItem {
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

interface QuoraAnswerItem {
  questionId: string;
  questionTitle: string;
  questionUrl: string;
  answerId?: string;
  answerText: string;
  answerAuthor: string;
  answerDate: string;
  upvotes?: number;
  views?: number;
  answerUrl?: string;
}

function getApiKey(): string {
  const key = process.env.APIFY_API_KEY;
  if (!key) {
    throw new Error("APIFY_API_KEY is not configured");
  }
  return key;
}

/**
 * Start an Apify actor run and wait for completion
 */
async function runActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs: number = 120000
): Promise<T[]> {
  const apiKey = getApiKey();

  // Start the actor run
  const runResponse = await fetch(
    `${APIFY_API_BASE}/acts/${actorId}/runs?token=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const error = await runResponse.text();
    throw new Error(`Failed to start Apify actor: ${error}`);
  }

  const runData: ApifyRunResponse = await runResponse.json();
  const runId = runData.data.id;
  const datasetId = runData.data.defaultDatasetId;

  // Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const statusResponse = await fetch(
      `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiKey}`
    );

    if (!statusResponse.ok) {
      throw new Error("Failed to check actor run status");
    }

    const statusData: ApifyRunResponse = await statusResponse.json();
    const status = statusData.data.status;

    if (status === "SUCCEEDED") {
      // Get results from dataset
      const datasetResponse = await fetch(
        `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiKey}`
      );

      if (!datasetResponse.ok) {
        throw new Error("Failed to fetch dataset results");
      }

      const items: T[] = await datasetResponse.json();
      return items;
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Actor run ${status}`);
    }

    // Wait 2 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Actor run timed out");
}

/**
 * Fetch Google Reviews for a business
 * @param placeUrl - Google Maps URL or place ID
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 */
export async function fetchGoogleReviews(
  placeUrl: string,
  maxReviews: number = 50
): Promise<GoogleReviewItem[]> {
  const input = {
    startUrls: [{ url: placeUrl }],
    maxReviews,
    reviewsSort: "newest",
    language: "en",
  };

  return runActor<GoogleReviewItem>(ACTORS.googleReviews, input);
}

/**
 * Fetch Trustpilot reviews for a company
 * @param companyUrl - Trustpilot company URL (e.g., https://www.trustpilot.com/review/example.com)
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 */
export async function fetchTrustpilotReviews(
  companyUrl: string,
  maxReviews: number = 50
): Promise<TrustpilotReviewItem[]> {
  // Ensure URL is in correct format
  const url = companyUrl.startsWith("https://")
    ? companyUrl
    : `https://www.trustpilot.com/review/${companyUrl}`;

  const input = {
    startUrls: [{ url }],
    maxItems: maxReviews,
  };

  return runActor<TrustpilotReviewItem>(ACTORS.trustpilot, input);
}

/**
 * Fetch App Store reviews for an app
 * @param appUrl - App Store URL or app ID
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 */
export async function fetchAppStoreReviews(
  appUrl: string,
  maxReviews: number = 50
): Promise<AppStoreReviewItem[]> {
  // Support both full URLs and app IDs
  // URL format: https://apps.apple.com/us/app/app-name/id123456789
  // App ID format: id123456789 or just 123456789
  let appId = appUrl;

  if (appUrl.includes("apps.apple.com")) {
    // Extract app ID from URL
    const match = appUrl.match(/id(\d+)/);
    if (match) {
      appId = match[1];
    }
  } else if (appUrl.startsWith("id")) {
    appId = appUrl.slice(2);
  }

  const input = {
    appId,
    country: "us",
    maxReviews,
    sort: "mostRecent",
  };

  return runActor<AppStoreReviewItem>(ACTORS.appStore, input);
}

/**
 * Fetch Google Play Store reviews for an app
 * @param appUrl - Play Store URL or package ID
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 */
export async function fetchPlayStoreReviews(
  appUrl: string,
  maxReviews: number = 50
): Promise<PlayStoreReviewItem[]> {
  // Support both full URLs and package IDs
  // URL format: https://play.google.com/store/apps/details?id=com.example.app
  // Package ID format: com.example.app
  let packageId = appUrl;

  if (appUrl.includes("play.google.com")) {
    // Extract package ID from URL
    const match = appUrl.match(/id=([a-zA-Z0-9_.]+)/);
    if (match) {
      packageId = match[1];
    }
  }

  const input = {
    startUrls: [{ url: `https://play.google.com/store/apps/details?id=${packageId}` }],
    maxReviews,
    sort: "newest",
  };

  return runActor<PlayStoreReviewItem>(ACTORS.playStore, input);
}

/**
 * Fetch Quora answers for a search query
 * @param query - Search query to find relevant questions/answers
 * @param maxResults - Maximum number of results to fetch (default 30)
 * @param sessionCookie - Optional Quora m-b session cookie for authenticated access
 *
 * Note: Quora requires authentication for search results. Without session cookies,
 * results may be limited. Users can provide their Quora session cookie for full access.
 */
export async function fetchQuoraAnswers(
  query: string,
  maxResults: number = 30,
  sessionCookie?: string
): Promise<QuoraAnswerItem[]> {
  const input: Record<string, unknown> = {
    searchQueries: [query],
    maxResults,
    searchType: "answer", // Focus on answers which contain the most insight
    sortBy: "time", // Most recent first
  };

  // Add session cookie if provided for authenticated access
  if (sessionCookie) {
    input.sessionCookie = sessionCookie;
  }

  return runActor<QuoraAnswerItem>(ACTORS.quora, input);
}

/**
 * Check if Apify is configured
 */
export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_KEY;
}

// Export types for use in monitor functions
export type { GoogleReviewItem, TrustpilotReviewItem, AppStoreReviewItem, PlayStoreReviewItem, QuoraAnswerItem };
