/**
 * Golden Eval Runner — measures Kaulby AI analyzer accuracy against a hand-labeled ground-truth set.
 *
 * Purpose (COA 4 W1.4/W1.5): run this on every PR that touches `src/lib/ai/prompts.ts`,
 * `src/lib/ai/openrouter.ts`, or any analyzer under `src/lib/ai/analyzers/`. CI fails the
 * PR if any metric regresses by >5% vs the committed baseline.
 *
 * NOT a unit test — this makes live AI calls and costs real money. Gated behind an env var
 * so it only runs intentionally (in CI's `ai-eval` job or via `pnpm eval:ai` locally).
 *
 * Usage:
 *   KAULBY_RUN_AI_EVAL=1 pnpm tsx src/__tests__/ai/eval-runner.ts
 *   KAULBY_RUN_AI_EVAL=1 pnpm tsx src/__tests__/ai/eval-runner.ts --write-baseline
 *
 * Requires: OPENROUTER_API_KEY in env.
 */

// Load .env.local first — tsx doesn't auto-load dotenv, and the rest of this
// script fails loud if OPENROUTER_API_KEY is missing. Silent on success.
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { analyzeSentiment } from "@/lib/ai/analyzers/sentiment";
import { analyzePainPoints } from "@/lib/ai/analyzers/pain-points";
import { categorizeConversation } from "@/lib/ai/analyzers/conversation-category";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalLabels {
  sentiment: "positive" | "negative" | "neutral";
  painPointCategory:
    | "competitor_mention"
    | "pricing_concern"
    | "feature_request"
    | "support_need"
    | "negative_experience"
    | "positive_feedback"
    | "general_discussion"
    | null;
  conversationCategory?: string;
  intentScore?: number;
  businessAction?: "respond" | "monitor" | "escalate" | "log";
}

interface EvalItem {
  id: string;
  source: string;
  title?: string | null;
  content: string;
  labels: EvalLabels;
  labeledBy: string;
  notes?: string;
}

interface EvalSet {
  version: number;
  items: EvalItem[];
}

interface MetricScore {
  total: number;
  correct: number;
  accuracy: number;
  errors: Array<{ id: string; expected: unknown; got: unknown }>;
}

interface EvalReport {
  runAt: string;
  model: string;
  itemCount: number;
  metrics: {
    sentiment: MetricScore;
    painPointCategory: MetricScore;
    conversationCategory: MetricScore;
  };
  totalCostUsd: number;
  totalLatencyMs: number;
  exitCode: 0 | 1;
}

