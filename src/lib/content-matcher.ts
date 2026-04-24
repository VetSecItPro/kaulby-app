/**
 * Content Matching Utilities
 *
 * Provides unified content matching logic for all monitors.
 * Supports both simple keyword matching (backwards compatible) and
 * advanced boolean search operators (Pro feature).
 */

import {
  parseSearchQuery,
  matchesQuery,
} from "./search-parser";

interface MatchableContent {
  title: string;
  body?: string;
  author?: string;
  subreddit?: string; // For Reddit-specific filtering
  platform?: string; // For cross-platform filtering (reddit, hackernews, etc.)
}

interface MatchConfig {
  companyName?: string | null;
  keywords: string[];
  // If searchQuery is provided, use boolean search. Otherwise, use simple keyword matching.
  searchQuery?: string | null;
}

interface MatchResult {
  matches: boolean;
  matchedTerms: string[];
  matchType: "company" | "company_keyword" | "keyword" | "boolean_search";
  explanation: string;
}

/**
 * Does the text include `needle`, either as a full phrase OR (for multi-word
 * needles) as all tokens present independently in any order?
 *
 * Why: a user monitoring "Anthropic Claude" wants matches on posts that say
 * "Claude just dropped" or "Anthropic announced" — the strict substring check
 * `text.includes("anthropic claude")` misses those. Single-word needles keep
 * exact-substring semantics (no behavior change).
 */
export function includesTokenized(text: string, needle: string): boolean {
  const n = needle.toLowerCase().trim();
  if (!n) return false;
  if (text.includes(n)) return true;
  if (!n.includes(" ")) return false;
  const tokens = n.split(/\s+/).filter((t) => t.length >= 2);
  return tokens.length > 0 && tokens.every((t) => text.includes(t));
}

/**
 * Check if content matches monitor criteria.
 * Supports:
 * - Company name direct mentions
 * - Company name + keyword combinations
 * - Simple keyword matching (any keyword matches)
 * - Advanced boolean search (Pro feature)
 */
export function contentMatchesMonitor(
  content: MatchableContent,
  config: MatchConfig
): MatchResult {
  const text = `${content.title} ${content.body || ""}`.toLowerCase();

  // If advanced search query is provided, use boolean search parser
  if (config.searchQuery && config.searchQuery.trim()) {
    const parsedQuery = parseSearchQuery(config.searchQuery);
    const queryResult = matchesQuery(content, parsedQuery);

    return {
      matches: queryResult.matches,
      matchedTerms: queryResult.matchedTerms,
      matchType: "boolean_search",
      explanation: queryResult.explanation,
    };
  }

  // Priority 1: Company name direct mention (phrase OR all tokens)
  if (config.companyName) {
    if (includesTokenized(text, config.companyName)) {
      return {
        matches: true,
        matchedTerms: [config.companyName],
        matchType: "company",
        explanation: `Direct company name mention: ${config.companyName}`,
      };
    }

    // Priority 2: Company name + keyword combination
    if (config.keywords && config.keywords.length > 0) {
      for (const keyword of config.keywords) {
        if (includesTokenized(text, keyword) && includesTokenized(text, config.companyName)) {
          return {
            matches: true,
            matchedTerms: [config.companyName, keyword],
            matchType: "company_keyword",
            explanation: `Company + keyword match: ${config.companyName} + ${keyword}`,
          };
        }
      }
    }
  }

  // Priority 3: Simple keyword matching (any keyword matches)
  if (config.keywords && config.keywords.length > 0) {
    const matchedKeywords: string[] = [];

    for (const keyword of config.keywords) {
      if (includesTokenized(text, keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      return {
        matches: true,
        matchedTerms: matchedKeywords,
        matchType: "keyword",
        explanation: `Keyword match: ${matchedKeywords.join(", ")}`,
      };
    }
  }

  return {
    matches: false,
    matchedTerms: [],
    matchType: "keyword",
    explanation: "No matches found",
  };
}
