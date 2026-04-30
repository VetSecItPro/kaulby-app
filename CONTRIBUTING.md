# Contributing to Kaulby

This doc is mostly about **CI/Vercel cost-saver patterns** — the controls we've put in place to keep build minutes from compounding. Use them. They're cheap to use and they save real money across the org.

## Cost-saver patterns

### Draft PRs skip the expensive matrix

Open a PR as **Draft** when work is in progress. CI runs only `quality` (lint+typecheck) and `security` (audit+secret-scan). Build, E2E, Lighthouse, and AI Eval all skip until you mark the PR Ready for review.

Why: WIP pushes shouldn't burn 15 min of E2E runner time per push.

### Skip Vercel previews on WIP commits

Three ways, pick whichever fits:

1. **Commit message marker** — include any of `[skip preview]`, `[skip vercel]`, or `[wip]`:
   ```
   git commit -m "wip: trying a new approach [wip]"
   ```

2. **Branch prefix** — name the branch `wip/*` or `draft/*`:
   ```
   git checkout -b wip/auth-rewrite
   ```

3. **Draft PR** (covered above; also affects Vercel via the workflow gate).

Production (`main`) always builds — these markers are PR-preview only.

### Path-skipped CI

CI is automatically skipped when a PR ONLY touches:
- `**/*.md`, `docs/**`, `.github/runbooks/**` (documentation)
- `public/videos/**`, `public/*.{png,jpg,webp,ico,svg,gif,txt}` (static assets)
- `CHANGELOG`, `LICENSE`, `.editorconfig`, `.nvmrc`, `.npmrc`, `.gitignore` (repo metadata)

Don't try to game this — `scripts/**` is intentionally NOT excluded because admin scripts need the security audit.

### Merge queue

PRs are merged via GitHub Merge Queue. After CI is green, click **Add to merge queue** instead of Merge. The queue re-tests your PR combined with the latest main; this catches integration breakage that PR-isolated CI misses (and prevents the "stale CI" pattern where two green PRs collide on merge).

If you hit a merge conflict, rebase locally — the queue won't auto-rebase.

## Local development

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm lint     # ESLint
pnpm exec tsc --noEmit  # Type check
pnpm test     # Vitest
```

### Optional: pre-commit hooks

We ship git hooks that run lint + typecheck + secret-scan locally before you push. They catch in <5s what would otherwise burn 3 min of CI runner time.

Opt in:
```bash
git config core.hooksPath .githooks
```

Opt out (not recommended): leave the config unset; hooks won't run.

## PR conventions

- **Title:** `type(scope): imperative description` — e.g., `fix(auth): resolve session race`
- **Squash-merge only.** Repo is configured to enforce this; no rebase or merge commits.
- **Branches auto-delete on merge.** Don't worry about cleanup.
- **Test plan in description.** What was verified, what's pending.

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`, `ci`.

## Architecture quick map

See `CLAUDE.md` (project root) for the canonical architecture rules. Key invariants:

- Server components by default; `"use client"` only when actually needed.
- Drizzle is the ORM source of truth (`src/lib/db/schema.ts`).
- All AI calls log to `aiLogs` and trace via Langfuse.
- `KAULBY_PRORATION_BEHAVIOR = "next_period"` on every Polar subscription update.
- No em dashes in UI text (regular dash or rewrite).
- No sparkle icons — use `Wand2` or another Lucide icon.

## Reporting bugs / proposing features

Use Linear (project: Kaulby). GitHub Issues are not actively monitored here.

## Verified working as of 2026-04-29

- CI path-skip on `**/*.md` — confirmed (this canary PR triggered no workflow run)
- Vercel preview skip — confirmed via `scripts/vercel-ignore-build.sh`
- Pre-commit hook (`.githooks/pre-commit`) — opt-in via `git config core.hooksPath .githooks`
