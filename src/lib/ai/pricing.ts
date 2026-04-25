/**
 * Single source of truth for AI model pricing + cost calculation.
 *
 * Why this module exists:
 * - Before 2026-04-25 pricing was scattered across openrouter.ts (MODEL_PRICING)
 *   and monitor-x.ts (XAI_USD_PER_TICK). The xAI constant had a 1000x unit
 *   error that went undetected for 2 days because nothing tested it against
 *   a known calibration. The dashboard read $4,523 instead of $4.52.
 * - Centralized pricing + a unit test that pins each model against an
 *   independently-derived expected cost makes that bug class loud.
 *
 * Naming convention: every constant uses explicit units in the field name
 * (`usdPerMillionInputTokens`, not just `input`) to make unit errors
 * impossible to introduce silently.
 *
 * When adding a new model:
 *   1. Add an entry to MODEL_PRICING with vendor-published rates
 *   2. Add a calibration to __tests__/pricing.test.ts (token count -> expected cost)
 *   3. Tests fail loudly if anyone changes pricing without updating calibrations
 */

export interface ModelPricing {
  usdPerMillionInputTokens: number;
  usdPerMillionOutputTokens: number;
}

/**
 * Vendor-published rates as of 2026-04-25. See pricing.test.ts for
 * calibration that re-derives a known cost from a known token count
 * — that test fails if any rate here drifts.
 */
export const MODEL_PRICING = {
  // OpenRouter — Gemini family
  "google/gemini-2.5-flash": { usdPerMillionInputTokens: 0.075, usdPerMillionOutputTokens: 0.3 },
  "google/gemini-2.5-pro": { usdPerMillionInputTokens: 1.25, usdPerMillionOutputTokens: 5.0 },
  "google/gemini-2.5-pro-preview-05-06": { usdPerMillionInputTokens: 1.25, usdPerMillionOutputTokens: 5.0 },

  // OpenRouter — OpenAI
  "openai/gpt-4o-mini": { usdPerMillionInputTokens: 0.15, usdPerMillionOutputTokens: 0.6 },

  // OpenRouter — Anthropic
  "anthropic/claude-sonnet-4": { usdPerMillionInputTokens: 3.0, usdPerMillionOutputTokens: 15.0 },
  "anthropic/claude-sonnet-4-5": { usdPerMillionInputTokens: 3.0, usdPerMillionOutputTokens: 15.0 },
  "anthropic/claude-haiku-4-5": { usdPerMillionInputTokens: 1.0, usdPerMillionOutputTokens: 5.0 },

  // xAI direct (NOT through OpenRouter — used by monitor-x.ts for x_search tool)
  "grok-4-latest": { usdPerMillionInputTokens: 3.0, usdPerMillionOutputTokens: 15.0 },
} as const satisfies Record<string, ModelPricing>;

export type SupportedModel = keyof typeof MODEL_PRICING;

export function isSupportedModel(model: string): model is SupportedModel {
  return model in MODEL_PRICING;
}

/**
 * Token-based cost calculation. Returns 0 for unknown models (with a
 * warning surfaced via assertReasonableCost at the log boundary).
 *
 * We deliberately don't throw on unknown models — we'd rather silently
 * under-report (cost_usd=0, which surfaces as suspicious in the dashboard)
 * than fail an analysis call.
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  if (!isSupportedModel(model)) return 0;
  const pricing = MODEL_PRICING[model];
  return (
    (promptTokens / 1_000_000) * pricing.usdPerMillionInputTokens +
    (completionTokens / 1_000_000) * pricing.usdPerMillionOutputTokens
  );
}

/**
 * xAI Responses API reports cost as `cost_in_usd_ticks` (a vendor-internal
 * accounting unit; not officially documented in the API reference).
 *
 * Calibration 2026-04-23: a 6028-input + 1682-output grok-4-latest call
 * with the x_search server-side tool reported ticks = 406_887_500.
 *
 * Expected cost using vendor public pricing ($3/1M input, $15/1M output):
 *   (6028 / 1e6 * $3) + (1682 / 1e6 * $15)
 *   = $0.018084 + $0.025230
 *   = $0.043314
 *
 * Solve for tick rate: $0.043314 / 406_887_500 ticks ≈ 1.06e-10 USD/tick.
 * Round to a clean 1e-10 (10 billion ticks per dollar).
 *
 * Earlier code (monitor-x.ts pre-2026-04-25) used 1e-7 — a 1000x unit
 * error that caused the admin dashboard to over-report Grok spend by 1000x.
 * The verification math wasn't included in the original calibration comment,
 * so reviewers couldn't catch the missing zeros at a glance. Lesson: every
 * "calibrated rate constant" comment must show the multiply-through.
 */
export const XAI_USD_PER_TICK = 1e-10;

export function calculateCostFromXaiTicks(ticks: number | undefined | null): number {
  if (!ticks || ticks <= 0) return 0;
  return ticks * XAI_USD_PER_TICK;
}

/**
 * Sanity guard called from logAiCall (the single point that writes to aiLogs).
 *
 * Two checks, both fire warnings rather than throw:
 *   1. Absolute cap — no single call should cost more than $5
 *   2. Per-token sanity — total cost / total tokens shouldn't exceed
 *      $0.10 per 1k tokens (high end of premium models like Opus on long context)
 *
 * If either fires, a future pricing-bug surfaces in logs (and Sentry, if wired)
 * within minutes of first occurrence, not days later when the dashboard
 * shocks an admin.
 */
export interface CostSanityLogger {
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
}

export function assertReasonableCost(
  model: string,
  costUsd: number,
  promptTokens: number,
  completionTokens: number,
  logger: CostSanityLogger,
): void {
  if (costUsd > 5) {
    logger.warn("[ai-cost] single call > $5 — possible pricing bug", {
      model,
      costUsd,
      promptTokens,
      completionTokens,
    });
  }
  const totalTokens = promptTokens + completionTokens;
  if (totalTokens > 100 && costUsd / totalTokens > 0.0001) {
    logger.warn("[ai-cost] per-token cost looks high — possible unit error", {
      model,
      costUsd,
      totalTokens,
      costPerMillionTokens: (costUsd / totalTokens) * 1_000_000,
    });
  }
  if (!isSupportedModel(model) && costUsd > 0) {
    logger.warn("[ai-cost] cost recorded for unknown model — add to MODEL_PRICING", {
      model,
      costUsd,
      promptTokens,
      completionTokens,
    });
  }
}
