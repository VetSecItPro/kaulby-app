import { describe, it, expect } from "vitest";
import { splitTextForHighlighting, extractKeywords } from "../highlight-keywords";

describe("highlight-keywords", () => {
  describe("extractKeywords", () => {
    it("filters out empty/whitespace-only keywords", () => {
      expect(extractKeywords(["foo", "", "  ", "bar"])).toEqual(["foo", "bar"]);
    });

    it("returns all keywords when none are empty", () => {
      expect(extractKeywords(["saas", "startup"])).toEqual(["saas", "startup"]);
    });

    it("returns empty array for all-empty input", () => {
      expect(extractKeywords(["", "  "])).toEqual([]);
    });

    it("handles empty array", () => {
      expect(extractKeywords([])).toEqual([]);
    });
  });

  describe("splitTextForHighlighting", () => {
    it("returns empty array for empty text", () => {
      expect(splitTextForHighlighting("", ["foo"])).toEqual([]);
    });

    it("returns single non-highlighted part when no keywords", () => {
      const parts = splitTextForHighlighting("Hello world", []);
      expect(parts).toEqual([{ text: "Hello world", isHighlighted: false }]);
    });

    it("returns single non-highlighted part when no matches", () => {
      const parts = splitTextForHighlighting("Hello world", ["xyz"]);
      expect(parts).toEqual([{ text: "Hello world", isHighlighted: false }]);
    });

    it("highlights a single keyword match", () => {
      const parts = splitTextForHighlighting("I love SaaS tools", ["SaaS"]);
      expect(parts).toEqual([
        { text: "I love ", isHighlighted: false },
        { text: "SaaS", isHighlighted: true, keyword: "SaaS" },
        { text: " tools", isHighlighted: false },
      ]);
    });

    it("highlights case-insensitively", () => {
      const parts = splitTextForHighlighting("I love SAAS tools", ["saas"]);
      expect(parts).toHaveLength(3);
      expect(parts[1].isHighlighted).toBe(true);
      expect(parts[1].text).toBe("SAAS"); // preserves original case
    });

    it("highlights multiple occurrences of same keyword", () => {
      const parts = splitTextForHighlighting("foo bar foo baz foo", ["foo"]);
      const highlighted = parts.filter((p) => p.isHighlighted);
      expect(highlighted).toHaveLength(3);
    });

    it("highlights multiple different keywords", () => {
      const parts = splitTextForHighlighting(
        "The startup built a SaaS product",
        ["startup", "SaaS"]
      );
      const highlighted = parts.filter((p) => p.isHighlighted);
      expect(highlighted).toHaveLength(2);
      expect(highlighted[0].text).toBe("startup");
      expect(highlighted[1].text).toBe("SaaS");
    });

    it("handles keyword at the beginning of text", () => {
      const parts = splitTextForHighlighting("SaaS is great", ["SaaS"]);
      expect(parts[0].isHighlighted).toBe(true);
      expect(parts[0].text).toBe("SaaS");
    });

    it("handles keyword at the end of text", () => {
      const parts = splitTextForHighlighting("I use SaaS", ["SaaS"]);
      const last = parts[parts.length - 1];
      expect(last.isHighlighted).toBe(true);
      expect(last.text).toBe("SaaS");
    });

    it("handles overlapping keywords by merging matches", () => {
      // "startup" and "star" overlap
      const parts = splitTextForHighlighting("My startup rocks", ["star", "startup"]);
      // Should handle this gracefully - at minimum the region should be highlighted
      const highlighted = parts.filter((p) => p.isHighlighted);
      expect(highlighted.length).toBeGreaterThanOrEqual(1);
    });

    it("handles entire text as a match", () => {
      const parts = splitTextForHighlighting("SaaS", ["SaaS"]);
      expect(parts).toHaveLength(1);
      expect(parts[0].isHighlighted).toBe(true);
    });

    it("skips empty/whitespace keywords", () => {
      const parts = splitTextForHighlighting("Hello world", ["", "  "]);
      expect(parts).toEqual([{ text: "Hello world", isHighlighted: false }]);
    });

    it("handles special regex characters in keywords safely", () => {
      // Keywords are matched with indexOf, not regex, so special chars are fine
      const parts = splitTextForHighlighting("price is $100.00 each", ["$100.00"]);
      const highlighted = parts.filter((p) => p.isHighlighted);
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0].text).toBe("$100.00");
    });
  });
});
