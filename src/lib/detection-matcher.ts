import { db, userDetectionKeywords } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { cache } from "@/lib/cache";
import type { DetectionCategory } from "@/lib/detection-defaults";

interface KeywordMatch {
  category: DetectionCategory;
  matchedKeyword: string;
  confidence: number;
}

// Cache user keywords for 1 hour. Keywords change rarely; the previous 5min TTL
// caused ~12x more DB lookups than needed. Cache is invalidated explicitly on
// write via invalidateKeywordsCache(), so stale reads are bounded by writes,
// not by TTL.
const KEYWORDS_CACHE_TTL = 60 * 60 * 1000;

function keywordsCacheKey(userId: string): string {
  return `detection-kw:${userId}`;
}

/**
 * Invalidate the cached keyword map for a user. Call this from any endpoint
 * that mutates userDetectionKeywords so the next read pulls fresh data.
 */
export async function invalidateKeywordsCache(userId: string): Promise<void> {
  await cache.delete(keywordsCacheKey(userId));
}

/**
 * Get user's active detection keywords (with caching).
 * Returns null if user has no custom keywords configured.
 */
async function getUserKeywords(
  userId: string
): Promise<Record<string, string[]> | null> {
  const cacheKey = keywordsCacheKey(userId);

  const cached = await cache.get<Record<string, string[]>>(cacheKey);
  if (cached) return cached;

  const rows = await db.query.userDetectionKeywords.findMany({
    where: and(
      eq(userDetectionKeywords.userId, userId),
      eq(userDetectionKeywords.isActive, true)
    ),
  });

  if (rows.length === 0) return null;

  const keywordMap: Record<string, string[]> = {};
  for (const row of rows) {
    keywordMap[row.category] = row.keywords;
  }

  await cache.set(cacheKey, keywordMap, KEYWORDS_CACHE_TTL);
  return keywordMap;
}

// Task 1.6 - Fuzzy matching tuning constants.
// MIN_FUZZY_KEYWORD_LENGTH: below 5 chars, 1-2 edit distance is too permissive
// ("app" ~ "apk" ~ "pap") and drives false positives. Exact-only for short kws.
// FUZZY_MAX_DISTANCE: Levenshtein cap. ≤2 catches typos ("priceing", "piricng")
// while rejecting genuinely different words.
// FUZZY_CONFIDENCE_PENALTY: fuzzy hits rank BELOW exact hits for the same
// keyword length, so real-word matches always win when both are present.
// FUZZY_SCAN_MAX_CHARS: scanning cost is O(content_len * keyword_len); cap the
// search window. Titles + first paragraph is where matches cluster anyway.
const MIN_FUZZY_KEYWORD_LENGTH = 5;
const FUZZY_MAX_DISTANCE = 2;
const FUZZY_CONFIDENCE_PENALTY = 0.15;
const FUZZY_SCAN_MAX_CHARS = 500;

/**
 * Bounded Levenshtein distance: returns the edit distance between `a` and `b`,
 * or `maxDistance + 1` as a sentinel if it would exceed `maxDistance`. Early-
 * aborts when the DP row minimum exceeds the cap so long-keyword runs stay
 * cheap on the hot path (detection runs on every scan result).
 */
export function levenshtein(a: string, b: string, maxDistance: number): number {
  const m = a.length;
  const n = b.length;
  // Length-difference lower bound: if strings differ in length by more than
  // the cap, distance is already over the cap. Skip allocating the DP rows.
  if (Math.abs(m - n) > maxDistance) return maxDistance + 1;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    // Early abort: if every cell in this row is already over the cap, no
    // future row can bring the final distance back under it.
    if (rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Sliding-window fuzzy substring check. True if any contiguous substring of
 * `content` whose length is within `±maxDistance` of `keyword.length` has
 * Levenshtein distance ≤ maxDistance to `keyword`. Scans only the first
 * FUZZY_SCAN_MAX_CHARS of content to bound cost on long posts.
 */
export function fuzzyIncludes(
  content: string,
  keyword: string,
  maxDistance: number
): boolean {
  const kLen = keyword.length;
  const scan = content.length > FUZZY_SCAN_MAX_CHARS
    ? content.slice(0, FUZZY_SCAN_MAX_CHARS)
    : content;
  const minWin = Math.max(1, kLen - maxDistance);
  const maxWin = kLen + maxDistance;

  for (let i = 0; i <= scan.length - minWin; i++) {
    // Try window sizes from minWin..maxWin at each start position. Short
    // keywords + small window set keep this comfortably fast.
    for (let w = minWin; w <= maxWin && i + w <= scan.length; w++) {
      const window = scan.slice(i, i + w);
      if (levenshtein(window, keyword, maxDistance) <= maxDistance) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Match content against user's custom detection keywords.
 * Returns the best matching category or null if no match.
 *
 * Matching rules:
 * - Case-insensitive substring matching (primary path)
 * - Fuzzy fallback via Levenshtein ≤2 for keywords ≥5 chars (Task 1.6).
 *   Fuzzy hits get a 0.15 confidence penalty so exact matches always rank
 *   higher than typo matches for the same keyword.
 * - Longer keyword matches get higher confidence
 * - If multiple categories match, pick the one with the highest confidence
 */
export async function matchDetectionKeywords(
  content: string,
  userId: string
): Promise<KeywordMatch | null> {
  const keywordMap = await getUserKeywords(userId);
  if (!keywordMap) return null;

  const contentLower = content.toLowerCase();
  let bestMatch: KeywordMatch | null = null;

  for (const [category, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      // Longer keywords are more specific, so give them higher confidence.
      const baseConfidence = Math.min(0.6 + keyword.length * 0.02, 0.9);
      let confidence: number | null = null;

      if (contentLower.includes(keyword)) {
        confidence = baseConfidence;
      } else if (
        keyword.length >= MIN_FUZZY_KEYWORD_LENGTH &&
        fuzzyIncludes(contentLower, keyword, FUZZY_MAX_DISTANCE)
      ) {
        // Penalize fuzzy hits so a real substring match for the same keyword
        // always outranks a typo-distance match.
        confidence = Math.max(0, baseConfidence - FUZZY_CONFIDENCE_PENALTY);
      }

      if (confidence !== null && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = {
          category: category as DetectionCategory,
          matchedKeyword: keyword,
          confidence,
        };
      }
    }
  }

  return bestMatch;
}
