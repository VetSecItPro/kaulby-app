#!/usr/bin/env tsx
/**
 * Before/after eval: take the GitHub summaries currently failing the
 * persona probe and re-run the AI on the same source content with the
 * (now-updated) prompt. Measure delta.
 *
 * Why this design: holds the inputs constant while the prompt changes,
 * so any improvement is attributable to the prompt edit, not to a
 * different sample or different content distribution.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { summarizeContent } from "@/lib/ai/analyzers/summarize";
import { runQualityProbes, PERSONA_PROBES } from "@/lib/ai/quality-probes";

const SAMPLE_SIZE = Number(process.argv[2] ?? 30);

async function main() {
  // Pull the most recent GitHub items where the existing summary fails the probe.
  const rows = await db
    .select({
      id: results.id,
      title: results.title,
      content: results.content,
      previousSummary: results.aiSummary,
    })
    .from(results)
    .where(and(eq(results.platform, "github"), isNotNull(results.aiSummary)))
    .orderBy(desc(results.createdAt))
    .limit(500);

  const failures = rows.filter((r) => {
    const text = r.previousSummary ?? "";
    return !PERSONA_PROBES.some((p) => p.test(text));
  });

  console.log(`Found ${failures.length} GitHub summaries currently failing persona probe.`);
  console.log(`Re-running AI on first ${Math.min(SAMPLE_SIZE, failures.length)} with updated prompt.\n`);

  const sample = failures.slice(0, SAMPLE_SIZE);
  const newSummaries: string[] = [];
  const examples: { title: string; before: string; after: string }[] = [];

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i];
    const sourceText = `Title: ${r.title ?? ""}\n\n${(r.content ?? "").slice(0, 2000)}`;
    process.stdout.write(`[${i + 1}/${sample.length}] `);
    try {
      const { result } = await summarizeContent(sourceText);
      newSummaries.push(result.summary);
      if (i < 5) {
        examples.push({
          title: r.title?.slice(0, 80) ?? "",
          before: (r.previousSummary ?? "").slice(0, 250),
          after: result.summary.slice(0, 250),
        });
      }
      process.stdout.write("ok\n");
    } catch (e) {
      process.stdout.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  console.log("\nBEFORE (existing summaries on these same inputs):");
  console.log("-------------------------------------------------");
  const beforeMetrics = runQualityProbes(sample.map((r) => r.previousSummary ?? ""));
  console.log(`Persona: ${beforeMetrics.persona}/${beforeMetrics.total} (${(beforeMetrics.personaRate * 100).toFixed(1)}%)`);
  console.log(`Banned-opener: ${beforeMetrics.bannedOpener}/${beforeMetrics.total} (${(beforeMetrics.bannedOpenerRate * 100).toFixed(1)}%)`);

  console.log("\nAFTER (new prompt, same inputs):");
  console.log("--------------------------------");
  const afterMetrics = runQualityProbes(newSummaries);
  console.log(`Persona: ${afterMetrics.persona}/${afterMetrics.total} (${(afterMetrics.personaRate * 100).toFixed(1)}%)`);
  console.log(`Banned-opener: ${afterMetrics.bannedOpener}/${afterMetrics.total} (${(afterMetrics.bannedOpenerRate * 100).toFixed(1)}%)`);

  const personaDelta = (afterMetrics.personaRate - beforeMetrics.personaRate) * 100;
  const bannedDelta = (afterMetrics.bannedOpenerRate - beforeMetrics.bannedOpenerRate) * 100;
  console.log(`\nDelta: persona ${personaDelta >= 0 ? "+" : ""}${personaDelta.toFixed(1)}pp, banned-opener ${bannedDelta >= 0 ? "+" : ""}${bannedDelta.toFixed(1)}pp`);

  console.log("\nEXAMPLE REWRITES (first 5):");
  console.log("===========================");
  for (const ex of examples) {
    console.log(`\nTITLE: ${ex.title}`);
    console.log(`BEFORE: ${ex.before}`);
    console.log(`AFTER:  ${ex.after}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
