/**
 * Task DL.2 Phase 1 — unified reader for result AI analysis.
 *
 * Prefers the new `result_analyses` table (populated by dual-write). Falls
 * back to the legacy `results.aiAnalysis` JSONB column for historical rows
 * that have not yet been backfilled.
 *
 * Why: during Phase 1 the new table is only populated for newly-analyzed
 * rows. Old rows still live in `results.aiAnalysis`. Every read site must
 * route through this helper so we can flip sources transparently once
 * Phase 2 (backfill) completes, and later drop the legacy column in Phase 3
 * without touching any call site.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resultAnalyses, results } from "@/lib/db/schema";

/**
 * Return the parsed AI analysis payload for a result, or null if none exists.
 *
 * Result order:
 *   1. `result_analyses.analysis` (new extracted table — already jsonb object)
 *   2. `results.aiAnalysis` (legacy JSONB — may be stringified JSON or object)
 *   3. null
 */
export async function getResultAnalysis(resultId: string): Promise<unknown | null> {
  const fresh = await db.query.resultAnalyses.findFirst({
    where: eq(resultAnalyses.resultId, resultId),
  });
  if (fresh) return fresh.analysis;

  const legacy = await db.query.results.findFirst({
    where: eq(results.id, resultId),
    columns: { aiAnalysis: true },
  });
  if (!legacy?.aiAnalysis) return null;

  // Writers historically used `JSON.stringify(...)` into a jsonb column, so
  // the value round-trips back as a string. Handle both string and object
  // shapes defensively — jsonb(string) callers still decode to object in some
  // drivers, and future callers should be able to pass the object directly.
  const raw = legacy.aiAnalysis;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}
