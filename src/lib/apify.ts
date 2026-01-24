/**
 * Apify API client for scraping reviews and Q&A platforms
 *
 * Uses Apify actors to scrape data:
 * - Reddit: trudax/reddit-scraper (fallback when API fails)
 * - Google Reviews: compass/google-maps-reviews-scraper
 * - Trustpilot: epctex/trustpilot-scraper
 * - App Store: alexey/app-store-scraper
 * - Play Store: epctex/google-play-scraper
 * - Quora: jupri/quora-scraper
 *
 * Includes:
 * - Circuit breaker pattern for API resilience
 * - Rate limit tracking from API headers
 * - Automatic fallback to Apify when official APIs fail
 */

const APIFY_API_BASE = "https://api.apify.com/v2";

// ============================================
// Circuit Breaker Pattern for API Resilience
// ============================================

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailure: number | null;
  nextRetry: number | null;
}

// In-memory circuit breakers (per-platform)
const circuitBreakers: Map<string, CircuitBreaker> = new Map();

const CIRCUIT_CONFIG = {
  failureThreshold: 5,     // Open circuit after 5 consecutive failures
  resetTimeout: 60000,     // Try again after 1 minute
  halfOpenRetries: 2,      // Allow 2 retries in half-open state
};

function getCircuitBreaker(platform: string): CircuitBreaker {
  if (!circuitBreakers.has(platform)) {
    circuitBreakers.set(platform, {
      state: "closed",
      failures: 0,
      lastFailure: null,
      nextRetry: null,
    });
  }
  return circuitBreakers.get(platform)!;
}

/**
 * Check if circuit allows requests for a platform
 */
