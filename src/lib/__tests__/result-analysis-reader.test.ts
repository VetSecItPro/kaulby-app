import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Task DL.2 Phase 1 — reader helper tests. Verifies the precedence contract:
 *   1. new `result_analyses` table wins
 *   2. legacy `results.aiAnalysis` column is used as fallback
 *   3. null when neither has data
 */

const resultAnalysesFindFirst = vi.fn();
const resultsFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      resultAnalyses: { findFirst: (...args: unknown[]) => resultAnalysesFindFirst(...args) },
      results: { findFirst: (...args: unknown[]) => resultsFindFirst(...args) },
    },
  },
}));

vi.mock("@/lib/db/schema", () => ({
  resultAnalyses: { resultId: "resultId" },
  results: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

import { getResultAnalysis } from "@/lib/result-analysis-reader";

describe("getResultAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the new-table analysis when present (object form)", async () => {
    resultAnalysesFindFirst.mockResolvedValueOnce({
      resultId: "r1",
      analysis: { tier: "team", summary: "new" },
      tier: "team",
    });

    const out = await getResultAnalysis("r1");
    expect(out).toEqual({ tier: "team", summary: "new" });
    expect(resultsFindFirst).not.toHaveBeenCalled();
  });

  it("falls back to legacy stringified JSONB column when new table is empty", async () => {
    resultAnalysesFindFirst.mockResolvedValueOnce(null);
    resultsFindFirst.mockResolvedValueOnce({
      aiAnalysis: JSON.stringify({ tier: "pro", summary: "legacy" }),
    });

    const out = await getResultAnalysis("r1");
    expect(out).toEqual({ tier: "pro", summary: "legacy" });
  });

  it("falls back to legacy column when value is already an object", async () => {
    resultAnalysesFindFirst.mockResolvedValueOnce(null);
    resultsFindFirst.mockResolvedValueOnce({
      aiAnalysis: { tier: "pro", summary: "legacy-obj" },
    });

    const out = await getResultAnalysis("r1");
    expect(out).toEqual({ tier: "pro", summary: "legacy-obj" });
  });

  it("returns null when neither table has a row", async () => {
    resultAnalysesFindFirst.mockResolvedValueOnce(null);
    resultsFindFirst.mockResolvedValueOnce(null);

    const out = await getResultAnalysis("r1");
    expect(out).toBeNull();
  });

  it("returns null when legacy row exists but aiAnalysis is null", async () => {
    resultAnalysesFindFirst.mockResolvedValueOnce(null);
    resultsFindFirst.mockResolvedValueOnce({ aiAnalysis: null });

    const out = await getResultAnalysis("r1");
    expect(out).toBeNull();
  });

  it("returns null when legacy column contains unparseable JSON string", async () => {
    resultAnalysesFindFirst.mockResolvedValueOnce(null);
    resultsFindFirst.mockResolvedValueOnce({ aiAnalysis: "not-json{" });

    const out = await getResultAnalysis("r1");
    expect(out).toBeNull();
  });
});
