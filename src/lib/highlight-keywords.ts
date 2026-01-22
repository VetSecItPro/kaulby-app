/**
 * Keyword Highlighting Utility
 *
 * Highlights search keywords in text, similar to ***'s yellow highlighting.
 * Supports both simple keywords and parsed search queries.
 */

import { type ParsedQuery } from "./search-parser";

/**
 * Extract all searchable terms from a parsed query
 */
export function extractSearchTerms(query: ParsedQuery): string[] {
  const terms: string[] = [];

  // Add required terms
  query.required.forEach((t) => terms.push(t.term));

  // Add optional terms
  query.optional.forEach((t) => terms.push(t.term));

  // Add field-specific filters (title and body are relevant for content highlighting)
  if (query.filters.title) {
    terms.push(...query.filters.title);
  }
  if (query.filters.body) {
    terms.push(...query.filters.body);
  }

  // Remove duplicates and empty strings
  return Array.from(new Set(terms.filter((t) => t.trim().length > 0)));
}

/**
 * Extract keywords from a simple keyword array (for backward compatibility)
 */
export function extractKeywords(keywords: string[]): string[] {
  return keywords.filter((k) => k.trim().length > 0);
}

export interface HighlightMatch {
  /** The start index of the match in the original text */
  start: number;
  /** The end index of the match in the original text */
  end: number;
  /** The matched text */
  text: string;
  /** The keyword that was matched */
  keyword: string;
}

/**
 * Find all keyword matches in text with their positions
 */
export function findKeywordMatches(
  text: string,
  keywords: string[]
): HighlightMatch[] {
  if (!text || keywords.length === 0) return [];

  const matches: HighlightMatch[] = [];
  const textLower = text.toLowerCase();

  for (const keyword of keywords) {
    if (!keyword.trim()) continue;

    const keywordLower = keyword.toLowerCase();
    let startIndex = 0;

    while (true) {
      const index = textLower.indexOf(keywordLower, startIndex);
      if (index === -1) break;

      matches.push({
        start: index,
        end: index + keyword.length,
        text: text.slice(index, index + keyword.length),
        keyword,
      });

      startIndex = index + 1;
    }
  }

  // Sort by start position and merge overlapping matches
  return mergeOverlappingMatches(matches);
}

/**
 * Merge overlapping highlight matches to avoid duplicate highlighting
 */
function mergeOverlappingMatches(matches: HighlightMatch[]): HighlightMatch[] {
  if (matches.length <= 1) return matches;

  // Sort by start position
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const merged: HighlightMatch[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];

    // If overlapping, extend the previous match
    if (current.start <= previous.end) {
      if (current.end > previous.end) {
        previous.end = current.end;
        previous.text = previous.text.slice(0, current.start - previous.start) +
          current.text.slice(0, current.end - current.start);
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export interface HighlightPart {
  text: string;
  isHighlighted: boolean;
  keyword?: string;
}

/**
 * Split text into parts for rendering with highlights
 * Returns an array of parts, each marked as highlighted or not
 */
export function splitTextForHighlighting(
  text: string,
  keywords: string[]
): HighlightPart[] {
  if (!text) return [];
  if (keywords.length === 0) return [{ text, isHighlighted: false }];

  const matches = findKeywordMatches(text, keywords);
  if (matches.length === 0) return [{ text, isHighlighted: false }];

  const parts: HighlightPart[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    // Add non-highlighted text before this match
    if (match.start > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.start),
        isHighlighted: false,
      });
    }

    // Add highlighted match
    parts.push({
      text: text.slice(match.start, match.end),
      isHighlighted: true,
      keyword: match.keyword,
    });

    lastIndex = match.end;
  }

  // Add remaining non-highlighted text
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      isHighlighted: false,
    });
  }

  return parts;
}

/**
 * Count how many unique keywords are matched in text
 */
export function countMatchedKeywords(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) return 0;

  const textLower = text.toLowerCase();
  let matchedCount = 0;

  for (const keyword of keywords) {
    if (keyword.trim() && textLower.includes(keyword.toLowerCase())) {
      matchedCount++;
    }
  }

  return matchedCount;
}

/**
 * Check if text contains any of the keywords
 */
export function containsAnyKeyword(text: string, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false;

  const textLower = text.toLowerCase();
  return keywords.some(
    (keyword) => keyword.trim() && textLower.includes(keyword.toLowerCase())
  );
}

/**
 * Get a summary of matches for display
 * Returns: "2 of 5 keywords matched" or "28 / 99 results matching"
 */
export function getMatchSummary(
  matchedCount: number,
  totalKeywords: number
): string {
  if (totalKeywords === 0) return "All results";
  if (matchedCount === 0) return "No keywords matched";
  if (matchedCount === totalKeywords) return "All keywords matched";
  return `${matchedCount} of ${totalKeywords} keywords matched`;
}
