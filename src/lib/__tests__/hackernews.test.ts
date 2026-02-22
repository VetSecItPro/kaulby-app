import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchMultipleKeywords, getStoryUrl } from "../hackernews";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as never;

describe("hackernews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchMultipleKeywords", () => {
    it("searches for multiple keywords", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: [
              {
                objectID: "123456",
                title: "Test Story",
                author: "testuser",
                created_at: "2025-01-01T00:00:00Z",
                created_at_i: 1704067200,
                points: 100,
                num_comments: 50,
                _tags: ["story"],
              },
            ],
            page: 0,
            nbPages: 1,
            nbHits: 1,
            hitsPerPage: 100,
            processingTimeMS: 10,
          }),
      });

      const results = await searchMultipleKeywords(["saas", "startup"], 24);

      expect(results).toHaveLength(1);
      expect(results[0].objectID).toBe("123456");
      expect(results[0].title).toBe("Test Story");
    });

    it("combines keywords with OR operator", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: [],
            page: 0,
            nbPages: 0,
            nbHits: 0,
            hitsPerPage: 100,
            processingTimeMS: 5,
          }),
      });

      await searchMultipleKeywords(["keyword1", "keyword2", "keyword3"], 24);

      const callUrl = mockFetch.mock.calls[0][0];
      // URL-encoded: spaces become +, so "keyword1 OR keyword2 OR keyword3" becomes "keyword1+OR+keyword2+OR+keyword3"
      expect(callUrl).toContain("keyword1+OR+keyword2+OR+keyword3");
    });

    it("quotes multi-word keywords", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hits: [], page: 0, nbPages: 0, nbHits: 0, hitsPerPage: 100, processingTimeMS: 5 }),
      });

      await searchMultipleKeywords(["multi word keyword", "single"], 24);

      const callUrl = mockFetch.mock.calls[0][0];
      // URL-encoded: quotes become %22, spaces become +, so '"multi word keyword"' becomes '%22multi+word+keyword%22'
      expect(callUrl).toContain("%22multi+word+keyword%22");
    });

    it("filters by time range", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hits: [], page: 0, nbPages: 0, nbHits: 0, hitsPerPage: 100, processingTimeMS: 5 }),
      });

      const hoursAgo = 48;
      await searchMultipleKeywords(["test"], hoursAgo);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("numericFilters");
      // URL-encoded: > becomes %3E, so "created_at_i>" becomes "created_at_i%3E"
      expect(callUrl).toContain("created_at_i%3E");
    });

    it("defaults to 24 hours when not specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hits: [], page: 0, nbPages: 0, nbHits: 0, hitsPerPage: 100, processingTimeMS: 5 }),
      });

      await searchMultipleKeywords(["test"]);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("numericFilters");
    });

    it("throws error when API call fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(searchMultipleKeywords(["test"], 24)).rejects.toThrow(
        "HN Algolia API error: 500"
      );
    });

    it("searches with tags=story by default", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hits: [], page: 0, nbPages: 0, nbHits: 0, hitsPerPage: 100, processingTimeMS: 5 }),
      });

      await searchMultipleKeywords(["test"], 24);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("tags=story");
    });

    it("uses search_by_date endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hits: [], page: 0, nbPages: 0, nbHits: 0, hitsPerPage: 100, processingTimeMS: 5 }),
      });

      await searchMultipleKeywords(["test"], 24);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("search_by_date");
    });

    it("returns all story fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: [
              {
                objectID: "999",
                title: "Full Story",
                url: "https://example.com",
                author: "author1",
                story_text: "Story content",
                comment_text: null,
                created_at: "2025-01-15T10:00:00Z",
                created_at_i: 1736935200,
                points: 250,
                num_comments: 100,
                story_id: 998,
                parent_id: 997,
                _tags: ["story", "front_page"],
              },
            ],
            page: 0,
            nbPages: 1,
            nbHits: 1,
            hitsPerPage: 100,
            processingTimeMS: 8,
          }),
      });

      const results = await searchMultipleKeywords(["test"], 24);

      expect(results[0]).toHaveProperty("objectID");
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("url");
      expect(results[0]).toHaveProperty("author");
      expect(results[0]).toHaveProperty("created_at");
      expect(results[0]).toHaveProperty("points");
      expect(results[0]).toHaveProperty("num_comments");
    });
  });

  describe("getStoryUrl", () => {
    it("generates correct HN URL", () => {
      const url = getStoryUrl("123456");
      expect(url).toBe("https://news.ycombinator.com/item?id=123456");
    });

    it("handles numeric IDs", () => {
      const url = getStoryUrl("987654321");
      expect(url).toBe("https://news.ycombinator.com/item?id=987654321");
    });

    it("preserves objectID as-is", () => {
      const objectID = "abc123";
      const url = getStoryUrl(objectID);
      expect(url).toContain(objectID);
    });
  });
});
