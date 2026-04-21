import { describe, it, expect } from "vitest";
import {
  calculateAlertPriority,
  sortByAlertPriority,
  type AlertPriorityInput,
} from "@/lib/alert-priority";

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.5 — Alert priority weighting.
//
// Contract: priority = sentimentWeight * log(1 + engagement) * confidence
//           * (1 + leadScore/100).
// These tests lock in the RELATIVE ordering guarantees we care about —
// absolute numbers are incidental and tuned for intuition, not for precision.
// ─────────────────────────────────────────────────────────────────────────────

type Row = AlertPriorityInput & { id: string; createdAt?: Date | null };

const row = (id: string, overrides: Partial<Row> = {}): Row => ({
  id,
  sentiment: "neutral",
  engagementScore: 10,
  conversationCategoryConfidence: 0.8,
  leadScore: 0,
  ...overrides,
});

describe("calculateAlertPriority", () => {
  it("ranks negative + high engagement above positive + high engagement", () => {
    const neg = calculateAlertPriority(
      row("n", { sentiment: "negative", engagementScore: 1000 })
    );
    const pos = calculateAlertPriority(
      row("p", { sentiment: "positive", engagementScore: 1000 })
    );
    expect(neg).toBeGreaterThan(pos);
  });

  it("ranks high confidence above low confidence at equal sentiment/engagement", () => {
    const hi = calculateAlertPriority(
      row("h", { conversationCategoryConfidence: 0.95 })
    );
    const lo = calculateAlertPriority(
      row("l", { conversationCategoryConfidence: 0.2 })
    );
    expect(hi).toBeGreaterThan(lo);
  });

  it("treats null engagement as 0 without crashing (priority collapses to 0)", () => {
    const p = calculateAlertPriority(
      row("z", { engagementScore: null })
    );
    expect(p).toBe(0);
    expect(Number.isFinite(p)).toBe(true);
  });

  it("ranks positive sentiment above null sentiment at equal everything else", () => {
    const pos = calculateAlertPriority(
      row("p", { sentiment: "positive" })
    );
    const nul = calculateAlertPriority(row("u", { sentiment: null }));
    expect(pos).toBeGreaterThan(nul);
  });

  it("leadScore boosts priority (higher lead score → higher priority)", () => {
    const hot = calculateAlertPriority(row("h", { leadScore: 90 }));
    const cold = calculateAlertPriority(row("c", { leadScore: 0 }));
    expect(hot).toBeGreaterThan(cold);
  });

  it("falls back to confidence=0.5 when confidence is null", () => {
    // Two otherwise-identical rows: null confidence should equal explicit 0.5.
    const a = calculateAlertPriority(
      row("a", { conversationCategoryConfidence: null })
    );
    const b = calculateAlertPriority(
      row("b", { conversationCategoryConfidence: 0.5 })
    );
    expect(a).toBeCloseTo(b, 10);
  });
});

describe("sortByAlertPriority", () => {
  it("returns results sorted descending by priority", () => {
    const list: Row[] = [
      row("low", { sentiment: "neutral", engagementScore: 5 }),
      row("high", { sentiment: "negative", engagementScore: 500 }),
      row("mid", { sentiment: "positive", engagementScore: 50 }),
    ];
    const sorted = sortByAlertPriority(list);
    expect(sorted.map((r) => r.id)).toEqual(["high", "mid", "low"]);
  });

  it("breaks ties deterministically by createdAt DESC", () => {
    // Same priority inputs — newer createdAt should win.
    const older = row("older", {
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    const newer = row("newer", {
      createdAt: new Date("2024-06-01T00:00:00Z"),
    });
    const sorted = sortByAlertPriority([older, newer]);
    expect(sorted.map((r) => r.id)).toEqual(["newer", "older"]);
  });

  it("does not drop any rows (reorder only, Task 2.5 guardrail)", () => {
    const list: Row[] = Array.from({ length: 10 }, (_, i) =>
      row(`r${i}`, { engagementScore: i * 10 })
    );
    const sorted = sortByAlertPriority(list);
    expect(sorted).toHaveLength(list.length);
    expect(new Set(sorted.map((r) => r.id))).toEqual(
      new Set(list.map((r) => r.id))
    );
  });

  it("does not mutate the input array", () => {
    const list: Row[] = [
      row("a", { engagementScore: 1 }),
      row("b", { engagementScore: 1000 }),
    ];
    const before = list.map((r) => r.id);
    sortByAlertPriority(list);
    expect(list.map((r) => r.id)).toEqual(before);
  });
});
