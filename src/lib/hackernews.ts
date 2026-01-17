/**
 * Hacker News Algolia API Client
 *
 * Uses the Algolia-powered HN Search API which is much more efficient than
 * the Firebase API for keyword-based monitoring.
 *
 * API Docs: https://hn.algolia.com/api
 */

const HN_ALGOLIA_BASE = "https://hn.algolia.com/api/v1";

export interface HNAlgoliaStory {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string;
  story_text: string | null;  // For "Ask HN", "Show HN", etc.
  comment_text: string | null;
  created_at: string;
  created_at_i: number;  // Unix timestamp
  points: number | null;
  num_comments: number | null;
  story_id?: number;  // Parent story ID for comments
  parent_id?: number;
  _tags: string[];  // ["story", "author_username", "front_page"] etc.
}

interface HNAlgoliaResponse {
  hits: HNAlgoliaStory[];
  page: number;
  nbPages: number;
  nbHits: number;
  hitsPerPage: number;
  processingTimeMS: number;
}

export type HNSearchType = "story" | "comment" | "ask_hn" | "show_hn" | "front_page";

interface SearchOptions {
  query: string;
  tags?: HNSearchType[];
  page?: number;
  hitsPerPage?: number;
  numericFilters?: string;  // e.g., "created_at_i>1609459200" for date filtering
}

/**
 * Search HN using Algolia API
 * Much faster and more efficient than fetching individual stories
 */
export async function searchHN(options: SearchOptions): Promise<HNAlgoliaResponse> {
  const { query, tags = ["story"], page = 0, hitsPerPage = 100, numericFilters } = options;

  const params = new URLSearchParams({
    query,
    page: page.toString(),
    hitsPerPage: hitsPerPage.toString(),
    tags: tags.join(","),
  });

  if (numericFilters) {
    params.append("numericFilters", numericFilters);
  }

  const response = await fetch(
    `${HN_ALGOLIA_BASE}/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`HN Algolia API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search HN stories by date (most recent first)
 * Uses search_by_date endpoint for chronological results
 */
export async function searchHNByDate(options: SearchOptions): Promise<HNAlgoliaResponse> {
  const { query, tags = ["story"], page = 0, hitsPerPage = 100, numericFilters } = options;

  const params = new URLSearchParams({
    query,
    page: page.toString(),
    hitsPerPage: hitsPerPage.toString(),
    tags: tags.join(","),
  });

  if (numericFilters) {
    params.append("numericFilters", numericFilters);
  }

  const response = await fetch(
    `${HN_ALGOLIA_BASE}/search_by_date?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`HN Algolia API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get stories from the last N hours
 */
export async function getRecentStories(
  query: string,
  hoursAgo: number = 24
): Promise<HNAlgoliaStory[]> {
  const timestamp = Math.floor(Date.now() / 1000) - hoursAgo * 3600;
  const numericFilters = `created_at_i>${timestamp}`;

  const response = await searchHNByDate({
    query,
    tags: ["story"],
    hitsPerPage: 100,
    numericFilters,
  });

  return response.hits;
}

/**
 * Get recent comments matching a query
 */
export async function getRecentComments(
  query: string,
  hoursAgo: number = 24
): Promise<HNAlgoliaStory[]> {
  const timestamp = Math.floor(Date.now() / 1000) - hoursAgo * 3600;
  const numericFilters = `created_at_i>${timestamp}`;

  const response = await searchHNByDate({
    query,
    tags: ["comment"],
    hitsPerPage: 100,
    numericFilters,
  });

  return response.hits;
}

/**
 * Search for Ask HN posts
 */
export async function searchAskHN(query: string): Promise<HNAlgoliaStory[]> {
  const response = await searchHNByDate({
    query,
    tags: ["ask_hn"],
    hitsPerPage: 50,
  });

  return response.hits;
}

/**
 * Search for Show HN posts
 */
export async function searchShowHN(query: string): Promise<HNAlgoliaStory[]> {
  const response = await searchHNByDate({
    query,
    tags: ["show_hn"],
    hitsPerPage: 50,
  });

  return response.hits;
}

/**
 * Get front page stories
 */
export async function getFrontPageStories(): Promise<HNAlgoliaStory[]> {
  const response = await searchHN({
    query: "",
    tags: ["front_page"],
    hitsPerPage: 30,
  });

  return response.hits;
}

/**
 * Search multiple keywords efficiently
 * Combines multiple queries into a single OR search
 */
export async function searchMultipleKeywords(
  keywords: string[],
  hoursAgo: number = 24
): Promise<HNAlgoliaStory[]> {
  // Combine keywords into an OR search
  // Algolia supports OR queries
  const query = keywords
    .map((k) => (k.includes(" ") ? `"${k}"` : k))
    .join(" OR ");

  const timestamp = Math.floor(Date.now() / 1000) - hoursAgo * 3600;
  const numericFilters = `created_at_i>${timestamp}`;

  const response = await searchHNByDate({
    query,
    tags: ["story"],
    hitsPerPage: 100,
    numericFilters,
  });

  return response.hits;
}

/**
 * Get story URL (HN discussion page)
 */
export function getStoryUrl(objectID: string): string {
  return `https://news.ycombinator.com/item?id=${objectID}`;
}

/**
 * Get comment URL (links to specific comment)
 */
export function getCommentUrl(objectID: string): string {
  return `https://news.ycombinator.com/item?id=${objectID}`;
}
