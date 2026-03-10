/**
 * Serper (Google Search) Integration Module
 *
 * Uses Google Search via Serper API to find content on platforms
 * without scraping them directly. This is legally compliant —
 * we're searching Google's index, not scraping platform sites.
 *
 * Used for: Trustpilot, G2, Yelp, Quora, Amazon Reviews
 * (Same approach as Reddit — see reddit.ts)
 *
 * Cost: $50/mo for 50k searches at serper.dev
 */

import { cachedQuery, CACHE_TTL } from "@/lib/cache";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  position?: number;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  searchParameters?: { q: string };
}

export interface SerperSearchResult<T> {
  items: T[];
  source: "serper";
  cached: boolean;
  error?: string;
}

// Platform-specific result types matching existing Apify interfaces
// so monitor files need minimal changes

export interface TrustpilotReviewItem {
  id: string;
  title: string;
  text: string;
  rating: number;
  date: string;
  author: string;
  authorLocation?: string;
  url: string;
}

export interface G2ReviewItem {
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

export interface YelpReviewItem {
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

export interface GoogleReviewSerperItem {
  reviewId: string;
  name: string;
  text: string;
  stars: number;
  publishedAtDate: string;
  reviewUrl: string;
  placeId?: string;
}

export interface QuoraAnswerItem {
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

export interface AppStoreSerperItem {
  id: string;
  title: string;
  text: string;
  rating: number;
  date: string;
  userName: string;
  appId?: string;
  url?: string;
}

export interface AmazonReviewItem {
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

// ============================================================================
// CORE SERPER SEARCH
// ============================================================================

/**
 * Check if Serper is configured
 */
export function isSerperConfigured(): boolean {
  return Boolean(process.env.SERPER_API_KEY);
}

/**
 * Execute a Serper Google search query
 */
async function searchSerper(
  query: string,
  limit: number = 20
): Promise<SerperOrganicResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("SERPER_API_KEY not configured");
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: Math.min(limit, 100),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Serper error: ${response.status} - ${errorText}`);
  }

  const data: SerperResponse = await response.json();
  return data.organic || [];
}

/**
 * Generate a unique ID from a URL or fallback to random
 */
function generateId(url: string, prefix: string): string {
  // Try to extract a meaningful ID from the URL
  const urlHash = url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-16);
  return urlHash || `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

// ============================================================================
// TRUSTPILOT via Serper
// ============================================================================

/**
 * Search Trustpilot reviews via Google Search
 *
 * For company-specific monitoring, searches: site:trustpilot.com/review/company
 * For keyword monitoring, searches: site:trustpilot.com "keyword"
 */
export async function searchTrustpilotSerper(
  companyOrKeyword: string,
  limit: number = 20
): Promise<TrustpilotReviewItem[]> {
  // Build search query — if it looks like a URL/domain, search that specific company
  let query: string;
  if (
    companyOrKeyword.includes("trustpilot.com") ||
    companyOrKeyword.includes(".com") ||
    companyOrKeyword.includes(".io")
  ) {
    // Extract company slug from URL or domain
    const slug = companyOrKeyword
      .replace(/https?:\/\/(www\.)?trustpilot\.com\/review\//, "")
      .replace(/https?:\/\//, "")
      .replace(/\/$/, "");
    query = `site:trustpilot.com/review/${slug}`;
  } else {
    query = `site:trustpilot.com "${companyOrKeyword}" reviews`;
  }

  const { data: results, cached } = await cachedQuery<SerperOrganicResult[]>(
    "serper:trustpilot",
    { query, limit },
    () => searchSerper(query, limit),
    CACHE_TTL.REVIEWS
  );

  if (cached) {
    logger.debug("[Trustpilot] Serper cache hit", { query });
  }

  return results
    .filter((r) => r.link.includes("trustpilot.com"))
    .map((r) => transformToTrustpilotReview(r));
}

function transformToTrustpilotReview(
  result: SerperOrganicResult
): TrustpilotReviewItem {
  // Try to extract rating from title (e.g., "Rated 4 out of 5" or "★★★★")
  const ratingMatch = result.title.match(/(\d)\s*(?:out of 5|stars?|\/5)/i) ||
    result.snippet.match(/(\d)\s*(?:out of 5|stars?|\/5)/i);
  const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

  // Try to extract author from snippet
  const authorMatch = result.snippet.match(/(?:by|from)\s+([A-Z][a-z]+ [A-Z]?[a-z]*)/);

  return {
    id: generateId(result.link, "tp"),
    title: result.title.replace(/ - Trustpilot$/i, "").replace(/\| Trustpilot$/i, "").trim(),
    text: result.snippet,
    rating,
    date: result.date || new Date().toISOString(),
    author: authorMatch?.[1] || "Trustpilot User",
    url: result.link,
  };
}

// ============================================================================
// G2 via Serper
// ============================================================================

/**
 * Search G2 software reviews via Google Search
 */
export async function searchG2Serper(
  productUrlOrKeyword: string,
  limit: number = 20
): Promise<G2ReviewItem[]> {
  let query: string;
  if (productUrlOrKeyword.includes("g2.com")) {
    // Extract product name from G2 URL
    const productMatch = productUrlOrKeyword.match(
      /g2\.com\/products\/([^/]+)/
    );
    const product = productMatch?.[1]?.replace(/-/g, " ") || productUrlOrKeyword;
    query = `site:g2.com/products/${productMatch?.[1] || ""} reviews`;
  } else {
    query = `site:g2.com "${productUrlOrKeyword}" reviews`;
  }

  const { data: results, cached } = await cachedQuery<SerperOrganicResult[]>(
    "serper:g2",
    { query, limit },
    () => searchSerper(query, limit),
    CACHE_TTL.REVIEWS
  );

  if (cached) {
    logger.debug("[G2] Serper cache hit", { query });
  }

  return results
    .filter((r) => r.link.includes("g2.com"))
    .map((r) => transformToG2Review(r));
}

function transformToG2Review(result: SerperOrganicResult): G2ReviewItem {
  const ratingMatch = result.title.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i) ||
    result.snippet.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  // Try to extract product name from URL
  const productMatch = result.link.match(/g2\.com\/products\/([^/]+)/);
  const productName = productMatch?.[1]?.replace(/-/g, " ") || undefined;

  // Try to extract pros/cons from snippet
  const prosMatch = result.snippet.match(/(?:pros?|like|love)[:\s]*(.+?)(?:cons?|dislike|but|however|$)/i);
  const consMatch = result.snippet.match(/(?:cons?|dislike|don't like)[:\s]*(.+?)$/i);

  return {
    reviewId: generateId(result.link, "g2"),
    title: result.title.replace(/ - G2$/i, "").replace(/\| G2$/i, "").trim(),
    text: result.snippet,
    pros: prosMatch?.[1]?.trim(),
    cons: consMatch?.[1]?.trim(),
    rating,
    date: result.date || new Date().toISOString(),
    author: "G2 Reviewer",
    productName,
    url: result.link,
  };
}

// ============================================================================
// YELP via Serper
// ============================================================================

/**
 * Search Yelp business reviews via Google Search
 */
export async function searchYelpSerper(
  businessUrlOrKeyword: string,
  limit: number = 20
): Promise<YelpReviewItem[]> {
  let query: string;
  if (businessUrlOrKeyword.includes("yelp.com")) {
    // Extract business slug from Yelp URL
    const bizMatch = businessUrlOrKeyword.match(/yelp\.com\/biz\/([^/?]+)/);
    const bizSlug = bizMatch?.[1] || "";
    query = `site:yelp.com/biz/${bizSlug}`;
  } else {
    query = `site:yelp.com "${businessUrlOrKeyword}" reviews`;
  }

  const { data: results, cached } = await cachedQuery<SerperOrganicResult[]>(
    "serper:yelp",
    { query, limit },
    () => searchSerper(query, limit),
    CACHE_TTL.REVIEWS
  );

  if (cached) {
    logger.debug("[Yelp] Serper cache hit", { query });
  }

  return results
    .filter((r) => r.link.includes("yelp.com"))
    .map((r) => transformToYelpReview(r));
}

function transformToYelpReview(result: SerperOrganicResult): YelpReviewItem {
  const ratingMatch = result.title.match(/(\d(?:\.\d)?)\s*(?:star|\/5)/i) ||
    result.snippet.match(/(\d(?:\.\d)?)\s*(?:star|\/5)/i);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  // Extract business name from URL
  const bizMatch = result.link.match(/yelp\.com\/biz\/([^/?]+)/);
  const businessName = bizMatch?.[1]?.replace(/-/g, " ") || undefined;

  return {
    reviewId: generateId(result.link, "yelp"),
    text: result.snippet,
    rating,
    date: result.date || new Date().toISOString(),
    author: "Yelp User",
    businessName,
    url: result.link,
  };
}

// ============================================================================
// QUORA via Serper
// ============================================================================

/**
 * Search Quora Q&A via Google Search
 */
export async function searchQuoraSerper(
  keyword: string,
  limit: number = 15
): Promise<QuoraAnswerItem[]> {
  const query = `site:quora.com "${keyword}"`;

  const { data: results, cached } = await cachedQuery<SerperOrganicResult[]>(
    "serper:quora",
    { query, limit },
    () => searchSerper(query, limit),
    CACHE_TTL.DEFAULT // 2 hours — Quora content is evergreen
  );

  if (cached) {
    logger.debug("[Quora] Serper cache hit", { query });
  }

  return results
    .filter((r) => r.link.includes("quora.com"))
    .map((r) => transformToQuoraAnswer(r));
}

function transformToQuoraAnswer(result: SerperOrganicResult): QuoraAnswerItem {
  // Quora URLs look like: quora.com/What-is-the-best-CRM-software
  const questionSlugMatch = result.link.match(
    /quora\.com\/([^/?]+)/
  );
  const questionSlug = questionSlugMatch?.[1] || "";
  const questionTitle =
    result.title.replace(/ - Quora$/i, "").trim() ||
    questionSlug.replace(/-/g, " ");

  return {
    questionId: generateId(result.link, "quora-q"),
    questionTitle,
    questionUrl: result.link,
    answerText: result.snippet,
    answerAuthor: "Quora User",
    answerDate: result.date || new Date().toISOString(),
    answerUrl: result.link,
  };
}

// ============================================================================
// AMAZON REVIEWS via Serper
// ============================================================================

/**
 * Search Amazon product reviews via Google Search
 */
export async function searchAmazonSerper(
  productUrlOrAsin: string,
  limit: number = 20
): Promise<AmazonReviewItem[]> {
  let query: string;

  // Check if it's an ASIN (10 alphanumeric chars)
  if (/^[A-Z0-9]{10}$/i.test(productUrlOrAsin)) {
    query = `site:amazon.com "${productUrlOrAsin}" customer reviews`;
  } else if (productUrlOrAsin.includes("amazon.com")) {
    // Extract ASIN from Amazon URL
    const asinMatch = productUrlOrAsin.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      query = `site:amazon.com "${asinMatch[1]}" customer reviews`;
    } else {
      query = `site:amazon.com "${productUrlOrAsin}" reviews`;
    }
  } else {
    query = `site:amazon.com "${productUrlOrAsin}" customer reviews`;
  }

  const { data: results, cached } = await cachedQuery<SerperOrganicResult[]>(
    "serper:amazon",
    { query, limit },
    () => searchSerper(query, limit),
    CACHE_TTL.REVIEWS
  );

  if (cached) {
    logger.debug("[Amazon] Serper cache hit", { query });
  }

  return results
    .filter((r) => r.link.includes("amazon.com"))
    .map((r) => transformToAmazonReview(r, productUrlOrAsin));
}

function transformToAmazonReview(
  result: SerperOrganicResult,
  productRef: string
): AmazonReviewItem {
  const ratingMatch = result.title.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i) ||
    result.snippet.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  // Extract ASIN from URL
  const asinMatch = result.link.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i) ||
    productRef.match(/^([A-Z0-9]{10})$/i);
  const productAsin = asinMatch?.[1];

  // Try to extract product name from title
  const productName = result.title
    .replace(/Amazon\.com[:\s]*/i, "")
    .replace(/Customer Reviews[:\s]*/i, "")
    .replace(/\s*-\s*Amazon.*$/i, "")
    .trim() || undefined;

  return {
    reviewId: generateId(result.link, "amz"),
    title: result.title.replace(/ - Amazon.*$/i, "").trim(),
    text: result.snippet,
    rating,
    date: result.date || new Date().toISOString(),
    author: "Amazon Customer",
    verifiedPurchase: false, // Can't determine from search results
    productName,
    productAsin,
    url: result.link,
  };
}

// ============================================================================
// GOOGLE REVIEWS via Serper
// ============================================================================

/**
 * Search Google Reviews via Google Search (Serper)
 *
 * For URL-based monitoring: extracts place name and searches Google Maps reviews
 * For keyword monitoring: searches Google Maps for business reviews
 */
export async function searchGoogleReviewsSerper(
  placeUrlOrKeyword: string,
  limit: number = 20
): Promise<GoogleReviewSerperItem[]> {
  let query: string;
  if (placeUrlOrKeyword.includes("google.com/maps") || placeUrlOrKeyword.startsWith("ChI")) {
    // Extract place name from Google Maps URL or use Place ID
    const nameMatch = placeUrlOrKeyword.match(/place\/([^/]+)/);
    const placeName = nameMatch?.[1]?.replace(/\+/g, " ").replace(/%20/g, " ") || placeUrlOrKeyword;
    query = `site:google.com/maps "${placeName}" reviews`;
  } else {
    query = `site:google.com/maps "${placeUrlOrKeyword}" reviews`;
  }

  const { data: results, cached } = await cachedQuery<SerperOrganicResult[]>(
    "serper:googlereviews",
    { query, limit },
    () => searchSerper(query, limit),
    CACHE_TTL.REVIEWS
  );

  if (cached) {
    logger.debug("[GoogleReviews] Serper cache hit", { query });
  }

  return results
    .filter((r) => r.link.includes("google.com/maps"))
    .map((r) => transformToGoogleReview(r));
}

function transformToGoogleReview(result: SerperOrganicResult): GoogleReviewSerperItem {
  const ratingMatch = result.title.match(/(\d(?:\.\d)?)\s*(?:star|\/5)/i) ||
    result.snippet.match(/(\d(?:\.\d)?)\s*(?:star|\/5)/i) ||
    result.snippet.match(/Rating:\s*(\d(?:\.\d)?)/i);
  const stars = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  // Extract place ID from URL if present
  const placeIdMatch = result.link.match(/place_id[=:]([^&/]+)/i) ||
    result.link.match(/(ChI[a-zA-Z0-9_-]+)/);
  const placeId = placeIdMatch?.[1];

  return {
    reviewId: generateId(result.link, "goog"),
    name: "Google User",
    text: result.snippet,
    stars,
    publishedAtDate: result.date || new Date().toISOString(),
    reviewUrl: result.link,
    placeId,
  };
}

// ============================================================================
// APP STORE via Serper
// ============================================================================

/**
 * Search App Store reviews via Google Search (Serper)
 *
 * Searches Google's index of apps.apple.com review pages.
 * Returns review snippets with ratings when extractable.
 *
 * Primary for App Store since Apify actors require paid plan.
 */
export async function searchAppStoreSerper(
  appUrlOrName: string,
  limit: number = 20
): Promise<AppStoreSerperItem[]> {
  let query: string;
  let appId: string | undefined;

  if (appUrlOrName.includes("apps.apple.com")) {
    // Extract app ID from URL: .../id123456789
    const idMatch = appUrlOrName.match(/id(\d+)/);
    appId = idMatch?.[1];
    // Extract app name from URL path
    const nameMatch = appUrlOrName.match(/\/app\/([^/]+)\//);
    const appName = nameMatch?.[1]?.replace(/-/g, " ") || "";
    query = `site:apps.apple.com "${appName}" reviews`;
  } else {
    // Treat as app name search
    query = `site:apps.apple.com "${appUrlOrName}" reviews`;
  }

  const { data: results, cached } = await cachedQuery<SerperOrganicResult[]>(
    "serper:appstore",
    { query, limit },
    () => searchSerper(query, limit),
    CACHE_TTL.REVIEWS
  );

  if (cached) {
    logger.debug("[AppStore] Serper cache hit", { query });
  }

  return results
    .filter((r) => r.link.includes("apps.apple.com"))
    .map((r) => transformToAppStoreReview(r, appId));
}

function transformToAppStoreReview(
  result: SerperOrganicResult,
  appId?: string
): AppStoreSerperItem {
  // Try to extract rating from title or snippet (e.g., "4.7 out of 5")
  const ratingMatch = result.title.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i) ||
    result.snippet.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

  // Extract app ID from URL if not provided
  if (!appId) {
    const idMatch = result.link.match(/id(\d+)/);
    appId = idMatch?.[1];
  }

  return {
    id: generateId(result.link, "appstore"),
    title: result.title
      .replace(/\s*-\s*(?:Ratings & Reviews|App Store).*$/i, "")
      .replace(/\s*-\s*Apple$/i, "")
      .trim(),
    text: result.snippet,
    rating,
    date: result.date || new Date().toISOString(),
    userName: "App Store User",
    appId,
    url: result.link,
  };
}
