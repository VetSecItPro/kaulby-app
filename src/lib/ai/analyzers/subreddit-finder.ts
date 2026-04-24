import { jsonCompletion } from "../openrouter";
import { logAiCall } from "../log";
import { logger } from "@/lib/logger";

interface SubredditSuggestion {
  name: string;
  relevance: "high" | "medium";
  reason: string;
}

interface SubredditFinderResult {
  subreddits: SubredditSuggestion[];
}

interface RedditSubredditSearchResult {
  data: {
    children: Array<{
      data: {
        display_name: string;
        subscribers: number;
        public_description: string;
        title: string;
        over18?: boolean;
        quarantine?: boolean;
        subreddit_type?: string;
      };
    }>;
  };
}

/**
 * Use Reddit's official API to search for relevant subreddits.
 * Excludes NSFW, quarantined, private, and low-subscriber subs.
 */
async function searchRedditSubreddits(query: string, limit: number = 25): Promise<string[]> {
  try {
    const response = await fetch(
      `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance&include_over_18=off`,
      {
        headers: {
          "User-Agent": "Kaulby/1.0",
        },
      }
    );

    if (!response.ok) {
      logger.error("Reddit subreddit search failed", { status: response.status });
      return [];
    }

    const data: RedditSubredditSearchResult = await response.json();

    return data.data.children
      .filter((child) => {
        const d = child.data;
        if (!d || !d.display_name) return false;
        if (d.over18) return false;
        if (d.quarantine) return false;
        if (d.subreddit_type && d.subreddit_type !== "public") return false;
        // Reddit search is substring-match on name, returning tons of junk like
        // "GAY_Zoom_Record" for "Zoom". 5k subscribers filters the dregs without
        // excluding legit niche communities.
        if ((d.subscribers || 0) < 5000) return false;
        return true;
      })
      .map((child) => child.data.display_name);
  } catch (error) {
    logger.error("Reddit subreddit search error", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * Hybrid approach: Use Reddit's official API + AI enhancement
 *
 * 1. First, search Reddit for subreddits matching the company/keywords
 * 2. Use AI to generate additional relevant subreddits and rank them
 * 3. Combine and deduplicate
 *
 * This is how the pros do it (GummySearch used similar approaches)
 */
export async function findRelevantSubreddits(
  companyName: string,
  keywords: string[] = [],
  maxSubreddits: number = 10
): Promise<string[]> {
  // Start with AI suggestions FIRST. The LLM understands context ("Zoom the
  // video-conferencing company") while Reddit's search is a dumb substring
  // match that returns junk like "GAY_Zoom_Record" for "Zoom".
  //
  // Order matters: earlier entries in the final list get scanned first and
  // dominate the result set (each sub has a per-call cost budget).
  logger.debug("[SubredditFinder] Getting AI suggestions", { companyName });
  const aiSuggestions = await getAISuggestions(companyName, keywords, maxSubreddits);
  logger.debug("[SubredditFinder] AI suggestions", { count: aiSuggestions.length, subreddits: aiSuggestions });

  // Reddit search acts as a fill-in for niche communities the LLM may not know.
  logger.debug("[SubredditFinder] Searching Reddit for fill-ins", { companyName });
  const redditResults = await searchRedditSubreddits(companyName, 15);
  logger.debug("[SubredditFinder] Reddit results", { count: redditResults.length, subreddits: redditResults });

  const keywordResults: string[] = [];
  for (const keyword of keywords.slice(0, 3)) {
    const kr = await searchRedditSubreddits(keyword, 10);
    keywordResults.push(...kr);
  }

  // Preserve order: AI first, then Reddit fill-ins, dedup preserving first occurrence.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const s of [...aiSuggestions, ...redditResults, ...keywordResults]) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(s);
  }

  const finalList = ordered.slice(0, maxSubreddits);
  logger.info("[SubredditFinder] Final subreddit list", { count: finalList.length, subreddits: finalList });

  return finalList;
}

/**
 * AI-powered subreddit suggestions
 * Used to fill gaps that Reddit's search might miss
 */
async function getAISuggestions(
  companyName: string,
  keywords: string[] = [],
  maxSubreddits: number = 10
): Promise<string[]> {
  const keywordContext = keywords.length > 0
    ? `Additional keywords: ${keywords.join(", ")}`
    : "";

  const prompt = `You are an expert at finding Reddit communities where people discuss specific companies, brands, and topics.

Given a company/brand name and optional keywords, suggest the most relevant subreddits where people would naturally discuss this company, its products, competitors, or related topics.

Company/Brand: ${companyName}
${keywordContext}

Think about:
1. Industry-specific subreddits (e.g., r/coffee for Starbucks, r/accounting for QuickBooks)
2. Product category subreddits (e.g., r/fastfood for Dunkin, r/smallbusiness for B2B software)
3. Competitor comparison subreddits
4. Regional subreddits if the company is location-specific
5. Consumer discussion subreddits (r/AskReddit, r/NoStupidQuestions for broad reach)
6. Professional subreddits where the target audience hangs out
7. Problem/solution subreddits where people ask for recommendations

Return ONLY real, active subreddits. Do not make up subreddit names.

Return JSON in this exact format:
{
  "subreddits": [
    {"name": "subredditname", "relevance": "high", "reason": "brief reason"},
    ...
  ]
}

Provide up to ${maxSubreddits} subreddits, ordered by relevance (most relevant first).
Only include subreddits where this company/topic would ACTUALLY be discussed.`;

  try {
    const result = await jsonCompletion<SubredditFinderResult>({
      messages: [
        { role: "user", content: prompt }
      ],
    });

    // Log AI cost (system-level, no userId)
    await logAiCall({
      model: result.meta.model,
      promptTokens: result.meta.promptTokens,
      completionTokens: result.meta.completionTokens,
      costUsd: result.meta.cost,
      latencyMs: result.meta.latencyMs,
      analysisType: "subreddit-finder",
    });

    // Strip r/ prefix — the LLM inconsistently prepends it, which then breaks
    // the downstream scraper (it builds https://www.reddit.com/r/<name>/ and
    // r/r/programming 404s). Also trim whitespace and lowercase for dedup.
    const cleanName = (raw: string): string =>
      raw.trim().replace(/^\/?r\//i, "").replace(/\/$/, "");

    const highRelevance = result.data.subreddits
      .filter((s) => s.relevance === "high")
      .map((s) => cleanName(s.name))
      .filter(Boolean);

    const mediumRelevance = result.data.subreddits
      .filter((s) => s.relevance === "medium")
      .map((s) => cleanName(s.name))
      .filter(Boolean);

    return [...highRelevance, ...mediumRelevance].slice(0, maxSubreddits);
  } catch (error) {
    logger.error("AI subreddit suggestion error", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * Cached subreddit finder - stores results to avoid repeated AI calls
 * for the same company/keywords combination
 */
const subredditCache = new Map<string, { subreddits: string[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Defensive: strip r/ prefix and trailing slashes from subreddit names,
 * regardless of origin (fresh LLM, Reddit API, or cache). Safe to re-apply.
 */
function normalizeSubredditName(raw: string): string {
  return raw.trim().replace(/^\/?r\//i, "").replace(/\/$/, "");
}

export async function findRelevantSubredditsCached(
  companyName: string,
  keywords: string[] = [],
  maxSubreddits: number = 10
): Promise<string[]> {
  const cacheKey = `${companyName.toLowerCase()}-${keywords.sort().join(",")}-${maxSubreddits}`;
  const cached = subredditCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Normalize at read — protects against stale pre-fix entries in warm Lambdas.
    return cached.subreddits.map(normalizeSubredditName).filter(Boolean);
  }

  const subreddits = await findRelevantSubreddits(companyName, keywords, maxSubreddits);
  const normalized = subreddits.map(normalizeSubredditName).filter(Boolean);

  if (normalized.length > 0) {
    subredditCache.set(cacheKey, { subreddits: normalized, timestamp: Date.now() });
  }

  return normalized;
}
