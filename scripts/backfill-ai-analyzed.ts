/**
 * One-shot backfill: flag historical Task-0.1-fallback-fired rows so they are
 * excluded from trend analysis.
 *
 * Context: Before Task 0.1 (PR #172, 2026-04-20), the AI-analysis fallback
 * path silently fabricated sentiment="neutral" + a generic aiSummary on
 * failures, poisoning historical sentiment data. Task 0.1 fixed the bug
 * forward (aiAnalyzed=false, sentiment=null on failure), but legacy rows
 * written before the fix still carry fake "neutral" sentiment.
 *
 * This script finds those rows by their fallback-summary fingerprint (an
 * exact string that no real AI output produces) and flips aiAnalyzed=false
 * + records a marker in aiError.
 *
 * Safe to re-run. Idempotent because we only flip rows where aiAnalyzed IS
 * NULL (legacy, untouched by Task 0.1's write path) AND the summary matches
 * the exact fallback fingerprint.
 *
 * Usage:
 *   npx tsx scripts/backfill-ai-analyzed.ts --dry-run   # count only
 *   npx tsx scripts/backfill-ai-analyzed.ts             # apply
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNull, sql } from "drizzle-orm";

import { pooledDb } from "../src/lib/db";
import { results } from "../src/lib/db/schema";

// Exact fingerprint from the pre-Task-0.1 fallback path. No legitimate AI
// output produces this exact string, so it's a clean identifier.
export const FALLBACK_SUMMARY =
  "Analysis temporarily unavailable. Content has been saved and will be analyzed on the next cycle.";

export const BACKFILL_MARKER = "historical-fallback-backfilled-2026-04-21";

export async function main(options: { dryRun?: boolean } = {}) {
  const isDryRun =
    options.dryRun ?? process.argv.includes("--dry-run");

  // Count first so the operator can sanity-check before committing.
  const countRows = await pooledDb
    .select({ count: sql<number>`count(*)::int` })
    .from(results)
    .where(
      and(isNull(results.aiAnalyzed), eq(results.aiSummary, FALLBACK_SUMMARY)),
    );
  const count = countRows[0]?.count ?? 0;

  console.log(
    `Found ${count} historical fallback-fired rows to flag (aiAnalyzed IS NULL + fingerprint match).`,
  );

  if (isDryRun) {
    console.log("Dry run - no writes.");
    return { count, updated: 0, dryRun: true };
  }

  if (count === 0) {
    console.log("Nothing to backfill. Exiting.");
    return { count: 0, updated: 0, dryRun: false };
  }

  const result = await pooledDb
    .update(results)
    .set({ aiAnalyzed: false, aiError: BACKFILL_MARKER })
    .where(
      and(isNull(results.aiAnalyzed), eq(results.aiSummary, FALLBACK_SUMMARY)),
    );

  const updated = (result as { rowCount?: number }).rowCount ?? 0;
  console.log(`Backfilled. Flagged rows: ${updated}`);
  return { count, updated, dryRun: false };
}

// Only auto-run when invoked directly via `tsx scripts/backfill-ai-analyzed.ts`.
// Guard prevents test imports from triggering a real DB call.
// VITEST env is set by vitest; skip when running under tests.
if (!process.env.VITEST) {
  main().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
}