interface Baseline {
  recordedAt: string;
  model: string;
  metrics: {
    sentiment: number;
    painPointCategory: number;
    conversationCategory: number;
  };
  source: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REGRESSION_THRESHOLD = 0.05; // 5% absolute drop vs baseline fails CI.

const __dirname = dirname(fileURLToPath(import.meta.url));
const SET_PATH = join(__dirname, "golden-eval-set.json");
const BASELINE_PATH = join(__dirname, "eval-baseline.json");
const REPORT_PATH = join(__dirname, "eval-last-report.json");

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function initMetric(): MetricScore {
  return { total: 0, correct: 0, accuracy: 0, errors: [] };
}

function finalize(m: MetricScore): MetricScore {
  m.accuracy = m.total > 0 ? m.correct / m.total : 0;
  return m;
}

async function runItem(
  item: EvalItem,
  metrics: EvalReport["metrics"],
  costTracker: { cost: number; latency: number }
): Promise<void> {
  const text = item.title ? `${item.title}\n\n${item.content}` : item.content;

  // Sentiment
  try {
    const { result, meta } = await analyzeSentiment(text);
    costTracker.cost += meta.cost;
    costTracker.latency += meta.latencyMs;
    metrics.sentiment.total += 1;
    if (result.sentiment === item.labels.sentiment) {
      metrics.sentiment.correct += 1;
    } else {
      metrics.sentiment.errors.push({
        id: item.id,
        expected: item.labels.sentiment,
        got: result.sentiment,
      });
    }
  } catch (err) {
    metrics.sentiment.total += 1;
    metrics.sentiment.errors.push({
      id: item.id,
      expected: item.labels.sentiment,
      got: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Pain point category
  try {
    const { result, meta } = await analyzePainPoints(text);
    costTracker.cost += meta.cost;
    costTracker.latency += meta.latencyMs;
    metrics.painPointCategory.total += 1;
    if (result.category === item.labels.painPointCategory) {
      metrics.painPointCategory.correct += 1;
    } else {
      metrics.painPointCategory.errors.push({
        id: item.id,
        expected: item.labels.painPointCategory,
        got: result.category,
      });
    }
  } catch (err) {
    metrics.painPointCategory.total += 1;
    metrics.painPointCategory.errors.push({
      id: item.id,
      expected: item.labels.painPointCategory,
      got: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Conversation category (optional — skip items without this label).
  //
  // KNOWN SOFT METRIC (2026-04-23): the enum categories aren't mutually
  // exclusive for many realistic items — ev-001 ("Tired of paying $200/mo for
  // Asana. What are my options?") could legitimately be money_talk, pain_point,
  // OR solution_request. The analyzer prompt prioritizes solution_request for
  // high-intent items, so it often picks differently than the hand-labeled
  // golden ground truth. All four shootout models scored 13-50% on this metric
  // — the gap is a labeling artifact, not a model-quality signal. Focus baseline
  // gating decisions on sentiment + pain-point accuracy until this is re-labeled
  // with the analyzer's priority ordering applied.
  if (item.labels.conversationCategory) {
    try {
      const { result, meta } = await categorizeConversation(text);
      costTracker.cost += meta.cost;
      costTracker.latency += meta.latencyMs;
      metrics.conversationCategory.total += 1;
      if (result.category === item.labels.conversationCategory) {
        metrics.conversationCategory.correct += 1;
      } else {
        metrics.conversationCategory.errors.push({
          id: item.id,
          expected: item.labels.conversationCategory,
          got: result.category,
        });
      }
    } catch (err) {
      metrics.conversationCategory.total += 1;
      metrics.conversationCategory.errors.push({
        id: item.id,
        expected: item.labels.conversationCategory,
        got: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}

async function main(): Promise<void> {
  if (process.env.KAULBY_RUN_AI_EVAL !== "1") {
    console.error(
      "[eval-runner] KAULBY_RUN_AI_EVAL not set — refusing to make paid API calls. Set KAULBY_RUN_AI_EVAL=1 to proceed."
    );
    process.exit(2);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("[eval-runner] OPENROUTER_API_KEY not set.");
    process.exit(2);
  }

  const writeBaseline = process.argv.includes("--write-baseline");

  const set: EvalSet = JSON.parse(readFileSync(SET_PATH, "utf-8"));
  console.log(`[eval-runner] Loaded ${set.items.length} items from golden set`);

  const metrics: EvalReport["metrics"] = {
    sentiment: initMetric(),
    painPointCategory: initMetric(),
    conversationCategory: initMetric(),
  };
  const costTracker = { cost: 0, latency: 0 };
  const runAt = new Date().toISOString();

  for (const [i, item] of set.items.entries()) {
    process.stdout.write(`\r[eval-runner] ${i + 1}/${set.items.length} ${item.id}`);
    await runItem(item, metrics, costTracker);
  }
  process.stdout.write("\n");

  finalize(metrics.sentiment);
  finalize(metrics.painPointCategory);
  finalize(metrics.conversationCategory);

  const modelEnv = process.env.KAULBY_EVAL_MODEL_TAG || "default";
  const report: EvalReport = {
    runAt,
    model: modelEnv,
    itemCount: set.items.length,
    metrics,
    totalCostUsd: Math.round(costTracker.cost * 10000) / 10000,
    totalLatencyMs: costTracker.latency,
    exitCode: 0,
  };

  // Compare vs baseline
  let baseline: Baseline | null = null;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  } catch {
    console.warn(
      "[eval-runner] No baseline found. Run with --write-baseline once, commit eval-baseline.json, then future runs will compare."
    );
  }

  if (baseline && !writeBaseline) {
    const regressions: string[] = [];
    for (const metric of ["sentiment", "painPointCategory", "conversationCategory"] as const) {
      const current = metrics[metric].accuracy;
      const base = baseline.metrics[metric];
      const drop = base - current;
      if (drop > REGRESSION_THRESHOLD) {
        regressions.push(
          `${metric}: baseline=${(base * 100).toFixed(1)}% current=${(current * 100).toFixed(1)}% drop=${(drop * 100).toFixed(1)}%`
        );
      }
    }
    if (regressions.length > 0) {
      console.error(`\n[eval-runner] ❌ REGRESSION — ${regressions.length} metric(s) dropped >${REGRESSION_THRESHOLD * 100}%:`);
      regressions.forEach((r) => console.error(`  • ${r}`));
      report.exitCode = 1;
    }
  }

  if (writeBaseline) {
    const newBaseline: Baseline = {
      recordedAt: runAt,
      model: report.model,
      metrics: {
        sentiment: metrics.sentiment.accuracy,
        painPointCategory: metrics.painPointCategory.accuracy,
        conversationCategory: metrics.conversationCategory.accuracy,
      },
      source: `eval-runner v1 against golden-eval-set version ${set.version}`,
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2) + "\n");
    console.log(`[eval-runner] ✅ Wrote baseline to ${BASELINE_PATH}`);
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  // Console summary
  console.log("\n[eval-runner] Summary:");
  console.log(`  Items: ${report.itemCount}`);
  console.log(`  Sentiment accuracy:             ${(metrics.sentiment.accuracy * 100).toFixed(1)}% (${metrics.sentiment.correct}/${metrics.sentiment.total})`);
  console.log(`  Pain point category accuracy:   ${(metrics.painPointCategory.accuracy * 100).toFixed(1)}% (${metrics.painPointCategory.correct}/${metrics.painPointCategory.total})`);
  console.log(`  Conversation category accuracy: ${(metrics.conversationCategory.accuracy * 100).toFixed(1)}% (${metrics.conversationCategory.correct}/${metrics.conversationCategory.total})`);
  console.log(`  Total cost: $${report.totalCostUsd.toFixed(4)}`);
  console.log(`  Total latency: ${(report.totalLatencyMs / 1000).toFixed(1)}s`);
  console.log(`  Exit code: ${report.exitCode}`);

  process.exit(report.exitCode);
}

main().catch((err) => {
  console.error("[eval-runner] fatal:", err);
  process.exit(1);
});
