import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database and cache modules before importing
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      userDetectionKeywords: {
        findMany: vi.fn(),
      },
    },
  },
  userDetectionKeywords: {
    userId: "userId",
    isActive: "isActive",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

import { matchDetectionKeywords } from "../detection-matcher";
import { db } from "@/lib/db";
import { cache } from "@/lib/cache";

describe("matchDetectionKeywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("returns null when user has no keywords", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await matchDetectionKeywords("some content", "user-1");
    expect(result).toBeNull();
  });

  it("matches content against user keywords (case-insensitive)", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "solution_request", keywords: ["looking for", "need help"], isActive: true },
    ]);

    const result = await matchDetectionKeywords(
      "I am LOOKING FOR a new tool",
      "user-1"
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("solution_request");
    expect(result!.matchedKeyword).toBe("looking for");
  });

  it("picks the longest matching keyword for higher confidence", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        category: "solution_request",
        keywords: ["tool", "looking for a new tool"],
        isActive: true,
      },
    ]);

    const result = await matchDetectionKeywords(
      "I am looking for a new tool to use",
      "user-1"
    );
    expect(result).not.toBeNull();
    expect(result!.matchedKeyword).toBe("looking for a new tool");
    expect(result!.confidence).toBeGreaterThan(0.6);
  });

  it("returns the best match across multiple categories", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["frustrated"], isActive: true },
      {
        category: "solution_request",
        keywords: ["very frustrated with current solution"],
        isActive: true,
      },
    ]);

    const result = await matchDetectionKeywords(
      "I am very frustrated with current solution",
      "user-1"
    );
    expect(result).not.toBeNull();
    // The longer keyword should win (higher confidence)
    expect(result!.category).toBe("solution_request");
  });

  it("returns null when content does not match any keyword", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["broken", "crash"], isActive: true },
    ]);

    const result = await matchDetectionKeywords(
      "Everything is working great today!",
      "user-1"
    );
    expect(result).toBeNull();
  });

  it("uses cached keywords when available", async () => {
    const cachedKeywords = {
      solution_request: ["need a tool"],
    };
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(cachedKeywords);

    const result = await matchDetectionKeywords(
      "I need a tool for this",
      "user-1"
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe("solution_request");
    // DB should not be called when cache hit
    expect(db.query.userDetectionKeywords.findMany).not.toHaveBeenCalled();
  });

  it("caches keywords after DB lookup", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["broken"], isActive: true },
    ]);

    await matchDetectionKeywords("something broken here", "user-1");
    expect(cache.set).toHaveBeenCalledWith(
      "detection-kw:user-1",
      { pain_point: ["broken"] },
      5 * 60 * 1000
    );
  });

  it("confidence increases with keyword length", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["bug"], isActive: true },
    ]);

    const shortResult = await matchDetectionKeywords("found a bug", "user-1");

    vi.clearAllMocks();
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        category: "pain_point",
        keywords: ["critical production bug in the system"],
        isActive: true,
      },
    ]);

    const longResult = await matchDetectionKeywords(
      "we have a critical production bug in the system",
      "user-1"
    );

    expect(longResult!.confidence).toBeGreaterThan(shortResult!.confidence);
  });

  it("caps confidence at 0.9", async () => {
    const veryLongKeyword = "a".repeat(100);
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: [veryLongKeyword], isActive: true },
    ]);

    const result = await matchDetectionKeywords(
      veryLongKeyword + " extra text",
      "user-1"
    );
    expect(result!.confidence).toBeLessThanOrEqual(0.9);
  });
});
