/**
 * Boolean Search Parser
 *
 * Supports ***-style search operators:
 * - "exact phrase" - Match exact phrase
 * - title:keyword - Search only in titles
 * - body:keyword - Search only in content/body
 * - author:username - Filter by author
 * - subreddit:name - Filter by subreddit/community
 * - platform:reddit - Filter by platform
 * - NOT term - Exclude results with term
 * - OR - Match either term (default is AND)
 * - (grouping) - Group expressions
 */

export interface ParsedQuery {
  // Required terms (AND logic)
  required: SearchTerm[];
  // Optional terms (OR logic)
  optional: SearchTerm[];
  // Excluded terms (NOT logic)
  excluded: SearchTerm[];
  // Field-specific filters
  filters: {
    title?: string[];
    body?: string[];
    author?: string[];
    subreddit?: string[];
    platform?: string[];
  };
  // Original query for display
  original: string;
  // Human-readable explanation
  explanation: string;
}

export interface SearchTerm {
  term: string;
  isExact: boolean; // Was it quoted?
  field?: "title" | "body" | "author" | "subreddit";
}

export interface MatchResult {
  matches: boolean;
  matchedTerms: string[];
  explanation: string;
}

/**
 * Parse a search query string into structured components
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    required: [],
    optional: [],
    excluded: [],
    filters: {},
    original: query,
    explanation: "",
  };

  if (!query.trim()) {
    result.explanation = "Empty query matches all";
    return result;
  }

  // Tokenize the query
  const tokens = tokenize(query);

  let isNextOr = false;
  let isNextNot = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Handle operators
    if (token.toUpperCase() === "OR") {
      isNextOr = true;
      continue;
    }

    if (token.toUpperCase() === "NOT" || token === "-") {
      isNextNot = true;
      continue;
    }

    if (token.toUpperCase() === "AND") {
      // AND is default, just skip
      continue;
    }

    // Handle field prefixes
    const fieldMatch = token.match(/^(title|body|author|subreddit|platform):(.+)$/i);
    if (fieldMatch) {
      const field = fieldMatch[1].toLowerCase() as keyof ParsedQuery["filters"];
      const value = fieldMatch[2].replace(/^["']|["']$/g, ""); // Remove quotes

      if (!result.filters[field]) {
        result.filters[field] = [];
      }
      result.filters[field]!.push(value);
      continue;
    }

    // Handle quoted phrases
    const isExact = token.startsWith('"') && token.endsWith('"');
    const term = isExact ? token.slice(1, -1) : token;

    const searchTerm: SearchTerm = { term, isExact };

    if (isNextNot) {
      result.excluded.push(searchTerm);
      isNextNot = false;
    } else if (isNextOr) {
      result.optional.push(searchTerm);
      isNextOr = false;
    } else {
      result.required.push(searchTerm);
    }
  }

  // Generate explanation
  result.explanation = generateExplanation(result);

  return result;
}

/**
 * Tokenize a query string, respecting quoted phrases
 */
function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < query.length; i++) {
    const char = query[i];

    // Handle quotes
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
      continue;
    }

    if (char === quoteChar && inQuotes) {
      inQuotes = false;
      current += char;
      continue;
    }

    // Handle spaces (token separator)
    if (char === " " && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = "";
      continue;
    }

    // Handle parentheses (for future grouping support)
    if ((char === "(" || char === ")") && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      // Skip parentheses for now (can add grouping later)
      current = "";
      continue;
    }

    current += char;
  }

  // Add final token
  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Generate human-readable explanation of parsed query
 */
function generateExplanation(query: ParsedQuery): string {
  const parts: string[] = [];

  if (query.required.length > 0) {
    const terms = query.required.map((t) =>
      t.isExact ? `"${t.term}"` : t.term
    );
    parts.push(`Must contain: ${terms.join(" AND ")}`);
  }

  if (query.optional.length > 0) {
    const terms = query.optional.map((t) =>
      t.isExact ? `"${t.term}"` : t.term
    );
    parts.push(`May contain: ${terms.join(" OR ")}`);
  }

  if (query.excluded.length > 0) {
    const terms = query.excluded.map((t) =>
      t.isExact ? `"${t.term}"` : t.term
    );
    parts.push(`Must NOT contain: ${terms.join(", ")}`);
  }

  if (query.filters.title?.length) {
    parts.push(`Title contains: ${query.filters.title.join(", ")}`);
  }

  if (query.filters.body?.length) {
    parts.push(`Body contains: ${query.filters.body.join(", ")}`);
  }

  if (query.filters.author?.length) {
    parts.push(`Author: ${query.filters.author.join(" or ")}`);
  }

  if (query.filters.subreddit?.length) {
    parts.push(`Subreddit: ${query.filters.subreddit.join(" or ")}`);
  }

  if (query.filters.platform?.length) {
    parts.push(`Platform: ${query.filters.platform.join(" or ")}`);
  }

  return parts.join(" | ") || "Matches all results";
}

/**
 * Check if content matches the parsed query
 */
