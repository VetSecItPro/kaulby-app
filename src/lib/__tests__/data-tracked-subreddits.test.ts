import { describe, it, expect } from "vitest";
import {
  PRIORITY_SUBREDDITS,
  EXTENDED_SUBREDDITS,
  ALL_TRACKED_SUBREDDITS,
} from "../data/tracked-subreddits";

describe("data/tracked-subreddits", () => {
  describe("PRIORITY_SUBREDDITS", () => {
    it("contains at least 20 subreddits", () => {
      expect(PRIORITY_SUBREDDITS.length).toBeGreaterThanOrEqual(20);
    });

    it("all subreddits are strings", () => {
      for (const subreddit of PRIORITY_SUBREDDITS) {
        expect(typeof subreddit).toBe("string");
        expect(subreddit.length).toBeGreaterThan(0);
      }
    });

    it("all subreddits are unique", () => {
      const uniqueSubreddits = new Set(PRIORITY_SUBREDDITS);
      expect(uniqueSubreddits.size).toBe(PRIORITY_SUBREDDITS.length);
    });

    it("no subreddits start with r/", () => {
      for (const subreddit of PRIORITY_SUBREDDITS) {
        expect(subreddit.startsWith("r/")).toBe(false);
      }
    });

    it("contains expected business subreddits", () => {
      expect(PRIORITY_SUBREDDITS).toContain("startups");
      expect(PRIORITY_SUBREDDITS).toContain("entrepreneur");
      expect(PRIORITY_SUBREDDITS).toContain("SaaS");
    });

    it("contains expected tech subreddits", () => {
      expect(PRIORITY_SUBREDDITS).toContain("webdev");
      expect(PRIORITY_SUBREDDITS).toContain("programming");
    });
  });

  describe("EXTENDED_SUBREDDITS", () => {
    it("contains at least 10 subreddits", () => {
      expect(EXTENDED_SUBREDDITS.length).toBeGreaterThanOrEqual(10);
    });

    it("all subreddits are strings", () => {
      for (const subreddit of EXTENDED_SUBREDDITS) {
        expect(typeof subreddit).toBe("string");
        expect(subreddit.length).toBeGreaterThan(0);
      }
    });

    it("all subreddits are unique", () => {
      const uniqueSubreddits = new Set(EXTENDED_SUBREDDITS);
      expect(uniqueSubreddits.size).toBe(EXTENDED_SUBREDDITS.length);
    });

    it("no overlap with priority subreddits", () => {
      const prioritySet = new Set(PRIORITY_SUBREDDITS);
      for (const subreddit of EXTENDED_SUBREDDITS) {
        expect(prioritySet.has(subreddit)).toBe(false);
      }
    });
  });

  describe("ALL_TRACKED_SUBREDDITS", () => {
    it("combines priority and extended subreddits", () => {
      const expectedLength = PRIORITY_SUBREDDITS.length + EXTENDED_SUBREDDITS.length;
      expect(ALL_TRACKED_SUBREDDITS.length).toBe(expectedLength);
    });

    it("starts with priority subreddits", () => {
      for (let i = 0; i < PRIORITY_SUBREDDITS.length; i++) {
        expect(ALL_TRACKED_SUBREDDITS[i]).toBe(PRIORITY_SUBREDDITS[i]);
      }
    });

    it("ends with extended subreddits", () => {
      const offset = PRIORITY_SUBREDDITS.length;
      for (let i = 0; i < EXTENDED_SUBREDDITS.length; i++) {
        expect(ALL_TRACKED_SUBREDDITS[offset + i]).toBe(EXTENDED_SUBREDDITS[i]);
      }
    });

    it("all entries are unique", () => {
      const uniqueSubreddits = new Set(ALL_TRACKED_SUBREDDITS);
      expect(uniqueSubreddits.size).toBe(ALL_TRACKED_SUBREDDITS.length);
    });

    it("contains at least 50 subreddits total", () => {
      expect(ALL_TRACKED_SUBREDDITS.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe("data quality", () => {
    it("no empty strings in any list", () => {
      expect(PRIORITY_SUBREDDITS.every((s) => s.length > 0)).toBe(true);
      expect(EXTENDED_SUBREDDITS.every((s) => s.length > 0)).toBe(true);
      expect(ALL_TRACKED_SUBREDDITS.every((s) => s.length > 0)).toBe(true);
    });

    it("no whitespace-only entries", () => {
      expect(PRIORITY_SUBREDDITS.every((s) => s.trim().length > 0)).toBe(true);
      expect(EXTENDED_SUBREDDITS.every((s) => s.trim().length > 0)).toBe(true);
    });

    it("subreddit names have valid characters", () => {
      const validPattern = /^[a-zA-Z0-9_]+$/;
      for (const subreddit of ALL_TRACKED_SUBREDDITS) {
        expect(subreddit).toMatch(validPattern);
      }
    });
  });
});