export function canMakeRequest(platform: string): { allowed: boolean; reason?: string } {
  const breaker = getCircuitBreaker(platform);
  const now = Date.now();

  switch (breaker.state) {
    case "closed":
      return { allowed: true };

    case "open":
      if (breaker.nextRetry && now >= breaker.nextRetry) {
        breaker.state = "half-open";
        breaker.failures = 0;
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Circuit open for ${platform}. Retry at ${new Date(breaker.nextRetry!).toISOString()}`,
      };

    case "half-open":
      if (breaker.failures < CIRCUIT_CONFIG.halfOpenRetries) {
        return { allowed: true };
      }
      breaker.state = "open";
      breaker.nextRetry = now + CIRCUIT_CONFIG.resetTimeout;
      return {
        allowed: false,
        reason: `Circuit re-opened for ${platform}`,
      };
  }
}

/**
 * Record a successful API request
 */
export function recordSuccess(platform: string): void {
  const breaker = getCircuitBreaker(platform);
  if (breaker.state === "half-open") {
    breaker.state = "closed";
  }
  breaker.failures = 0;
  breaker.lastFailure = null;
}

/**
 * Record a failed API request
 */
export function recordFailure(platform: string): void {
  const breaker = getCircuitBreaker(platform);
  const now = Date.now();

  breaker.failures++;
  breaker.lastFailure = now;

  if (breaker.failures >= CIRCUIT_CONFIG.failureThreshold) {
    breaker.state = "open";
    breaker.nextRetry = now + CIRCUIT_CONFIG.resetTimeout;
    console.warn(`[CircuitBreaker] Circuit opened for ${platform} after ${breaker.failures} failures`);
  }
}

// ============================================
// Rate Limit Tracking
// ============================================

interface RateLimitInfo {
  remaining: number;
  reset: number; // Unix timestamp in seconds
  lastUpdated: number;
}

const rateLimits: Map<string, RateLimitInfo> = new Map();

/**
 * Update rate limit info from API response headers
 */
export function updateRateLimit(platform: string, headers: Headers): void {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");

  if (remaining !== null) {
    rateLimits.set(platform, {
      remaining: parseInt(remaining, 10),
      reset: reset ? parseInt(reset, 10) : Math.floor(Date.now() / 1000) + 60,
      lastUpdated: Date.now(),
    });
  }
}

/**
 * Get current rate limit info for a platform
 */
export function getRateLimit(platform: string): RateLimitInfo | undefined {
  return rateLimits.get(platform);
}

/**
 * Check if we should use Apify fallback instead of official API
 */
export function shouldUseFallback(platform: string): { useFallback: boolean; reason?: string } {
  // Check circuit breaker first
  const circuitCheck = canMakeRequest(platform);
  if (!circuitCheck.allowed) {
    return { useFallback: true, reason: circuitCheck.reason };
  }

  // Check rate limits
  const rateLimit = rateLimits.get(platform);
  if (rateLimit) {
    const now = Date.now() / 1000;
    if (rateLimit.remaining <= 5 && rateLimit.reset > now) {
      return {
        useFallback: true,
        reason: `Rate limit low (${rateLimit.remaining} remaining). Resets at ${new Date(rateLimit.reset * 1000).toISOString()}`,
      };
    }
  }

  return { useFallback: false };
}

/**
 * Get API health status for all platforms (for dashboard display)
 */
export function getApiHealth(): Record<string, { status: string; details: unknown }> {
  const platforms = [
    "reddit", "hackernews", "producthunt", "googlereviews", "trustpilot",
    "appstore", "playstore", "quora", "youtube", "g2", "yelp", "amazonreviews",
    // Developer/Indie platforms (Phase 4)
    "indiehackers", "github", "devto", "hashnode"
  ];
  const health: Record<string, { status: string; details: unknown }> = {};

  for (const platform of platforms) {
    const breaker = getCircuitBreaker(platform);
    const rateLimit = rateLimits.get(platform);

    let status = "healthy";
    if (breaker.state === "open") {
      status = "down";
    } else if (breaker.state === "half-open") {
      status = "degraded";
    } else if (rateLimit && rateLimit.remaining <= 10) {
      status = "throttled";
    }

    health[platform] = {
      status,
      details: {
        circuitState: breaker.state,
        failures: breaker.failures,
        rateLimitRemaining: rateLimit?.remaining ?? "unknown",
        rateLimitReset: rateLimit?.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
      },
    };
  }

  return health;
}

// Actor IDs for different scrapers
// Format: "username/actor-name" - converted to "username~actor-name" for API calls
const ACTORS = {
  reddit: "trudax/reddit-scraper",
  googleReviews: "compass/google-maps-reviews-scraper",
  trustpilot: "happitap/trustpilot-scraper",
  appStore: "thewolves/appstore-reviews-scraper", // Pay per result ($0.10/1000 reviews)
  playStore: "neatrat/google-play-store-reviews-scraper", // Free tier available
  quora: "jupri/quora-scraper", // Note: requires paid rental
  // NEW PLATFORMS (Phase 2)
  youtube: "streamers/youtube-comment-scraper", // Video comments
  g2: "epctex/g2-scraper", // Software reviews
  yelp: "maxcopell/yelp-scraper", // Local business reviews
  amazonReviews: "junglee/amazon-reviews-scraper", // Product reviews
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

// ============================================
// NEW PLATFORM INTERFACES (Phase 2)
// ============================================

interface YouTubeCommentItem {
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

interface G2ReviewItem {
  reviewId: string;
  title: string;
  text: string;
  pros?: string;
  cons?: string;
  rating: number;
  date: string;
  author: string;
  authorRole?: string;
  companySize?: string;
  industry?: string;
  productName?: string;
  url?: string;
}

interface YelpReviewItem {
  reviewId: string;
  text: string;
  rating: number;
  date: string;
  author: string;
  authorLocation?: string;
  businessName?: string;
  businessUrl?: string;
  photos?: string[];
  url?: string;
}

interface AmazonReviewItem {
  reviewId: string;
  title: string;
  text: string;
  rating: number;
  date: string;
  author: string;
  verifiedPurchase: boolean;
  helpfulVotes?: number;
  productName?: string;
  productAsin?: string;
  url?: string;
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

  // Convert actor ID from "username/actor-name" to "username~actor-name" for API
  const apiActorId = actorId.replace("/", "~");

  // Start the actor run
  const runResponse = await fetch(
    `${APIFY_API_BASE}/acts/${apiActorId}/runs?token=${apiKey}`,
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
 * @param placeUrlOrId - Google Maps URL or Place ID (ChI...)
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 *
 * Supported URL formats:
 * - Full URL: https://www.google.com/maps/place/Business+Name/@lat,lng,zoom/...
 * - Search URL: https://www.google.com/maps/search/restaurants+in+New+York
 * - Place ID: ChIJVVVVVVXlUVMRu-GPNDD5qKw
 */
export async function fetchGoogleReviews(
  placeUrlOrId: string,
  maxReviews: number = 50
): Promise<GoogleReviewItem[]> {
  // Check if it's a Place ID (starts with ChI)
  const isPlaceId = placeUrlOrId.startsWith("ChI");

  const input = isPlaceId
    ? {
        placeIds: [placeUrlOrId],
        maxReviews,
        reviewsSort: "newest",
        language: "en",
      }
    : {
        startUrls: [{ url: placeUrlOrId }],
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
 *
 * Uses thewolves/appstore-reviews-scraper actor
 * Free demo mode: max 10 items
 */
export async function fetchAppStoreReviews(
  appUrl: string,
  maxReviews: number = 50
): Promise<AppStoreReviewItem[]> {
  // Support both full URLs and app IDs
  // URL format: https://apps.apple.com/us/app/app-name/id123456789
  // App ID format: id123456789 or just 123456789

  // If it's a full URL, use startUrls; otherwise extract app ID
  if (appUrl.includes("apps.apple.com")) {
    const input = {
      startUrls: [appUrl],
      maxItems: maxReviews,
    };
    return runActor<AppStoreReviewItem>(ACTORS.appStore, input);
  }

  // Extract numeric ID
  let appId = appUrl;
  if (appUrl.startsWith("id")) {
    appId = appUrl.slice(2);
  }

  const input = {
    appIds: [appId],
    country: "us",
    maxItems: maxReviews,
  };

  return runActor<AppStoreReviewItem>(ACTORS.appStore, input);
}

/**
 * Fetch Google Play Store reviews for an app
 * @param appUrl - Play Store URL or package ID
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 *
 * Uses neatrat/google-play-store-reviews-scraper actor
 */
export async function fetchPlayStoreReviews(
  appUrl: string,
  maxReviews: number = 50
): Promise<PlayStoreReviewItem[]> {
  // Support both full URLs and package IDs
  // URL format: https://play.google.com/store/apps/details?id=com.example.app
  // Package ID format: com.example.app

  const input = {
    appIdOrUrl: appUrl, // Can be URL or package ID
    maxReviews,
    sortBy: "newest",
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

// ============================================
// NEW PLATFORM FETCH FUNCTIONS (Phase 2)
// ============================================

/**
 * Fetch YouTube video comments
 * @param videoUrl - YouTube video URL (e.g., https://www.youtube.com/watch?v=abc123)
 * @param maxComments - Maximum number of comments to fetch (default 100)
 *
 * Uses streamers/youtube-comment-scraper actor
 */
export async function fetchYouTubeComments(
  videoUrl: string,
  maxComments: number = 100
): Promise<YouTubeCommentItem[]> {
  // Extract video ID from URL if needed
  let videoId = videoUrl;
  if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
    const urlObj = new URL(videoUrl);
    if (urlObj.hostname === "youtu.be") {
      videoId = urlObj.pathname.slice(1);
    } else {
      videoId = urlObj.searchParams.get("v") || videoUrl;
    }
  }

  const input = {
    startUrls: [{ url: `https://www.youtube.com/watch?v=${videoId}` }],
    maxComments,
    sortBy: "newest",
  };

  const items = await runActor<Record<string, unknown>>(ACTORS.youtube, input);

  return items.map((item) => ({
    commentId: String(item.commentId || item.id || ""),
    text: String(item.text || item.content || ""),
    author: String(item.author || item.authorName || ""),
    authorChannelUrl: item.authorChannelUrl ? String(item.authorChannelUrl) : undefined,
    publishedAt: String(item.publishedAt || item.date || ""),
    likeCount: Number(item.likeCount || item.likes || 0),
    replyCount: item.replyCount ? Number(item.replyCount) : undefined,
    videoId: String(item.videoId || videoId),
    videoTitle: item.videoTitle ? String(item.videoTitle) : undefined,
    videoUrl: `https://www.youtube.com/watch?v=${item.videoId || videoId}`,
  }));
}

/**
 * Fetch G2 software reviews
 * @param productUrl - G2 product page URL (e.g., https://www.g2.com/products/slack/reviews)
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 *
 * Uses epctex/g2-scraper actor
 */
export async function fetchG2Reviews(
  productUrl: string,
  maxReviews: number = 50
): Promise<G2ReviewItem[]> {
  // Ensure URL has /reviews suffix
  let url = productUrl;
  if (!url.includes("/reviews")) {
    url = url.replace(/\/?$/, "/reviews");
  }

  const input = {
    startUrls: [{ url }],
    maxItems: maxReviews,
  };

  const items = await runActor<Record<string, unknown>>(ACTORS.g2, input);

  return items.map((item) => ({
    reviewId: String(item.reviewId || item.id || ""),
    title: String(item.title || item.headline || ""),
    text: String(item.text || item.body || item.reviewText || ""),
    pros: item.pros ? String(item.pros) : undefined,
    cons: item.cons ? String(item.cons) : undefined,
    rating: Number(item.rating || item.stars || 0),
    date: String(item.date || item.publishedDate || ""),
    author: String(item.author || item.reviewerName || ""),
    authorRole: item.authorRole ? String(item.authorRole) : undefined,
    companySize: item.companySize ? String(item.companySize) : undefined,
    industry: item.industry ? String(item.industry) : undefined,
    productName: item.productName ? String(item.productName) : undefined,
    url: item.url ? String(item.url) : undefined,
  }));
}

/**
 * Fetch Yelp business reviews
 * @param businessUrl - Yelp business page URL (e.g., https://www.yelp.com/biz/restaurant-name-city)
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 *
 * Uses maxcopell/yelp-scraper actor
 */
export async function fetchYelpReviews(
  businessUrl: string,
  maxReviews: number = 50
): Promise<YelpReviewItem[]> {
  const input = {
    startUrls: [{ url: businessUrl }],
    maxItems: maxReviews,
    scrapeReviews: true,
  };

  const items = await runActor<Record<string, unknown>>(ACTORS.yelp, input);

  return items.map((item) => ({
    reviewId: String(item.reviewId || item.id || ""),
    text: String(item.text || item.comment || ""),
    rating: Number(item.rating || item.stars || 0),
    date: String(item.date || item.publishedDate || ""),
    author: String(item.author || item.userName || ""),
    authorLocation: item.authorLocation ? String(item.authorLocation) : undefined,
    businessName: item.businessName ? String(item.businessName) : undefined,
    businessUrl: item.businessUrl ? String(item.businessUrl) : businessUrl,
    photos: Array.isArray(item.photos) ? item.photos.map(String) : undefined,
    url: item.url ? String(item.url) : undefined,
  }));
}

/**
 * Fetch Amazon product reviews
 * @param productUrl - Amazon product URL or ASIN (e.g., https://amazon.com/dp/B08N5WRWNW or B08N5WRWNW)
 * @param maxReviews - Maximum number of reviews to fetch (default 50)
 *
 * Uses junglee/amazon-reviews-scraper actor
 */
export async function fetchAmazonReviews(
  productUrl: string,
  maxReviews: number = 50
): Promise<AmazonReviewItem[]> {
  // Extract ASIN from URL if provided
  let asin = productUrl;
  if (productUrl.includes("amazon.com") || productUrl.includes("amazon.")) {
    // URL patterns: /dp/ASIN, /gp/product/ASIN, /product-reviews/ASIN
    const asinMatch = productUrl.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      asin = asinMatch[1];
    }
  }

  const input = {
    productUrls: [`https://www.amazon.com/dp/${asin}`],
    maxReviews,
    sortBy: "recent",
  };

  const items = await runActor<Record<string, unknown>>(ACTORS.amazonReviews, input);

  return items.map((item) => ({
    reviewId: String(item.reviewId || item.id || ""),
    title: String(item.title || item.headline || ""),
    text: String(item.text || item.body || item.reviewText || ""),
    rating: Number(item.rating || item.stars || 0),
    date: String(item.date || item.reviewDate || ""),
    author: String(item.author || item.reviewerName || ""),
    verifiedPurchase: Boolean(item.verifiedPurchase || item.verified || false),
    helpfulVotes: item.helpfulVotes ? Number(item.helpfulVotes) : undefined,
    productName: item.productName ? String(item.productName) : undefined,
    productAsin: item.asin ? String(item.asin) : asin,
    url: item.url ? String(item.url) : undefined,
  }));
}

