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
    delete: vi.fn().mockResolvedValue(true),
  },
}));

import { matchDetectionKeywords, invalidateKeywordsCache } from "../detection-matcher";
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
      // Tier 1 Task 1.3: TTL raised from 5min to 60min. Keywords change rarely;
      // stale reads are bounded by explicit invalidation on write, not the TTL.
      60 * 60 * 1000
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

describe("matchDetectionKeywords - fuzzy matching (Task 1.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("fuzzy matches a 1-char typo (pricing -> priceing)", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["pricing"], isActive: true },
    ]);

    const result = await matchDetectionKeywords(
      "Their priceing is confusing",
      "user-1"
    );
    expect(result).not.toBeNull();
    expect(result!.matchedKeyword).toBe("pricing");
  });

  it("fuzzy matches a 2-char typo (pricing -> priiceing)", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["pricing"], isActive: true },
    ]);

    const result = await matchDetectionKeywords(
      "Their priiceing model is weird",
      "user-1"
    );
    expect(result).not.toBeNull();
    expect(result!.matchedKeyword).toBe("pricing");
  });

  it("rejects a 3-char-distance typo (pricing -> priiccieng)", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["pricing"], isActive: true },
    ]);

    const result = await matchDetectionKeywords(
      "something priiccieng over here",
      "user-1"
    );
    expect(result).toBeNull();
  });

  it("skips fuzzy matching for short keywords (<5 chars)", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["app"], isActive: true },
    ]);

    // "pap" and "apk" are 1 edit away from "app" but should NOT match because
    // the keyword is below the fuzzy minimum length (too many false positives).
    const result = await matchDetectionKeywords(
      "I tried pap and apk versions",
      "user-1"
    );
    expect(result).toBeNull();
  });

  it("exact match still beats fuzzy match when both appear", async () => {
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["pricing"], isActive: true },
    ]);

    // Content contains both the typo AND the real word - the exact match
    // should be the one that sets confidence (baseConfidence, no penalty).
    const result = await matchDetectionKeywords(
      "priceing sucks and pricing is high",
      "user-1"
    );
    expect(result).not.toBeNull();
    // Base confidence for length 7 = 0.6 + 7*0.02 = 0.74. Exact match keeps that.
    // Fuzzy path would yield 0.74 - 0.15 = 0.59. Exact must win.
    expect(result!.confidence).toBeCloseTo(0.74, 5);
  });

  it("fuzzy confidence is lower than exact for the same keyword", async () => {
    // Exact hit
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["pricing"], isActive: true },
    ]);
    const exactResult = await matchDetectionKeywords("the pricing model", "user-1");

    // Fuzzy hit only
    vi.clearAllMocks();
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (db.query.userDetectionKeywords.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { category: "pain_point", keywords: ["pricing"], isActive: true },
    ]);
    const fuzzyResult = await matchDetectionKeywords("the priceing model", "user-1");

    expect(exactResult).not.toBeNull();
    expect(fuzzyResult).not.toBeNull();
    expect(fuzzyResult!.confidence).toBeLessThan(exactResult!.confidence);
    // Penalty is exactly 0.15.
    expect(exactResult!.confidence - fuzzyResult!.confidence).toBeCloseTo(0.15, 5);
  });
});

describe("invalidateKeywordsCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the per-user cache entry by the same key shape used for reads", async () => {
    // The paired invariant: write path evicts what the read path loads.
    // If the key shape ever drifts, TTL (1h) would mask stale keyword reads
    // for up to an hour after user edits.
    await invalidateKeywordsCache("user-123");
    expect(cache.delete).toHaveBeenCalledWith("detection-kw:user-123");
  });

  it("never touches other users' cache entries", async () => {
    await invalidateKeywordsCache("user-a");
    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).not.toHaveBeenCalledWith("detection-kw:user-b");
  });
});
