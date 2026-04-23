#!/usr/bin/env tsx
/**
 * Prompt Eval — Tier 1 autoresearch infrastructure.
 *
 * Runs the current SYSTEM_PROMPTS.summarize against the fixed eval corpus
 * (src/__tests__/ai/prompt-eval-corpus.json), collects the LLM outputs,
 * scores them with quality-probes, and prints a report.
 *
 * Workflow (Karpathy pattern applied to prompts):
 *   1. Snapshot current score:    pnpm tsx scripts/prompt-eval.ts --save-baseline
 *   2. Edit SYSTEM_PROMPTS.summarize by hand
 *   3. Re-score:                  pnpm tsx scripts/prompt-eval.ts
 *   4. Compare delta vs baseline → keep if better, revert if worse
 *
 * Cost per run: 20 Flash calls × ~$0.001 = ~$0.02
 * Time per run: ~30 seconds at 20 concurrent (OpenRouter burst)
 *
 * NEVER modify prompt-eval-corpus.json while iterating — the whole point
 * of a fixed corpus is identical inputs across runs.
 *
 * Flags:
 *   --save-baseline    Save current scores to eval-baseline.json (for comparison later)
 *   --concurrency=N    Override parallel-request limit (default 10)
 *   --limit=N          Only run N items (default: all 20)
 *   --verbose          Print each summary as it's produced
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { summarizeContent } from "@/lib/ai/analyzers/summarize";
import { runQualityProbes } from "@/lib/ai/quality-probes";

const CORPUS_PATH = resolve(__dirname, "../src/__tests__/ai/prompt-eval-corpus.json");
const BASELINE_PATH = resolve(__dirname, "../src/__tests__/ai/prompt-eval-baseline.json");

const args = process.argv.slice(2);
const SAVE_BASELINE = args.includes("--save-baseline");
const VERBOSE = args.includes("--verbose");
const CONCURRENCY = parseInt(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "10", 10);
const LIMIT = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);

type CorpusItem = {
  id: string;
  platform: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
};

type Corpus = { version: number; items: CorpusItem[] };

async function runConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as Corpus;
  const items = LIMIT > 0 ? corpus.items.slice(0, LIMIT) : corpus.items;

  console.log(`🔬 Prompt eval run`);
  console.log(`   corpus:      ${items.length} items`);
  console.log(`   concurrency: ${CONCURRENCY}`);
  console.log(`   baseline:    ${SAVE_BASELINE ? "WRITING" : existsSync(BASELINE_PATH) ? "comparing vs existing" : "no baseline to compare"}`);
  console.log("");

  const t0 = Date.now();

  const outputs = await runConcurrent(items, CONCURRENCY, async (item) => {
    // Format content for the summarizer the same way analyze-content.ts does
    const contentToAnalyze = [
      `Platform: ${item.platform}`,
      `Title: ${item.title}`,
      `Content: ${item.content}`,
    ].join("\n\n");

    try {
      const { result, meta } = await summarizeContent(contentToAnalyze);
      if (VERBOSE) {
        console.log(`[${item.id}] ${result.summary.slice(0, 120)}...`);
      }
      return {
        id: item.id,
        summary: result.summary,
        cost: meta.cost,
        latencyMs: meta.latencyMs,
        ok: true as const,
      };
    } catch (err) {
      return {
        id: item.id,
        summary: "",
        cost: 0,
        latencyMs: 0,
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const elapsed = Date.now() - t0;

  const failures = outputs.filter((o) => !o.ok);
  const successes = outputs.filter((o) => o.ok);

  const metrics = runQualityProbes(successes.map((s) => s.summary));
  const totalCost = successes.reduce((sum, s) => sum + s.cost, 0);
  const avgLatency = successes.length === 0 ? 0 : successes.reduce((sum, s) => sum + s.latencyMs, 0) / successes.length;

  // Composite score — single metric for "is this prompt better than the last?"
  // Weights lifted from the quality-strategy doc. Banned opener is a strong
  // penalty (it's the thing we care about most); persona is the core signal;
  // robotic output is a hard penalty.
  const compositeScore =
    metrics.personaRate * 1.0 -
    metrics.bannedOpenerRate * 0.5 -
    metrics.roboticRate * 2.0;

  const report = {
    timestamp: new Date().toISOString(),
    corpus_size: items.length,
    successes: successes.length,
    failures: failures.length,
    wall_clock_ms: elapsed,
    total_cost_usd: totalCost,
    avg_latency_ms: Math.round(avgLatency),
    metrics,
    composite_score: compositeScore,
    failure_ids: failures.map((f) => f.id),
  };

  console.log("📊 Results:");
  console.log(`   wall clock:     ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`   successes:      ${successes.length}/${items.length}`);
  console.log(`   total cost:     $${totalCost.toFixed(4)}`);
  console.log(`   avg latency:    ${Math.round(avgLatency)}ms`);
  console.log("");
  console.log("📈 Quality:");
  console.log(`   persona_rate:        ${(metrics.personaRate * 100).toFixed(1)}%  ${metrics.personaRate >= 0.6 ? "✅" : metrics.personaRate >= 0.3 ? "⚠️" : "❌"}`);
  console.log(`   robotic_rate:        ${(metrics.roboticRate * 100).toFixed(1)}%  ${metrics.roboticRate <= 0.1 ? "✅" : "❌"}`);
  console.log(`   banned_opener_rate:  ${(metrics.bannedOpenerRate * 100).toFixed(1)}%  ${metrics.bannedOpenerRate <= 0.2 ? "✅" : metrics.bannedOpenerRate <= 0.4 ? "⚠️" : "❌"}`);
  console.log(`   avg_length:          ${metrics.avgLength.toFixed(0)} chars`);
  console.log("");
  console.log(`🎯 Composite score:   ${compositeScore.toFixed(4)}`);

  if (existsSync(BASELINE_PATH) && !SAVE_BASELINE) {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as typeof report;
    console.log("");
    console.log("📉 Delta vs baseline:");
    const deltaPersona = (metrics.personaRate - baseline.metrics.personaRate) * 100;
    const deltaBanned = (metrics.bannedOpenerRate - baseline.metrics.bannedOpenerRate) * 100;
    const deltaRobotic = (metrics.roboticRate - baseline.metrics.roboticRate) * 100;
    const deltaScore = compositeScore - baseline.composite_score;
    console.log(`   persona_rate:        ${deltaPersona >= 0 ? "+" : ""}${deltaPersona.toFixed(1)}pp`);
    console.log(`   banned_opener_rate:  ${deltaBanned >= 0 ? "+" : ""}${deltaBanned.toFixed(1)}pp`);
    console.log(`   robotic_rate:        ${deltaRobotic >= 0 ? "+" : ""}${deltaRobotic.toFixed(1)}pp`);
    console.log(`   composite_score:     ${deltaScore >= 0 ? "+" : ""}${deltaScore.toFixed(4)}  ${deltaScore > 0 ? "✅ BETTER — keep this prompt" : deltaScore === 0 ? "➖ neutral" : "❌ WORSE — revert"}`);
  }

  if (SAVE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify(report, null, 2));
    console.log("");
    console.log(`💾 Baseline saved to ${BASELINE_PATH}`);
  }

  if (failures.length > 0) {
    console.log("");
    console.log(`⚠️  ${failures.length} summaries failed:`);
    for (const f of failures as Array<{ id: string; error?: string }>) {
      console.log(`   ${f.id}: ${f.error ?? "unknown error"}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ prompt-eval failed:", err);
    process.exit(1);
  });