/**
 * Check if Apify is configured
 */
export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_KEY;
}

// ============================================
// Reddit Fallback Scraper
// ============================================

interface RedditPostItem {
  id: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  createdUtc: number;
  score: number;
  numComments: number;
  subreddit: string;
  url?: string;
}

/**
 * Fetch Reddit posts via Apify (fallback when Reddit API fails)
 * @param subreddit - Subreddit to scrape (without r/)
 * @param options - Scraping options
 */
export async function fetchRedditPosts(
  subreddit: string,
  options: { maxPosts?: number; sortBy?: "new" | "hot" | "top" } = {}
): Promise<RedditPostItem[]> {
  const { maxPosts = 100, sortBy = "new" } = options;

  console.log(`[Apify] Using fallback scraper for r/${subreddit}`);

  const input = {
    startUrls: [{ url: `https://www.reddit.com/r/${subreddit}/${sortBy}/` }],
    maxPostCount: maxPosts,
    maxComments: 0,
    skipComments: true,
  };

  const items = await runActor<Record<string, unknown>>(ACTORS.reddit, input);

  return items.map((item) => ({
    id: String(item.id || ""),
    title: String(item.title || ""),
    selftext: String(item.selftext || item.body || ""),
    author: String(item.author || ""),
    permalink: String(item.permalink || ""),
    createdUtc: Number(item.createdUtc || item.created_utc || 0),
    score: Number(item.score || 0),
    numComments: Number(item.numComments || item.num_comments || 0),
    subreddit: String(item.subreddit || subreddit),
    url: item.url ? String(item.url) : undefined,
  }));
}

