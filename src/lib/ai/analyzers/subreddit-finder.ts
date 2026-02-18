import { jsonCompletion } from "../openrouter";
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
      };
    }>;
  };
}

/**
 * Use Reddit's official API to search for relevant subreddits
 * This is the proper way - using Reddit's own search, not guessing
 */
async function searchRedditSubreddits(query: string, limit: number = 25): Promise<string[]> {
  try {
    const response = await fetch(
      `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`,
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

    // Filter to subreddits with at least 1000 subscribers (active communities)
    return data.data.children
      .filter(child => child.data.subscribers >= 1000)
      .map(child => child.data.display_name);
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
  const allSubreddits = new Set<string>();

  // Step 1: Use Reddit's native subreddit search for the company name
  logger.debug("[SubredditFinder] Searching Reddit", { companyName });
  const redditResults = await searchRedditSubreddits(companyName, 15);
  redditResults.forEach(s => allSubreddits.add(s));
  logger.debug("[SubredditFinder] Reddit results", { count: redditResults.length, subreddits: redditResults });

  // Step 2: Also search for each keyword
  for (const keyword of keywords.slice(0, 3)) { // Limit to avoid rate limiting
    const keywordResults = await searchRedditSubreddits(keyword, 10);
    keywordResults.forEach(s => allSubreddits.add(s));
  }

  // Step 3: Use AI to enhance with industry-specific and competitor subreddits
  logger.debug("[SubredditFinder] Enhancing with AI suggestions");
  const aiSuggestions = await getAISuggestions(companyName, keywords, maxSubreddits);
  aiSuggestions.forEach(s => allSubreddits.add(s));
  logger.debug("[SubredditFinder] AI suggestions", { count: aiSuggestions.length, subreddits: aiSuggestions });

  const finalList = Array.from(allSubreddits).slice(0, maxSubreddits);
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

    // Extract just the subreddit names, prioritizing high relevance
    const highRelevance = result.data.subreddits
      .filter(s => s.relevance === "high")
      .map(s => s.name);

    const mediumRelevance = result.data.subreddits
      .filter(s => s.relevance === "medium")
      .map(s => s.name);

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

export async function findRelevantSubredditsCached(
  companyName: string,
  keywords: string[] = [],
  maxSubreddits: number = 10
): Promise<string[]> {
  const cacheKey = `${companyName.toLowerCase()}-${keywords.sort().join(",")}-${maxSubreddits}`;
  const cached = subredditCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.subreddits;
  }

  const subreddits = await findRelevantSubreddits(companyName, keywords, maxSubreddits);

  if (subreddits.length > 0) {
    subredditCache.set(cacheKey, { subreddits, timestamp: Date.now() });
  }

  return subreddits;
}
