import { describe, it, expect } from "vitest";
import {
  parseSearchQuery,
  matchesQuery,
  validateSearchQuery,
  keywordsToQuery,
} from "../search-parser";

describe("parseSearchQuery", () => {
  it("parses simple keyword", () => {
    const result = parseSearchQuery("monitoring");
    expect(result.required).toHaveLength(1);
    expect(result.required[0].term).toBe("monitoring");
    expect(result.required[0].isExact).toBe(false);
  });

  it("parses multiple keywords as AND", () => {
    const result = parseSearchQuery("monitoring tools");
    expect(result.required).toHaveLength(2);
    expect(result.required[0].term).toBe("monitoring");
    expect(result.required[1].term).toBe("tools");
  });

  it("parses quoted exact phrase", () => {
    const result = parseSearchQuery('"social listening"');
    expect(result.required).toHaveLength(1);
    expect(result.required[0].term).toBe("social listening");
    expect(result.required[0].isExact).toBe(true);
  });

  it("parses OR operator", () => {
    const result = parseSearchQuery("monitoring OR listening");
    expect(result.required).toHaveLength(1);
    expect(result.required[0].term).toBe("monitoring");
    expect(result.optional).toHaveLength(1);
    expect(result.optional[0].term).toBe("listening");
  });

  it("parses NOT operator", () => {
    const result = parseSearchQuery("monitoring NOT spam");
    expect(result.required).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].term).toBe("spam");
  });

  it("parses dash as NOT", () => {
    const result = parseSearchQuery("monitoring - spam");
    expect(result.required).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].term).toBe("spam");
  });

  it("parses AND operator (explicit, same as default)", () => {
    const result = parseSearchQuery("monitoring AND tools");
    expect(result.required).toHaveLength(2);
    expect(result.optional).toHaveLength(0);
  });

  it("parses field filters", () => {
    const result = parseSearchQuery("title:monitoring body:review author:john");
    expect(result.filters.title).toEqual(["monitoring"]);
    expect(result.filters.body).toEqual(["review"]);
    expect(result.filters.author).toEqual(["john"]);
  });

  it("parses platform filter", () => {
    const result = parseSearchQuery("platform:reddit monitoring");
    expect(result.filters.platform).toEqual(["reddit"]);
    expect(result.required).toHaveLength(1);
  });

  it("parses subreddit filter", () => {
    const result = parseSearchQuery("subreddit:startups monitoring");
    expect(result.filters.subreddit).toEqual(["startups"]);
  });

  it("handles empty query", () => {
    const result = parseSearchQuery("");
    expect(result.required).toHaveLength(0);
    expect(result.explanation).toBe("Empty query matches all");
  });

  it("handles whitespace-only query", () => {
    const result = parseSearchQuery("   ");
    expect(result.required).toHaveLength(0);
  });

  it("preserves original query", () => {
    const query = "monitoring OR listening NOT spam";
    const result = parseSearchQuery(query);
    expect(result.original).toBe(query);
  });

  it("generates human-readable explanation", () => {
    const result = parseSearchQuery("monitoring NOT spam");
    expect(result.explanation).toContain("Must contain");
    expect(result.explanation).toContain("Must NOT contain");
  });
});

