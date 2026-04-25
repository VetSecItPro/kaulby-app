#!/usr/bin/env tsx
/**
 * GitHub-only persona-voice audit. Pulls recent GitHub summaries, runs the
 * SAME probes the canary uses, prints failures grouped by pattern.
 *
 * Goal: figure out WHY GitHub is at 69% vs 76% baseline before iterating
 * on the prompt blindly.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { runQualityProbes, PERSONA_PROBES, BANNED_OPENERS, ROBOTIC_ANTIPATTERNS } from "@/lib/ai/quality-probes";

async function main() {
  const rows = await db
    .select({
      id: results.id,
      title: results.title,
      content: results.content,
      aiSummary: results.aiSummary,
    })
    .from(results)
    .where(and(eq(results.platform, "github"), isNotNull(results.aiSummary)))
    .orderBy(desc(results.createdAt))
    .limit(200);

  console.log(`Pulled ${rows.length} GitHub summaries.\n`);
  if (rows.length === 0) {
    console.log("No GitHub summaries found. Run a GitHub monitor scan first.");
    return;
  }

  const summaries = rows.map((r) => r.aiSummary ?? "");
  const metrics = runQualityProbes(summaries);

  console.log("AGGREGATE METRICS");
  console.log("=================");
  console.log(`Total: ${metrics.total}`);
  console.log(`Persona: ${metrics.persona} (${(metrics.personaRate * 100).toFixed(1)}%)`);
  console.log(`Generic: ${metrics.generic} (${(metrics.genericRate * 100).toFixed(1)}%)`);
  console.log(`Robotic: ${metrics.robotic} (${(metrics.roboticRate * 100).toFixed(1)}%)`);
  console.log(`Banned-opener: ${metrics.bannedOpener} (${(metrics.bannedOpenerRate * 100).toFixed(1)}%)`);
  console.log(`Avg length: ${metrics.avgLength.toFixed(0)} chars\n`);

  // Bucket failures (no persona match) by likely cause.
  const failures = rows.filter((r) => {
    const text = r.aiSummary ?? "";
    return !PERSONA_PROBES.some((p) => p.test(text));
  });

  console.log(`FAILURES: ${failures.length} summaries with no persona-probe match`);
  console.log("============================================================\n");

  // Bucket 1: Banned openers (regression)
  const bannedOpener = failures.filter((r) => BANNED_OPENERS.some((p) => p.test(r.aiSummary ?? "")));
  // Bucket 2: Robotic format
  const robotic = failures.filter((r) => ROBOTIC_ANTIPATTERNS.some((p) => p.test(r.aiSummary ?? "")));
  // Bucket 3: Short summaries (< 100 chars) — likely terse/no-action content
  const short = failures.filter((r) => (r.aiSummary?.length ?? 0) < 100 && !BANNED_OPENERS.some((p) => p.test(r.aiSummary ?? "")));
  // Bucket 4: Everything else
  const other = failures.filter((r) => {
    const text = r.aiSummary ?? "";
    return !BANNED_OPENERS.some((p) => p.test(text))
      && !ROBOTIC_ANTIPATTERNS.some((p) => p.test(text))
      && text.length >= 100;
  });

  console.log(`  - Banned-opener regression: ${bannedOpener.length}`);
  console.log(`  - Robotic format:           ${robotic.length}`);
  console.log(`  - Short/terse (<100ch):     ${short.length}`);
  console.log(`  - Other (long, no probe):   ${other.length}\n`);

  // Sample each bucket
  function sample(bucket: typeof failures, label: string, n = 5) {
    if (bucket.length === 0) return;
    console.log(`SAMPLE: ${label} (showing ${Math.min(n, bucket.length)} of ${bucket.length})`);
    console.log("------------------------------------------------------------");
    for (const r of bucket.slice(0, n)) {
      console.log(`TITLE: ${r.title?.slice(0, 90) ?? "(no title)"}`);
      console.log(`SUMMARY: ${(r.aiSummary ?? "").slice(0, 350)}`);
      console.log();
    }
  }

  sample(bannedOpener, "BANNED OPENER (these are regressions)");
  sample(robotic, "ROBOTIC FORMAT");
  sample(short, "SHORT/TERSE (no action recommended)");
  sample(other, "OTHER (long, missing first-person markers)", 10);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
