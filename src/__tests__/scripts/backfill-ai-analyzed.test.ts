import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const { mockSelect, mockUpdate, mockSet, mockWhereSelect, mockWhereUpdate } =
  vi.hoisted(() => {
    return {
      mockSelect: vi.fn(),
      mockUpdate: vi.fn(),
      mockSet: vi.fn(),
      mockWhereSelect: vi.fn(),
      mockWhereUpdate: vi.fn(),
    };
  });

vi.mock("dotenv", () => ({ config: vi.fn() }));

vi.mock("@/lib/db", () => ({
  pooledDb: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock("../../../lib/db", () => ({
  pooledDb: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock("../../lib/db", () => ({
  pooledDb: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

// Script imports from "../src/lib/db" relative to scripts/ dir.
vi.mock("../src/lib/db", () => ({
  pooledDb: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock("../src/lib/db/schema", () => ({
  results: {
    aiAnalyzed: "ai_analyzed",
    aiSummary: "ai_summary",
    aiError: "ai_error",
  },
}));

vi.mock("@/lib/db/schema", () => ({
  results: {
    aiAnalyzed: "ai_analyzed",
    aiSummary: "ai_summary",
    aiError: "ai_error",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => ({ _tag: "AND", parts: args })),
  eq: vi.fn((col, val) => ({ _tag: "EQ", col, val })),
  isNull: vi.fn((col) => ({ _tag: "ISNULL", col })),
  relations: vi.fn(() => ({})),
  sql: Object.assign(
    function sql() {
      return "SQL_EXPRESSION";
    },
    { raw: vi.fn() },
  ),
}));

// --- Imports ---
import {
  main,
  FALLBACK_SUMMARY,
  BACKFILL_MARKER,
} from "../../../scripts/backfill-ai-analyzed";
import { and, eq, isNull } from "drizzle-orm";

// --- Helpers ---

function setCount(n: number) {
  mockWhereSelect.mockResolvedValueOnce([{ count: n }]);
  mockSelect.mockReturnValueOnce({
    from: () => ({ where: mockWhereSelect }),
  });
}

function setUpdateResult(rowCount: number) {
  mockWhereUpdate.mockResolvedValueOnce({ rowCount });
  mockSet.mockReturnValueOnce({ where: mockWhereUpdate });
  mockUpdate.mockReturnValueOnce({ set: mockSet });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("backfill-ai-analyzed script", () => {
  it("dry-run logs count and does not call update()", async () => {
    setCount(42);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await main({ dryRun: true });

    expect(result).toEqual({ count: 42, updated: 0, dryRun: true });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Found 42 historical fallback-fired rows"),
    );
    expect(logSpy).toHaveBeenCalledWith("Dry run - no writes.");

    logSpy.mockRestore();
  });

  it("real run calls update() with aiAnalyzed=false and backfill marker", async () => {
    setCount(7);
    setUpdateResult(7);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await main({ dryRun: false });

    expect(result).toEqual({ count: 7, updated: 7, dryRun: false });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({
      aiAnalyzed: false,
      aiError: BACKFILL_MARKER,
    });

    // Verify WHERE clause: isNull(aiAnalyzed) AND eq(aiSummary, FALLBACK_SUMMARY)
    expect(isNull).toHaveBeenCalledWith("ai_analyzed");
    expect(eq).toHaveBeenCalledWith("ai_summary", FALLBACK_SUMMARY);
    expect(and).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("does not touch rows already with aiAnalyzed=true or aiAnalyzed=false (WHERE uses IS NULL only)", async () => {
    setCount(0);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await main({ dryRun: false });

    // count=0 means no matching rows -> update NOT called (early exit)
    expect(result).toEqual({ count: 0, updated: 0, dryRun: false });
    expect(mockUpdate).not.toHaveBeenCalled();

    // The WHERE predicate must filter by isNull(aiAnalyzed), proving
    // non-null rows (already-true or already-false) are excluded.
    expect(isNull).toHaveBeenCalledWith("ai_analyzed");

    logSpy.mockRestore();
  });

  it("filters by exact fallback summary fingerprint, excluding non-fallback rows", async () => {
    setCount(3);
    setUpdateResult(3);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await main({ dryRun: false });

    // Every eq() call on aiSummary must be the exact FALLBACK_SUMMARY string.
    const summaryCalls = (eq as unknown as { mock: { calls: unknown[][] } })
      .mock.calls.filter((c) => c[0] === "ai_summary");
    expect(summaryCalls.length).toBeGreaterThan(0);
    for (const call of summaryCalls) {
      expect(call[1]).toBe(FALLBACK_SUMMARY);
    }

    logSpy.mockRestore();
  });

  it("exports the exact fallback summary fingerprint from the old code path", () => {
    expect(FALLBACK_SUMMARY).toBe(
      "Analysis temporarily unavailable. Content has been saved and will be analyzed on the next cycle.",
    );
  });
});
