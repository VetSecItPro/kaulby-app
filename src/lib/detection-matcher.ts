import { db, userDetectionKeywords } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { cache } from "@/lib/cache";
import type { DetectionCategory } from "@/lib/detection-defaults";

interface KeywordMatch {
  category: DetectionCategory;
  matchedKeyword: string;
  confidence: number;
}

// Cache user keywords for 5 minutes to avoid DB lookups on every result
const KEYWORDS_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get user's active detection keywords (with caching).
 * Returns null if user has no custom keywords configured.
 */
async function getUserKeywords(
  userId: string
): Promise<Record<string, string[]> | null> {
  const cacheKey = `detection-kw:${userId}`;

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

/**
 * Match content against user's custom detection keywords.
 * Returns the best matching category or null if no match.
 *
 * Matching rules:
 * - Case-insensitive substring matching
 * - Longer keyword matches get higher confidence
 * - If multiple categories match, pick the one with the longest keyword
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
      if (contentLower.includes(keyword)) {
        // Longer keywords are more specific, so give them higher confidence
        const confidence = Math.min(0.6 + keyword.length * 0.02, 0.9);

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            category: category as DetectionCategory,
            matchedKeyword: keyword,
            confidence,
          };
        }
      }
    }
  }

  return bestMatch;
}
