#!/usr/bin/env tsx
/**
 * Prompt Variance Probe — characterize the noise floor before iterating.
 *
 * Runs the CURRENT SYSTEM_PROMPTS.summarize N times against the fixed
 * eval corpus and reports:
 *   - Per-item persona pass-rate (how often does each item trigger the probe?)
 *   - Per-item banned-opener rate
 *   - Overall metric distribution (mean, std dev, min, max, 95% CI)
 *   - Item categorization: always-pass, always-fail, flaky
 *
 * Why this matters:
 * Two runs of the same prompt produced 55.6% and 35.0% persona rate.
 * 20-percentage-point variance means any "improvement" smaller than ~2σ
 * is noise, not signal. This probe measures σ so we know the minimum
 * effect size worth trusting.
 *
 * Cost: ~$0.03 (10 runs × 20 items × ~$0.0001/call at Flash pricing)
 * Time: ~60-90 seconds at 10 concurrent
 *
 * Run:
 *   pnpm tsx scripts/prompt-variance-probe.ts
 *   pnpm tsx scripts/prompt-variance-probe.ts --runs=20
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { summarizeContent } from "@/lib/ai/analyzers/summarize";
import { PERSONA_PROBES, BANNED_OPENERS, ROBOTIC_ANTIPATTERNS } from "@/lib/ai/quality-probes";

const CORPUS_PATH = resolve(__dirname, "../src/__tests__/ai/prompt-eval-corpus.json");
const OUT_PATH = resolve(__dirname, "../src/__tests__/ai/prompt-variance-probe-results.json");

const args = process.argv.slice(2);
const N_RUNS = parseInt(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? "10", 10);
const CONCURRENCY = 10;

const OR_KEY = process.env.OPENROUTER_API_KEY;
if (!OR_KEY) {
  console.error("❌ OPENROUTER_API_KEY missing");
  process.exit(1);
}

async function getORSpend(): Promise<number> {
  const res = await fetch("https://openrouter.ai/api/v1/credits", {
    headers: { Authorization: `Bearer ${OR_KEY}` },
  });
  if (!res.ok) throw new Error(`OR credits API ${res.status}`);
  const { data } = await res.json();
  return data.total_usage as number;
}

async function runConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

type ItemSummary = { itemId: string; summary: string; ok: boolean };

async function scoreRun(items: any[], runIdx: number): Promise<ItemSummary[]> {
  return runConcurrent(items, CONCURRENCY, async (item) => {
    const content = `Platform: ${item.platform}\nTitle: ${item.title}\nContent: ${item.content}`;
    try {
      const { result } = await summarizeContent(content);
      return { itemId: item.id, summary: result.summary, ok: true };
    } catch {
      return { itemId: item.id, summary: "", ok: false };
    }
  });
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

async function main() {
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  const items = corpus.items;

  console.log(`🔬 Variance probe`);
  console.log(`   runs:        ${N_RUNS}`);
  console.log(`   corpus:      ${items.length} items`);
  console.log(`   concurrency: ${CONCURRENCY}`);
  console.log(``);

  const startingSpend = await getORSpend();
  console.log(`   starting OR spend: $${startingSpend.toFixed(4)}`);
  console.log(``);

  const t0 = Date.now();

  // itemId → array of booleans (one per run — did this item's summary trigger persona probe?)
  const perItemPersona: Record<string, boolean[]> = {};
  const perItemBannedOpener: Record<string, boolean[]> = {};
  const perItemSummaries: Record<string, string[]> = {};
  const runComposites: number[] = [];
  const runPersonaRates: number[] = [];
  const runBannedRates: number[] = [];
  const runRoboticRates: number[] = [];

  for (let r = 0; r < N_RUNS; r++) {
    process.stdout.write(`   run ${r + 1}/${N_RUNS}...`);
    const outputs = await scoreRun(items, r);
    const successes = outputs.filter((o) => o.ok);
    let personaCount = 0;
    let bannedCount = 0;
    let roboticCount = 0;
    for (const o of successes) {
      const hasPersona = PERSONA_PROBES.some((p) => p.test(o.summary));
      const hasBanned = BANNED_OPENERS.some((p) => p.test(o.summary));
      const hasRobotic = ROBOTIC_ANTIPATTERNS.some((p) => p.test(o.summary));
      (perItemPersona[o.itemId] ||= []).push(hasPersona);
      (perItemBannedOpener[o.itemId] ||= []).push(hasBanned);
      (perItemSummaries[o.itemId] ||= []).push(o.summary);
      if (hasPersona) personaCount++;
      if (hasBanned) bannedCount++;
      if (hasRobotic) roboticCount++;
    }
    const personaRate = personaCount / successes.length;
    const bannedRate = bannedCount / successes.length;
    const roboticRate = roboticCount / successes.length;
    const composite = personaRate * 1.0 - bannedRate * 0.5 - roboticRate * 2.0;
    runPersonaRates.push(personaRate);
    runBannedRates.push(bannedRate);
    runRoboticRates.push(roboticRate);
    runComposites.push(composite);
    process.stdout.write(` persona=${(personaRate * 100).toFixed(0).padStart(3)}% banned=${(bannedRate * 100).toFixed(0).padStart(3)}% composite=${composite.toFixed(3)}\n`);
  }

  const elapsed = Date.now() - t0;
  const finalSpend = await getORSpend();
  const totalCost = finalSpend - startingSpend;

  console.log(``);
  console.log(`━━━ OVERALL DISTRIBUTION (${N_RUNS} runs) ━━━`);
  const personaMean = runPersonaRates.reduce((a, b) => a + b, 0) / runPersonaRates.length;
  const personaStd = stdDev(runPersonaRates);
  const personaMin = Math.min(...runPersonaRates);
  const personaMax = Math.max(...runPersonaRates);
  console.log(`   persona_rate:     mean=${(personaMean * 100).toFixed(1)}%  σ=${(personaStd * 100).toFixed(1)}pp  range=[${(personaMin * 100).toFixed(0)}%, ${(personaMax * 100).toFixed(0)}%]`);
  const bannedMean = runBannedRates.reduce((a, b) => a + b, 0) / runBannedRates.length;
  const bannedStd = stdDev(runBannedRates);
  console.log(`   banned_opener:    mean=${(bannedMean * 100).toFixed(1)}%  σ=${(bannedStd * 100).toFixed(1)}pp`);
  const compositeMean = runComposites.reduce((a, b) => a + b, 0) / runComposites.length;
  const compositeStd = stdDev(runComposites);
  console.log(`   composite:        mean=${compositeMean.toFixed(3)}  σ=${compositeStd.toFixed(3)}`);
  console.log(``);
  console.log(`🎯 Minimum delta to trust as real improvement: ${(2 * compositeStd).toFixed(3)} composite points (2σ)`);
  console.log(`   → Anything smaller than this is probably noise, not signal`);

  console.log(``);
  console.log(`━━━ PER-ITEM PERSONA PASS RATE ━━━`);
  const rows: Array<{ id: string; personaCount: number; bannedCount: number; personaRate: number }> = [];
  for (const item of items) {
    const personaHits = (perItemPersona[item.id] || []).filter(Boolean).length;
    const bannedHits = (perItemBannedOpener[item.id] || []).filter(Boolean).length;
    rows.push({ id: item.id, personaCount: personaHits, bannedCount: bannedHits, personaRate: personaHits / N_RUNS });
  }
  rows.sort((a, b) => a.personaCount - b.personaCount);

  const alwaysFail = rows.filter((r) => r.personaCount === 0);
  const alwaysPass = rows.filter((r) => r.personaCount === N_RUNS);
  const flaky = rows.filter((r) => r.personaCount > 0 && r.personaCount < N_RUNS);

  console.log(``);
  console.log(`❌ ALWAYS FAIL (${alwaysFail.length}):  persona probe NEVER triggered — deterministic weakness, highest-value fix target`);
  for (const r of alwaysFail) {
    console.log(`   ${r.id.padEnd(30)}  0/${N_RUNS} persona  ${r.bannedCount > 0 ? `(banned opener ${r.bannedCount}/${N_RUNS})` : ""}`);
  }

  console.log(``);
  console.log(`⚠️  FLAKY (${flaky.length}):  persona probe sometimes triggers — ambiguous. May be probe issue.`);
  for (const r of flaky) {
    const flakiness = r.personaCount / N_RUNS;
    const indicator = flakiness >= 0.5 ? "✓" : "✗";
    console.log(`   ${r.id.padEnd(30)}  ${r.personaCount}/${N_RUNS} persona ${indicator}${r.bannedCount > 0 ? `  (banned opener ${r.bannedCount}/${N_RUNS})` : ""}`);
  }

  console.log(``);
  console.log(`✅ ALWAYS PASS (${alwaysPass.length}):  no action needed`);
  for (const r of alwaysPass.slice(0, 5)) {
    console.log(`   ${r.id.padEnd(30)}  ${N_RUNS}/${N_RUNS}`);
  }
  if (alwaysPass.length > 5) console.log(`   ... and ${alwaysPass.length - 5} more`);

  console.log(``);
  console.log(`━━━ ALWAYS-FAIL SAMPLE SUMMARIES ━━━`);
  for (const r of alwaysFail.slice(0, 5)) {
    console.log(``);
    console.log(`▼ ${r.id}:`);
    const samples = (perItemSummaries[r.id] || []).slice(0, 2);
    for (const s of samples) {
      console.log(`   "${s.slice(0, 240)}${s.length > 240 ? "..." : ""}"`);
    }
  }

  console.log(``);
  console.log(`━━━ COST ━━━`);
  console.log(`   spend this run:  $${totalCost.toFixed(4)}`);
  console.log(`   wall clock:      ${(elapsed / 1000).toFixed(1)}s`);

  const report = {
    timestamp: new Date().toISOString(),
    n_runs: N_RUNS,
    corpus_size: items.length,
    overall: {
      persona: { mean: personaMean, std: personaStd, min: personaMin, max: personaMax, runs: runPersonaRates },
      banned_opener: { mean: bannedMean, std: bannedStd, runs: runBannedRates },
      composite: { mean: compositeMean, std: compositeStd, runs: runComposites },
      min_trustworthy_delta: 2 * compositeStd,
    },
    per_item: {
      always_fail: alwaysFail.map((r) => ({ id: r.id, persona_count: r.personaCount, banned_count: r.bannedCount })),
      always_pass: alwaysPass.map((r) => ({ id: r.id, persona_count: r.personaCount })),
      flaky: flaky.map((r) => ({ id: r.id, persona_count: r.personaCount, banned_count: r.bannedCount })),
    },
    always_fail_samples: Object.fromEntries(
      alwaysFail.map((r) => [r.id, perItemSummaries[r.id] || []])
    ),
    cost_usd: totalCost,
    wall_clock_ms: elapsed,
  };
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`   full results:    ${OUT_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ variance probe failed:", err);
    process.exit(1);
  });
