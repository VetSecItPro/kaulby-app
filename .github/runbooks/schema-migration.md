# Apply Schema Changes Safely

**When to use this:** Any time you edit `src/lib/db/schema.ts`. The procedure differs depending on whether the change is additive (safe) or destructive (requires phased rollout).

## Classify the change

| Change type | Examples | Procedure |
|-------------|----------|-----------|
| **Additive** | New nullable column, new table, new index, new enum value | Direct `db:push` — any time |
| **Destructive** | Drop column, rename column, change column type, make nullable -> NOT NULL, drop table | Multi-deploy: add-new -> deploy -> backfill -> drop-old |
| **Data-only** | Populate a new column, clean up bad rows | Separate script, never inline in migration |

When in doubt, treat it as destructive.

## Additive flow

1. Edit `src/lib/db/schema.ts`.
2. Rehearse on a dev Neon branch (see `neon-branch-management.md`):
   ```bash
   pnpm db:push
   ```
3. Run `pnpm exec tsc --noEmit` and `pnpm build` to confirm nothing breaks.
4. Merge PR. Vercel deploys.
5. Apply to `main` Neon branch:
   ```bash
   # DATABASE_URL pointing at main
   pnpm db:push
   ```
6. Verify via `pnpm db:studio`.

## Destructive flow (phased)

Say you're renaming `monitors.keyword` to `monitors.search_term`. Do not do this in one step. Break into 4 deploys:

### Deploy 1: Add the new column (additive)

- Add `search_term` as a new nullable column alongside `keyword`.
- App still reads/writes `keyword`. `search_term` is dormant.
- `pnpm db:push` -> merge -> deploy.

### Deploy 2: Dual-write

- App writes to **both** `keyword` and `search_term`.
- App still reads `keyword`.
- Merge -> deploy.

### Deploy 3: Backfill historical rows

- Write a one-off script in `scripts/` (pattern: see `scripts-inventory.md` entry for `backfill-ai-analyzed.ts`).
- Script populates `search_term` for all rows where it is null.
- Run against `main` manually:
  ```bash
  pnpm exec tsx scripts/backfill-search-term.ts
  ```
- Verify every row has a non-null `search_term`.

### Deploy 4: Switch read path, then drop old

- App reads from `search_term`.
- Merge -> deploy -> let soak for 24h.
- Make `search_term` NOT NULL.
- Drop `keyword` column in a final schema change.
- `pnpm db:push` -> merge -> deploy.

## Golden rules

- **Never run DELETE or UPDATE inside a migration.** Drizzle's `db:push` applies DDL only. Data changes belong in `scripts/` as one-off typed scripts.
- **Always rehearse on a dev Neon branch first.** Reset from parent if you need a clean slate.
- **Use `e2e-ci` branch as staging proxy.** CI runs against `e2e-ci`; if a migration passes CI, that's a strong signal.
- **For destructive changes touching live data, do the phased deploy.** Users are online during a deploy; one-shot destructive changes cause mid-request errors.

## Rollback plan per deploy

- After **Deploy 1** (additive): safe to roll back the code. New column is dormant.
- After **Deploy 2** (dual-write): safe to roll back. Old column is still the source of truth.
- After **Deploy 3** (backfill): data is present in both columns. Safe to roll back code.
- After **Deploy 4** (switch read + drop old): irreversible. No rollback — only roll forward with fixes.

## How to verify it worked

- After each deploy: `pnpm db:studio`, confirm the schema change is visible.
- `pnpm exec tsc --noEmit` after each code change — catches stale references.
- Sentry: no spike in DB-related errors post-deploy.
- For backfill scripts: add a `console.log` of rows-updated count; verify it matches the expected total.

## Common pitfalls

- **`pnpm db:push` on `main` without rehearsing** — if the migration fails, you've broken prod DB.
- **Renaming a column in one step** — Drizzle may generate a DROP + ADD, losing data.
- **Forgetting to update RLS policies** (if any) when adding/renaming columns.
- **Running a backfill script against the wrong branch** — double-check `DATABASE_URL`.
- **Skipping the 24h soak between deploys 3 and 4** — there are still in-flight requests from old code paths.
- **Adding a NOT NULL column without a default** — breaks existing inserts. Add nullable first, backfill, then enforce NOT NULL.
