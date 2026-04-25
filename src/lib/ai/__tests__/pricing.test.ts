import { describe, it, expect, vi } from "vitest";
import {
  MODEL_PRICING,
  calculateCost,
  calculateCostFromXaiTicks,
  isSupportedModel,
  assertReasonableCost,
  XAI_USD_PER_TICK,
} from "../pricing";

/**
 * These tests pin every pricing constant against an independently-derived
 * expected cost. If any rate in MODEL_PRICING drifts (intentionally or by
 * accident), the matching test fails loudly with the exact delta.
 *
 * Adding a new model? Add a calibration here too. Tests that don't enforce
 * the math in MODEL_PRICING are tests that won't catch the next 1000x bug.
 */

describe("calculateCost — token-based", () => {
  // For each model: hand-compute (promptTokens/1e6 * input + completionTokens/1e6 * output)
  // and assert calculateCost matches.
  const calibrations: Array<{
    label: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    expectedUsd: number;
  }> = [
    {
      label: "Gemini 2.5 Flash — 10k in + 2k out",
      model: "google/gemini-2.5-flash",
      promptTokens: 10_000,
      completionTokens: 2_000,
      // 10000/1e6 * 0.075 + 2000/1e6 * 0.30 = 0.00075 + 0.0006 = 0.00135
      expectedUsd: 0.00135,
    },
    {
      label: "Gemini 2.5 Pro — 10k in + 2k out",
      model: "google/gemini-2.5-pro",
      promptTokens: 10_000,
      completionTokens: 2_000,
      // 10000/1e6 * 1.25 + 2000/1e6 * 5.00 = 0.0125 + 0.010 = 0.0225
      expectedUsd: 0.0225,
    },
    {
      label: "GPT-4o-mini — 10k in + 2k out",
      model: "openai/gpt-4o-mini",
      promptTokens: 10_000,
      completionTokens: 2_000,
      // 10000/1e6 * 0.15 + 2000/1e6 * 0.60 = 0.0015 + 0.0012 = 0.0027
      expectedUsd: 0.0027,
    },
    {
      label: "Claude Sonnet 4.5 — 10k in + 2k out",
      model: "anthropic/claude-sonnet-4-5",
      promptTokens: 10_000,
      completionTokens: 2_000,
      // 10000/1e6 * 3.0 + 2000/1e6 * 15.0 = 0.030 + 0.030 = 0.060
      expectedUsd: 0.06,
    },
    {
      label: "Claude Haiku 4.5 — 10k in + 2k out",
      model: "anthropic/claude-haiku-4-5",
      promptTokens: 10_000,
      completionTokens: 2_000,
      // 10000/1e6 * 1.0 + 2000/1e6 * 5.0 = 0.010 + 0.010 = 0.020
      expectedUsd: 0.02,
    },
    {
      label: "grok-4-latest — calibration call (6028 in + 1682 out)",
      model: "grok-4-latest",
      promptTokens: 6028,
      completionTokens: 1682,
      // 6028/1e6 * 3.0 + 1682/1e6 * 15.0 = 0.018084 + 0.025230 = 0.043314
      expectedUsd: 0.043314,
    },
  ];

  for (const c of calibrations) {
    it(c.label, () => {
      const got = calculateCost(c.model, c.promptTokens, c.completionTokens);
      expect(got).toBeCloseTo(c.expectedUsd, 6);
    });
  }

  it("returns 0 for unknown model (silent fallback, surfaced by assertReasonableCost)", () => {
    expect(calculateCost("not-a-real-model", 10_000, 2_000)).toBe(0);
  });

  it("returns 0 for zero tokens", () => {
    expect(calculateCost("google/gemini-2.5-flash", 0, 0)).toBe(0);
  });
});

describe("calculateCostFromXaiTicks — xAI Responses API", () => {
  it("calibration: 406,887,500 ticks ≈ $0.041 (the original 6028+1682 call)", () => {
    // This is the exact tick count xAI returned 2026-04-23. Independently
    // computing token-based cost gives $0.043314. Tick math should match
    // within rounding (1e-10 is rounded from 1.06e-10).
    const fromTicks = calculateCostFromXaiTicks(406_887_500);
    expect(fromTicks).toBeCloseTo(0.041, 2);
  });

  it("agrees with token-based calculation within 10%", () => {
    // Cross-check: tick-based vs token-based should be within rounding error.
    // The constant 1e-10 is rounded down from the empirical 1.06e-10 — keeps
    // a clean number at the cost of ~6% under-reporting. 10% tolerance is
    // wide enough to allow the rounding but narrow enough that any unit
    // error (1000x or 1e6x) trips loudly.
    const tokenBased = calculateCost("grok-4-latest", 6028, 1682);
    const tickBased = calculateCostFromXaiTicks(406_887_500);
    const ratio = tickBased / tokenBased;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  it("returns 0 for null/undefined/0 ticks (no usage reported)", () => {
    expect(calculateCostFromXaiTicks(null)).toBe(0);
    expect(calculateCostFromXaiTicks(undefined)).toBe(0);
    expect(calculateCostFromXaiTicks(0)).toBe(0);
  });

  it("XAI_USD_PER_TICK is exactly 1e-10 (regression guard against the 1e-7 bug)", () => {
    // Pin the constant. If anyone edits this back to 1e-7 or any other
    // value, the test fails — and the failure message points them at the
    // 1000x bug history in pricing.ts comments.
    expect(XAI_USD_PER_TICK).toBe(1e-10);
  });
});

describe("assertReasonableCost — sanity guard", () => {
  function makeLogger() {
    return { warn: vi.fn() };
  }

  it("does not warn for reasonable costs", () => {
    const logger = makeLogger();
    assertReasonableCost("google/gemini-2.5-flash", 0.001, 10_000, 2_000, logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns when single call exceeds $5 (catches future 1000x bugs)", () => {
    const logger = makeLogger();
    assertReasonableCost("grok-4-latest", 40.0, 6028, 1682, logger);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("> $5"),
      expect.objectContaining({ model: "grok-4-latest", costUsd: 40 }),
    );
  });

  it("warns on per-token outliers (catches order-of-magnitude unit errors)", () => {
    const logger = makeLogger();
    // 1000 tokens at $1 = $0.001 per token = $1000/1M tokens — way above any real model.
    assertReasonableCost("anthropic/claude-sonnet-4-5", 1.0, 500, 500, logger);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("per-token cost"),
      expect.any(Object),
    );
  });

  it("warns when cost is recorded for unknown model", () => {
    const logger = makeLogger();
    assertReasonableCost("some-new-model", 0.05, 1000, 500, logger);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown model"),
      expect.any(Object),
    );
  });

  it("does not warn for unknown model with zero cost (cache hit pattern)", () => {
    const logger = makeLogger();
    assertReasonableCost("cache", 0, 0, 0, logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("MODEL_PRICING — structural invariants", () => {
  it("every model has both input and output rates", () => {
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.usdPerMillionInputTokens).toBeGreaterThan(0);
      expect(pricing.usdPerMillionOutputTokens).toBeGreaterThan(0);
      // Output is always >= input for every commercial model. If this
      // inverts, it's almost certainly a unit error.
      expect(pricing.usdPerMillionOutputTokens, `${model} output should >= input`)
        .toBeGreaterThanOrEqual(pricing.usdPerMillionInputTokens);
    }
  });

  it("isSupportedModel matches MODEL_PRICING keys", () => {
    for (const model of Object.keys(MODEL_PRICING)) {
      expect(isSupportedModel(model)).toBe(true);
    }
    expect(isSupportedModel("not-real")).toBe(false);
  });
});
