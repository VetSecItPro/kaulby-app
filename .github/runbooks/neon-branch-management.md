# Neon Branch Management

**When to use this:** Before a risky migration, when CI has DB conflicts, or when you're unsure whether a branch is still in use. Governs which Neon branches exist, what they're for, and how to create/reset/delete them.

## Branch conventions

| Branch | Purpose | Who writes to it |
|--------|---------|------------------|
| `main` | Production database | Vercel production deploys, prod Inngest jobs |
| `e2e-ci` | CI end-to-end test database | GitHub Actions workflows only. **Do not mutate manually.** |
| `dev/<name>` | Ad-hoc developer branches for risky migrations, data investigations, backfill rehearsals | Creator only |

**Rule:** never point local `.env.local` at `main`. Use a `dev/*` branch or your own personal branch.

## 1. Create a dev branch for a risky migration

- Neon console -> Kaulby project -> Branches -> "Create branch".
- Parent: `main`. Name: `dev/<your-initials>-<short-desc>` (e.g. `dev/jm-add-sentiment-col`).
- Copy the connection string.
- In the worktree: point `.env.local`'s `DATABASE_URL` at the new branch string.
- Run `pnpm db:push` to apply the pending schema there first.

## 2. Rehearse the migration

- Apply the schema change locally against the dev branch.
- If the migration includes a data backfill, run the backfill script against the dev branch.
- Spot-check with `pnpm db:studio`.
- If anything looks wrong: delete the dev branch and start over. Cheap.

## 3. Reset a dev branch from parent

Use this when your dev branch has drifted and you want to re-sync it to the current state of `main`:

- Neon console -> branch -> "Reset from parent".
- Or via Neon CLI: `neonctl branches reset dev/<name> --parent main`.
- All data in the dev branch is replaced by a fresh copy of `main`'s current state.

**Warning:** reset is destructive for the dev branch. There's no undo.

## 4. CI branch: `e2e-ci`

- `e2e-ci` is owned by GitHub Actions. The workflow resets it from `main` at the start of each run (or uses a fresh branch per PR if configured).
- **Never** run `pnpm db:push` or ad-hoc SQL against `e2e-ci` from your laptop. It causes CI flakiness that's hard to trace.
- If CI is failing with DB errors, check `.github/workflows/` for the expected branch name and reset logic.

## 5. Apply the migration to `main`

Once the dev branch rehearsal is clean:

- Merge the PR. Vercel deploy triggers.
- Run `pnpm db:push` against `main` — either locally with prod `DATABASE_URL` pointed at `main`, or via a one-off script step.
- For destructive migrations, follow `schema-migration.md` for the multi-deploy flow.

## 6. Delete stale dev branches

- Neon console shows "Last active" per branch. If > 2 weeks idle and not tagged as a reference branch, delete it.
- Neon CLI: `neonctl branches delete dev/<name>`.

## Cost implications

- Idle branches are near-free (Neon charges for compute + storage; idle = zero compute).
- Storage cost is delta-based: a fresh branch copy of `main` costs ~0 until it diverges.
- Hundreds of branches cause dashboard clutter, not cost. Still — clean up.

## How to verify it worked

- Dev branch connection string works: `pnpm exec tsx -e "import { db } from '@/lib/db'; console.log(await db.execute('SELECT 1'))"`.
- After reset: a row you'd added to the dev branch is gone, and a row that exists on `main` is present.
- After a deletion: branch no longer listed in Neon console; no CI workflow references it.

## Common pitfalls

- **Running migrations against `main` without a dev rehearsal** — fine for additive changes, dangerous for destructive ones.
- **Pointing `.env.local` at `main`** — easy to forget you did this; accidental DELETE during local dev hits prod data.
- **Forgetting which branch `DATABASE_URL` points at** — always `echo $DATABASE_URL | cut -d@ -f2` before running any migration.
- **Manually editing `e2e-ci`** — CI goes flaky and you'll spend hours diagnosing it.
- **Deleting a branch someone else still uses** — coordinate if the branch name doesn't match a known solo-dev pattern.
