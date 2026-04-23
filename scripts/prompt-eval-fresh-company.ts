#!/usr/bin/env tsx
/**
 * Prompt Eval — FRESH COMPANY TEST.
 *
 * Purpose: validate that the 93% persona rate measured against the fixed
 * Kaulby/Inngest corpus actually generalizes to DIFFERENT domains. If
 * the number drops significantly on Stripe/Notion/Figma content, our
 * fixed corpus was overfit and the prompt has more work to do.
 *
 * Method:
 * 1. Fetch REAL recent HN stories + top comments for a given company
 * 2. Format each as a monitor-style content blob
 * 3. Run each through summarizeContent() with the current prompt
 * 4. Score with PERSONA_PROBES + BANNED_OPENERS
 * 5. Compare to the fixed corpus baseline
 *
 * HN Algolia API is free; Flash calls are ~$0.02 for 20 items.
 *
 * Run:
 *   pnpm tsx scripts/prompt-eval-fresh-company.ts --company="Stripe"
 *   pnpm tsx scripts/prompt-eval-fresh-company.ts --company="Notion" --runs=3
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { summarizeContent } from "@/lib/ai/analyzers/summarize";
import {
  PERSONA_PROBES,
  BANNED_OPENERS,
  ROBOTIC_ANTIPATTERNS,
} from "@/lib/ai/quality-probes";

const args = process.argv.slice(2);
const COMPANY = args.find((a) => a.startsWith("--company="))?.split("=")[1] ?? "Stripe";
const N_RUNS = parseInt(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? "3", 10);
const MAX_ITEMS = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "20", 10);

const OR_KEY = process.env.OPENROUTER_API_KEY;
if (!OR_KEY) {
  console.error("❌ OPENROUTER_API_KEY missing");
  process.exit(1);
}

async function getORSpend(): Promise<number> {
  const res = await fetch("https://openrouter.ai/api/v1/credits", {
    headers: { Authorization: `Bearer ${OR_KEY}` },
  });
  const { data } = await res.json();
  return data.total_usage as number;
}

type FetchedItem = {
  id: string;
  platform: string;
  title: string;
  content: string;
  metadata: { upvotes?: number; commentCount?: number };
};

/**
 * Pull real HN stories + selected comments mentioning the target company.
 * Uses HN Algolia search-by-date, filtering to the last 30 days.
 */