export function matchesQuery(
  content: {
    title: string;
    body?: string;
    author?: string;
    subreddit?: string;
    platform?: string;
  },
  query: ParsedQuery
): MatchResult {
  const matchedTerms: string[] = [];
  const searchText = `${content.title} ${content.body || ""}`.toLowerCase();
  const titleLower = content.title.toLowerCase();
  const bodyLower = (content.body || "").toLowerCase();

  // Check required terms (all must match)
  for (const term of query.required) {
    const termLower = term.term.toLowerCase();
    const found = term.isExact
      ? searchText.includes(termLower)
      : searchText.includes(termLower);

    if (!found) {
      return {
        matches: false,
        matchedTerms,
        explanation: `Missing required term: ${term.term}`,
      };
    }
    matchedTerms.push(term.term);
  }

  // Check excluded terms (none must match)
  for (const term of query.excluded) {
    const termLower = term.term.toLowerCase();
    const found = term.isExact
      ? searchText.includes(termLower)
      : searchText.includes(termLower);

    if (found) {
      return {
        matches: false,
        matchedTerms,
        explanation: `Contains excluded term: ${term.term}`,
      };
    }
  }

  // Check optional terms (at least one must match if any are specified)
  if (query.optional.length > 0) {
    let anyOptionalMatch = false;
    for (const term of query.optional) {
      const termLower = term.term.toLowerCase();
      if (searchText.includes(termLower)) {
        anyOptionalMatch = true;
        matchedTerms.push(term.term);
      }
    }
    if (!anyOptionalMatch) {
      return {
        matches: false,
        matchedTerms,
        explanation: `None of the optional terms matched`,
      };
    }
  }

  // Check field-specific filters
  if (query.filters.title?.length) {
    const titleMatch = query.filters.title.some((t) =>
      titleLower.includes(t.toLowerCase())
    );
    if (!titleMatch) {
      return {
        matches: false,
        matchedTerms,
        explanation: `Title doesn't match filter`,
      };
    }
  }

  if (query.filters.body?.length) {
    const bodyMatch = query.filters.body.some((t) =>
      bodyLower.includes(t.toLowerCase())
    );
    if (!bodyMatch) {
      return {
        matches: false,
        matchedTerms,
        explanation: `Body doesn't match filter`,
      };
    }
  }

  if (query.filters.author?.length && content.author) {
    const authorMatch = query.filters.author.some(
      (a) => content.author!.toLowerCase() === a.toLowerCase()
    );
    if (!authorMatch) {
      return {
        matches: false,
        matchedTerms,
        explanation: `Author doesn't match filter`,
      };
    }
  }

  if (query.filters.subreddit?.length && content.subreddit) {
    const subMatch = query.filters.subreddit.some(
      (s) => content.subreddit!.toLowerCase() === s.toLowerCase()
    );
    if (!subMatch) {
      return {
        matches: false,
        matchedTerms,
        explanation: `Subreddit doesn't match filter`,
      };
    }
  }

  if (query.filters.platform?.length && content.platform) {
    const platformMatch = query.filters.platform.some(
      (p) => content.platform!.toLowerCase() === p.toLowerCase()
    );
    if (!platformMatch) {
      return {
        matches: false,
        matchedTerms,
        explanation: `Platform doesn't match filter`,
      };
    }
  }

  return {
    matches: true,
    matchedTerms,
    explanation: `Matched: ${matchedTerms.join(", ") || "all criteria"}`,
  };
}

/**
 * Convert a simple keyword list to a parsed query
 * (for backwards compatibility with existing monitors)
 */
export function keywordsToQuery(keywords: string[]): ParsedQuery {
  // Join keywords with OR logic (any keyword matches)
  const queryString = keywords.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" OR ");
  return parseSearchQuery(queryString);
}

/**
 * Get search syntax help text
 */
export function getSearchSyntaxHelp(): string {
  return `
Search Operators:
• "exact phrase" - Match exact phrase
• title:keyword - Search only in titles
• body:keyword - Search only in body/content
• author:username - Filter by author
• subreddit:name - Filter by subreddit
• platform:reddit - Filter by platform (reddit, hackernews, producthunt, etc.)
• NOT term - Exclude results containing term
• term1 OR term2 - Match either term
• term1 term2 - Match both terms (AND is default)

Examples:
• "pricing feedback" - Find exact phrase
• title:bug NOT fixed - Titles with "bug" but not "fixed"
• author:competitor subreddit:saas - Posts by specific author in specific sub
• alternative OR competitor - Find posts mentioning either word
• platform:reddit "need help" - Reddit posts with exact phrase
`.trim();
}

/**
 * Validate search query syntax
 */
export function validateSearchQuery(query: string): {
  valid: boolean;
  error?: string;
} {
  try {
    // Parse to validate syntax (throws on error)
    parseSearchQuery(query);

    // Check for unmatched quotes
    const quoteCount = (query.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      return { valid: false, error: "Unmatched quote" };
    }

    // Check for empty field values
    if (query.match(/\b(title|body|author|subreddit|platform):(\s|$)/)) {
      return { valid: false, error: "Empty field value" };
    }

    // Check for lonely operators
    if (query.match(/^\s*(AND|OR|NOT)\s*$/i)) {
      return { valid: false, error: "Query cannot be just an operator" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid query syntax" };
  }
}
