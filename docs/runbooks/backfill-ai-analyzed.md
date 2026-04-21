# Backfill: flag historical AI-fallback rows

## Why
Before Task 0.1 (PR #172, 2026-04-20), the AI-analysis fallback set
`sentiment="neutral"` on failures, silently poisoning sentiment data.
Rows written during that period are mislabeled.

## What the script does
Finds rows where `aiAnalyzed IS NULL` (legacy, untouched by Task 0.1's
write path) AND `aiSummary` matches the exact fallback string. Sets
`aiAnalyzed=false` + `aiError="historical-fallback-backfilled-2026-04-21"`
so trend analysis and alerts exclude them.

## How to run

    pnpm backfill:ai-analyzed --dry-run    # count only, no writes
    pnpm backfill:ai-analyzed              # actually backfill

Safe to re-run. Idempotent.