describe("matchesQuery", () => {
  it("matches required terms", () => {
    const query = parseSearchQuery("monitoring tools");
    const result = matchesQuery(
      { title: "Best monitoring tools for SaaS", body: "" },
      query
    );
    expect(result.matches).toBe(true);
  });

  it("rejects when missing required term", () => {
    const query = parseSearchQuery("monitoring dashboard");
    const result = matchesQuery(
      { title: "Best monitoring tools", body: "" },
      query
    );
    expect(result.matches).toBe(false);
    expect(result.explanation).toContain("Missing required term");
  });

  it("matches with OR (at least one optional)", () => {
    const query = parseSearchQuery("required OR optional1 OR optional2");
    const result = matchesQuery(
      { title: "required optional1 content", body: "" },
      query
    );
    expect(result.matches).toBe(true);
  });

  it("rejects when no optional terms match", () => {
    const query = parseSearchQuery("required OR missing1 OR missing2");
    const result = matchesQuery(
      { title: "required content here", body: "" },
      query
    );
    expect(result.matches).toBe(false);
    expect(result.explanation).toContain("optional terms");
  });

  it("rejects content with excluded terms", () => {
    const query = parseSearchQuery("monitoring NOT spam");
    const result = matchesQuery(
      { title: "monitoring spam bot detected", body: "" },
      query
    );
    expect(result.matches).toBe(false);
    expect(result.explanation).toContain("excluded term");
  });

  it("matches case-insensitively", () => {
    const query = parseSearchQuery("Monitoring");
    const result = matchesQuery(
      { title: "MONITORING TOOLS", body: "" },
      query
    );
    expect(result.matches).toBe(true);
  });

  it("matches in body text", () => {
    const query = parseSearchQuery("monitoring");
    const result = matchesQuery(
      { title: "Question", body: "How do I set up monitoring?" },
      query
    );
    expect(result.matches).toBe(true);
  });

  it("applies title filter", () => {
    const query = parseSearchQuery("title:monitoring");
    const titleMatch = matchesQuery(
      { title: "monitoring tools", body: "unrelated" },
      query
    );
    expect(titleMatch.matches).toBe(true);

    const noTitleMatch = matchesQuery(
      { title: "Best tools", body: "monitoring is great" },
      query
    );
    expect(noTitleMatch.matches).toBe(false);
  });

  it("applies body filter", () => {
    const query = parseSearchQuery("body:monitoring");
    const bodyMatch = matchesQuery(
      { title: "Question", body: "monitoring tools review" },
      query
    );
    expect(bodyMatch.matches).toBe(true);
  });

  it("applies author filter", () => {
    const query = parseSearchQuery("author:john");
    const match = matchesQuery(
      { title: "Post", body: "", author: "john" },
      query
    );
    expect(match.matches).toBe(true);

    const noMatch = matchesQuery(
      { title: "Post", body: "", author: "jane" },
      query
    );
    expect(noMatch.matches).toBe(false);
  });

  it("applies platform filter", () => {
    const query = parseSearchQuery("platform:reddit monitoring");
    const match = matchesQuery(
      { title: "monitoring tools", platform: "reddit" },
      query
    );
    expect(match.matches).toBe(true);

    const noMatch = matchesQuery(
      { title: "monitoring tools", platform: "hackernews" },
      query
    );
    expect(noMatch.matches).toBe(false);
  });

  it("returns matched terms", () => {
    const query = parseSearchQuery("monitoring tools");
    const result = matchesQuery(
      { title: "monitoring tools review" },
      query
    );
    expect(result.matchedTerms).toContain("monitoring");
    expect(result.matchedTerms).toContain("tools");
  });
});

describe("validateSearchQuery", () => {
  it("accepts valid simple query", () => {
    expect(validateSearchQuery("monitoring tools").valid).toBe(true);
  });

  it("accepts valid boolean query", () => {
    expect(validateSearchQuery("monitoring OR listening NOT spam").valid).toBe(true);
  });

  it("accepts valid quoted query", () => {
    expect(validateSearchQuery('"social listening"').valid).toBe(true);
  });

  it("rejects unmatched quotes", () => {
    const result = validateSearchQuery('"unmatched');
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Unmatched quote");
  });

  it("rejects empty field values", () => {
    const result = validateSearchQuery("title: ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Empty field value");
  });

  it("rejects lonely operators", () => {
    expect(validateSearchQuery("AND").valid).toBe(false);
    expect(validateSearchQuery("OR").valid).toBe(false);
    expect(validateSearchQuery("NOT").valid).toBe(false);
  });
});

describe("keywordsToQuery", () => {
  it("converts keyword array to OR query", () => {
    const result = keywordsToQuery(["monitoring", "listening"]);
    expect(result.required).toHaveLength(1);
    expect(result.optional).toHaveLength(1);
  });

  it("quotes keywords with spaces", () => {
    const result = keywordsToQuery(["social listening", "brand monitoring"]);
    expect(result.required[0].isExact).toBe(true);
    expect(result.required[0].term).toBe("social listening");
  });

  it("handles single keyword", () => {
    const result = keywordsToQuery(["monitoring"]);
    expect(result.required).toHaveLength(1);
    expect(result.optional).toHaveLength(0);
  });

  it("handles empty array", () => {
    const result = keywordsToQuery([]);
    expect(result.required).toHaveLength(0);
  });
});
