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

  // Priority 1: Company name direct mention
  if (config.companyName) {
    const companyLower = config.companyName.toLowerCase();

    if (text.includes(companyLower)) {
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
        if (text.includes(keyword.toLowerCase()) && text.includes(companyLower)) {
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
      if (text.includes(keyword.toLowerCase())) {
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
