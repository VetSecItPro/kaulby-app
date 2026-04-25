import { describe, it, expect } from "vitest";
import { extractUrlsFromAiOutput, extractUrlsFromSuggestions } from "../extract-urls";

describe("extractUrlsFromAiOutput — SEC-LLM-005", () => {
  it("returns empty result for text with no URLs", () => {
    const r = extractUrlsFromAiOutput("Just a regular reply with no links.");
    expect(r.urls).toEqual([]);
    expect(r.hasExternalUrls).toBe(false);
    expect(r.warningMessage).toBeNull();
  });

  it("extracts a single external URL", () => {
    const r = extractUrlsFromAiOutput("Check out https://evil.example.com/phish for more.");
    expect(r.urls).toContain("https://evil.example.com/phish");
    expect(r.hasExternalUrls).toBe(true);
    expect(r.warningMessage).toMatch(/external link/);
  });

  it("extracts multiple URLs and dedupes", () => {
    const text = "See https://a.com and https://b.com — also https://a.com again.";
    const r = extractUrlsFromAiOutput(text);
    expect(r.urls).toEqual(["https://a.com", "https://b.com"]);
    expect(r.warningMessage).toMatch(/2 external links/);
  });

  it("trims trailing punctuation from URLs", () => {
    const r = extractUrlsFromAiOutput("Visit https://example.com/path. Or https://other.com,");
    expect(r.urls).toContain("https://example.com/path");
    expect(r.urls).toContain("https://other.com");
  });

  it("does not flag first-party URLs as external", () => {
    const r = extractUrlsFromAiOutput("Read more at https://kaulbyapp.com/docs/guide");
    expect(r.urls).toContain("https://kaulbyapp.com/docs/guide");
    expect(r.hasExternalUrls).toBe(false);
    expect(r.warningMessage).toBeNull();
  });

  it("flags external URL even when first-party is also present", () => {
    const r = extractUrlsFromAiOutput("See https://kaulbyapp.com and https://attacker.com");
    expect(r.urls).toHaveLength(2);
    expect(r.hasExternalUrls).toBe(true);
  });

  it("handles http (not just https)", () => {
    const r = extractUrlsFromAiOutput("Old link: http://insecure.example/page");
    expect(r.urls).toContain("http://insecure.example/page");
    expect(r.hasExternalUrls).toBe(true);
  });

  it("handles empty/null input", () => {
    expect(extractUrlsFromAiOutput("").urls).toEqual([]);
    // @ts-expect-error testing runtime safety
    expect(extractUrlsFromAiOutput(null).urls).toEqual([]);
  });
});

describe("extractUrlsFromSuggestions — batch", () => {
  it("returns per-suggestion results + top-level any-external flag", () => {
    const result = extractUrlsFromSuggestions([
      { text: "Plain reply, no links" },
      { text: "Visit https://attacker.com/phish for help" },
      { text: "See https://kaulbyapp.com/pricing" },
    ]);
    expect(result.perSuggestion).toHaveLength(3);
    expect(result.perSuggestion[0].hasExternalUrls).toBe(false);
    expect(result.perSuggestion[1].hasExternalUrls).toBe(true);
    expect(result.perSuggestion[2].hasExternalUrls).toBe(false);
    expect(result.anyHasExternalUrls).toBe(true);
  });

  it("anyHasExternalUrls is false when no suggestion has external URL", () => {
    const result = extractUrlsFromSuggestions([
      { text: "Plain reply" },
      { text: "https://kaulbyapp.com/docs" },
    ]);
    expect(result.anyHasExternalUrls).toBe(false);
  });
});