/**
 * Fetch Reddit posts with automatic fallback to Apify if official API fails
 * This is the recommended function to use in monitor jobs
 */
export async function fetchRedditWithFallback(
  subreddit: string,
  options: { maxPosts?: number; sortBy?: "new" | "hot" | "top" } = {}
): Promise<{ posts: RedditPostItem[]; source: "api" | "apify" }> {
  const { maxPosts = 100, sortBy = "new" } = options;

  // Check if we should skip the API and go straight to fallback
  const fallbackCheck = shouldUseFallback("reddit");
  if (fallbackCheck.useFallback) {
    console.log(`[Reddit] Using Apify fallback: ${fallbackCheck.reason}`);
    const posts = await fetchRedditPosts(subreddit, { maxPosts, sortBy });
    return { posts, source: "apify" };
  }

  // Try official API first
  try {
    const url = `https://www.reddit.com/r/${subreddit}/${sortBy}.json?limit=${maxPosts}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Kaulby/1.0 (by /u/kaulby_official)",
      },
    });

    // Track rate limits from headers
    updateRateLimit("reddit", response.headers);

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();
    recordSuccess("reddit");

    const posts: RedditPostItem[] = data.data.children.map((child: { data: Record<string, unknown> }) => ({
      id: String(child.data.id || ""),
      title: String(child.data.title || ""),
      selftext: String(child.data.selftext || ""),
      author: String(child.data.author || ""),
      permalink: String(child.data.permalink || ""),
      createdUtc: Number(child.data.created_utc || 0),
      score: Number(child.data.score || 0),
      numComments: Number(child.data.num_comments || 0),
      subreddit: String(child.data.subreddit || subreddit),
      url: child.data.url ? String(child.data.url) : undefined,
    }));

    return { posts, source: "api" };
  } catch (error) {
    console.warn(`[Reddit] API failed, falling back to Apify:`, error);
    recordFailure("reddit");

    // Use Apify fallback
    if (!isApifyConfigured()) {
      throw new Error("Reddit API failed and APIFY_API_KEY is not configured for fallback");
    }

    const posts = await fetchRedditPosts(subreddit, { maxPosts, sortBy });
    return { posts, source: "apify" };
  }
}

// Export types for use in monitor functions
export type {
  GoogleReviewItem,
  TrustpilotReviewItem,
  AppStoreReviewItem,
  PlayStoreReviewItem,
  QuoraAnswerItem,
  RedditPostItem,
  // New platforms
  YouTubeCommentItem,
  G2ReviewItem,
  YelpReviewItem,
  AmazonReviewItem,
};
