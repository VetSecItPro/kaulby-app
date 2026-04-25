#!/usr/bin/env tsx
/**
 * Regression check: re-run AI on Reddit/HN/etc samples to make sure the
 * GitHub-specific section in the new prompt doesn't bleed and degrade
 * other platforms.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { and, desc, isNotNull, ne, sql } from "drizzle-orm";
import { summarizeContent } from "@/lib/ai/analyzers/summarize";
import { runQualityProbes } from "@/lib/ai/quality-probes";

const SAMPLE_SIZE = Number(process.argv[2] ?? 20);

async function main() {
  // Sample across non-GitHub platforms.
  const rows = await db
    .select({
      id: results.id,
      platform: results.platform,
      title: results.title,
      content: results.content,
      previousSummary: results.aiSummary,
    })
    .from(results)
    .where(and(ne(results.platform, "github"), isNotNull(results.aiSummary)))
    .orderBy(sql`RANDOM()`)
    .limit(SAMPLE_SIZE);

  console.log(`Re-running ${rows.length} non-GitHub items with new prompt.\n`);
  console.log(`Platforms: ${[...new Set(rows.map((r) => r.platform))].join(", ")}\n`);

  const newSummaries: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sourceText = `Title: ${r.title ?? ""}\n\n${(r.content ?? "").slice(0, 2000)}`;
    process.stdout.write(`[${i + 1}/${rows.length}] ${r.platform}: `);
    try {
      const { result } = await summarizeContent(sourceText);
      newSummaries.push(result.summary);
      process.stdout.write("ok\n");
    } catch (e) {
      process.stdout.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  console.log("\nBEFORE (existing summaries):");
  const before = runQualityProbes(rows.map((r) => r.previousSummary ?? ""));
  console.log(`Persona: ${(before.personaRate * 100).toFixed(1)}%, Banned: ${(before.bannedOpenerRate * 100).toFixed(1)}%`);

  console.log("\nAFTER (new prompt):");
  const after = runQualityProbes(newSummaries);
  console.log(`Persona: ${(after.personaRate * 100).toFixed(1)}%, Banned: ${(after.bannedOpenerRate * 100).toFixed(1)}%`);

  const personaDelta = (after.personaRate - before.personaRate) * 100;
  console.log(`\nPersona delta on non-GitHub: ${personaDelta >= 0 ? "+" : ""}${personaDelta.toFixed(1)}pp`);
  if (personaDelta < -5) {
    console.log("REGRESSION RISK — non-GitHub persona dropped >5pp. Investigate before shipping.");
  } else {
    console.log("No regression on non-GitHub platforms.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