async function fetchRealHNMentions(company: string, maxItems: number): Promise<FetchedItem[]> {
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
  const url =
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(company)}` +
    `&tags=story&hitsPerPage=${maxItems}&numericFilters=created_at_i>${cutoff}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN Algolia ${res.status}`);
  const data = (await res.json()) as { hits: Array<any> };
  return data.hits
    .filter((h) => h.title && (h.points ?? 0) >= 3) // filter out spam/noise
    .slice(0, maxItems)
    .map((h) => ({
      id: `hn-${h.objectID}`,
      platform: "hackernews",
      title: h.title,
      content: (h.story_text || "").slice(0, 2000),
      metadata: {
        upvotes: h.points ?? 0,
        commentCount: h.num_comments ?? 0,
      },
    }));
}

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

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

async function main() {
  console.log(`🔬 Fresh-company eval: ${COMPANY}`);
  console.log(`   runs:        ${N_RUNS}`);
  console.log("");

  const startingSpend = await getORSpend();
  console.log(`   starting OR spend: $${startingSpend.toFixed(4)}`);

  // Step 1: pull real HN mentions
  console.log(`   fetching HN mentions of "${COMPANY}"...`);
  const items = await fetchRealHNMentions(COMPANY, MAX_ITEMS);
  console.log(`   ✅ got ${items.length} real HN items`);
  if (items.length < 5) {
    console.error(`   ❌ not enough items to meaningfully eval — got ${items.length}, need >=5`);
    process.exit(1);
  }
  console.log("");

  // Step 2: run variance probe
  const perItemPersona: Record<string, boolean[]> = {};
  const perItemSummaries: Record<string, string[]> = {};
  const runPersonaRates: number[] = [];
  const runBannedRates: number[] = [];
  const runCompositeScores: number[] = [];

  for (let r = 0; r < N_RUNS; r++) {
    process.stdout.write(`   run ${r + 1}/${N_RUNS}...`);
    const outputs = await runConcurrent(items, 10, async (item) => {
      const content = `Platform: ${item.platform}\nTitle: ${item.title}\nContent: ${item.content}`;
      try {
        const { result } = await summarizeContent(content);
        return { id: item.id, ok: true as const, summary: result.summary };
      } catch {
        return { id: item.id, ok: false as const, summary: "" };
      }
    });
    const successes = outputs.filter((o) => o.ok);
    let pHit = 0,
      bHit = 0,
      rHit = 0;
    for (const o of successes) {
      const hasPersona = PERSONA_PROBES.some((p) => p.test(o.summary));
      const hasBanned = BANNED_OPENERS.some((p) => p.test(o.summary));
      const hasRobotic = ROBOTIC_ANTIPATTERNS.some((p) => p.test(o.summary));
      (perItemPersona[o.id] ||= []).push(hasPersona);
      (perItemSummaries[o.id] ||= []).push(o.summary);
      if (hasPersona) pHit++;
      if (hasBanned) bHit++;
      if (hasRobotic) rHit++;
    }
    const p = pHit / successes.length;
    const b = bHit / successes.length;
    const rr = rHit / successes.length;
    const composite = p * 1.0 - b * 0.5 - rr * 2.0;
    runPersonaRates.push(p);
    runBannedRates.push(b);
    runCompositeScores.push(composite);
    process.stdout.write(` persona=${(p * 100).toFixed(0).padStart(3)}% banned=${(b * 100).toFixed(0).padStart(3)}% composite=${composite.toFixed(3)}\n`);
  }

  const finalSpend = await getORSpend();
  const cost = finalSpend - startingSpend;

  console.log("");
  console.log(`━━━ ${COMPANY.toUpperCase()} — DISTRIBUTION (${N_RUNS} runs) ━━━`);
  const pMean = runPersonaRates.reduce((a, b) => a + b, 0) / runPersonaRates.length;
  const pStd = stdDev(runPersonaRates);
  const bMean = runBannedRates.reduce((a, b) => a + b, 0) / runBannedRates.length;
  const bStd = stdDev(runBannedRates);
  const cMean = runCompositeScores.reduce((a, b) => a + b, 0) / runCompositeScores.length;
  const cStd = stdDev(runCompositeScores);
  console.log(`   persona_rate:     mean=${(pMean * 100).toFixed(1)}%  σ=${(pStd * 100).toFixed(1)}pp`);
  console.log(`   banned_opener:    mean=${(bMean * 100).toFixed(1)}%  σ=${(bStd * 100).toFixed(1)}pp`);
  console.log(`   composite:        mean=${cMean.toFixed(3)}  σ=${cStd.toFixed(3)}`);
  console.log("");
  console.log(`━━━ COMPARISON TO KAULBY/INNGEST CORPUS BASELINE ━━━`);
  console.log(`   Kaulby corpus (2026-04-23):  persona=93.0%  σ=2.7pp`);
  console.log(`   ${COMPANY} (fresh):            persona=${(pMean * 100).toFixed(1)}%  σ=${(pStd * 100).toFixed(1)}pp`);
  const delta = (pMean - 0.93) * 100;
  if (Math.abs(delta) < 5) {
    console.log(`   🎯 Persona rate matches within ±5pp — prompt generalizes to fresh content ✅`);
  } else if (delta > 0) {
    console.log(`   📈 Persona rate HIGHER than baseline by ${delta.toFixed(1)}pp — even better on this content`);
  } else {
    console.log(`   📉 Persona rate LOWER by ${Math.abs(delta).toFixed(1)}pp — prompt may have domain bias, worth investigating`);
  }

  console.log("");
  console.log(`━━━ PER-ITEM PASS RATE ━━━`);
  const rows = items.map((item) => ({
    id: item.id,
    title: item.title.slice(0, 60),
    passCount: (perItemPersona[item.id] || []).filter(Boolean).length,
  }));
  rows.sort((a, b) => a.passCount - b.passCount);
  const alwaysFail = rows.filter((r) => r.passCount === 0);
  console.log(`   always pass: ${rows.filter((r) => r.passCount === N_RUNS).length}/${items.length}`);
  console.log(`   always fail: ${alwaysFail.length}/${items.length}`);
  console.log(`   flaky:       ${rows.filter((r) => r.passCount > 0 && r.passCount < N_RUNS).length}/${items.length}`);

  if (alwaysFail.length > 0) {
    console.log("");
    console.log(`━━━ ALWAYS-FAIL SAMPLES (fresh corpus — worth investigating) ━━━`);
    for (const r of alwaysFail.slice(0, 3)) {
      console.log(`▼ ${r.id}: ${r.title}`);
      const sample = (perItemSummaries[r.id] || [])[0] ?? "";
      console.log(`   "${sample.slice(0, 300)}${sample.length > 300 ? "..." : ""}"`);
      console.log("");
    }
  }

  console.log(`━━━ COST ━━━`);
  console.log(`   spend this run: $${cost.toFixed(4)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ fresh-company eval failed:", err);
    process.exit(1);
  });
