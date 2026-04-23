# `scripts/` Inventory

**When to use this:** You need a one-off data backfill, smoke check, or integration test and want to know what already exists before writing new code.

All scripts live at the repo root in `scripts/` and are run via `npx tsx scripts/<name>.ts`. They load `.env.local` via `dotenv` and operate on whichever branch `DATABASE_URL` points at — **always verify the target branch first.**

## Inventory

### `backfill-workspace-ids.ts`

- **What**: Sets `workspaceId` on existing `monitors` and `audiences` rows based on the owner's workspace membership.
- **When to run**: After introducing workspace-scoped ownership; one-time migration. Should not need to re-run unless new legacy rows are imported.
- **Safety**: Additive only (only updates rows where `workspaceId IS NULL`). Idempotent.
- **Run**: `npx tsx scripts/backfill-workspace-ids.ts`

### `clear-test-data.ts`

- **What**: Deletes all data associated with a specific test user (set via `TEST_EMAIL` env var, default `test@example.com`).
- **When to run**: Resetting a local or staging environment between E2E test runs. **Never run against production.**
- **Safety**: Destructive. Requires `TEST_EMAIL` to be set; will fail if the user doesn't exist.
- **Run**: `TEST_EMAIL=test@example.com npx tsx scripts/clear-test-data.ts`

### `reset-stuck-scans.ts`

- **What**: Finds monitors with `is_scanning = true` and resets the flag, unsticking scans that crashed mid-flight.
- **When to run**: After an Inngest drain (see `inngest-drain.md`) or when the UI shows monitors stuck in "scanning" state for > 30 min.
- **Safety**: Safe. Only flips a boolean; no data loss. Idempotent.
- **Run**: `npx tsx scripts/reset-stuck-scans.ts`

### `send-test-emails.ts`

- **What**: Sends daily-digest and weekly-report test emails to `TEST_EMAIL` via Resend, using real HTML templates.
- **When to run**: After touching email templates or digest data shapes; to preview in your actual inbox.
- **Safety**: Sends real email — use a test address you own.
- **Run**: `TEST_EMAIL=you@example.com npx tsx scripts/send-test-emails.ts`

### `smoke-test.ts`

- **What**: Hits a running dev server on a port (default 6761) and walks through dashboard pages, API routes, and marketing pages. Reports pass/fail.
- **When to run**: After a big refactor; quick regression check before opening a PR. Faster than full Playwright E2E.
- **Safety**: Read-only HTTP requests. No data mutations.
- **Run**: `pnpm dev` in one terminal, then `npx tsx scripts/smoke-test.ts [port]`

### `test-ai-prompts.ts`

- **What**: Runs sentiment / pain-point / summarization / comprehensive AI analyses on a fixed sample input; compares Pro vs Team tier prompts.
- **When to run**: After editing `src/lib/ai/prompts.ts` or swapping OpenRouter models.
- **Safety**: Burns OpenRouter credits. A few cents per run.
- **Run**: `npx tsx scripts/test-ai-prompts.ts`

### `test-polar-checkout.ts`

- **What**: Validates Polar plan ID mapping, checkout API request shape, webhook event processing, and DB updates end-to-end.
- **When to run**: Before shipping any change to billing / subscription logic. After upgrading `@polar-sh/sdk`.
- **Safety**: Uses test products. Does not hit live billing. Still touches the DB — point at a dev branch.
- **Run**: `npx tsx scripts/test-polar-checkout.ts`

### `test-producthunt.ts`

- **What**: Tests Product Hunt GraphQL API integration: OAuth token fetch + data pull for the test user's monitors.
- **When to run**: When Product Hunt scans are failing and you need to isolate whether it's the API wrapper or Inngest.
- **Safety**: Read-only against Product Hunt API. Writes results to DB under the test user.
- **Run**: `npx tsx scripts/test-producthunt.ts`

### `test-team-features.ts`

- **What**: End-to-end test of workspace + team monitor ownership: creates a workspace, adds members, assigns monitors, tests member deletion / reassignment, cleans up.
- **When to run**: After any change to workspace / team permissions logic.
- **Safety**: Creates and deletes test rows. Cleans up after itself if it completes; leaves debris if it crashes mid-run. Run against a dev branch.
- **Run**: `npx tsx scripts/test-team-features.ts`

### `smoketest-monitor.ts`
- **Purpose:** automated W3.7 end-to-end smoke test. Creates a real monitor for an admin user, fires Inngest scan-now, polls for results, audits AI summaries for analyst-voice patterns.
- **When to run:** after every PR that touches `src/lib/ai/*` prompts, after Vercel prod deploys, when "AI summaries look weird" reports come in.
- **Run:** `pnpm tsx scripts/smoketest-monitor.ts [--target=<keyword>] [--keep]`
- **Safety:** writes a real monitor + results to prod DB. Cleans up by deactivating the monitor unless `--keep` is set. Run `cleanup-test-monitor.ts` if you forget.

### `audit-persona-voice.ts`
- **Purpose:** standalone persona-voice probe over existing AI summaries for a given monitor.
- **When to run:** after smoketest-monitor.ts, or to compare voice quality before/after a prompt change.
- **Run:** `pnpm tsx scripts/audit-persona-voice.ts <monitorId>`
- **Probes:** broad analyst-voice patterns ("I recommend", "team should", "needs escalation", first-person + audience-aware recommendations) and robotic anti-patterns ("Sentiment: x").

### `check-smoketest-ai.ts`
- **Purpose:** diagnostic for "AI didn't fire on new results" investigations. Pulls aiAnalyzed status counts + aiLogs for a monitor.
- **When to run:** when smoketest-monitor.ts shows results but no AI summaries.
- **Run:** `pnpm tsx scripts/check-smoketest-ai.ts <monitorId>`

### `cleanup-test-monitor.ts`
- **Purpose:** one-shot deactivation for any `[SMOKE TEST]` monitors that smoketest-monitor.ts `--keep` left active.
- **When to run:** any time you suspect smoke-test debris is still active.
- **Run:** `pnpm tsx scripts/cleanup-test-monitor.ts`

### `setup-posthog-dashboards.ts`
- **Purpose:** W3.8 PostHog dashboards bootstrap. Creates 3 operational dashboards (Activation funnel, AI health, Scan reliability) with 15 insights total via PostHog REST API.
- **When to run:** initial setup; after accidentally deleting a dashboard; when adding a new insight definition (edit script then re-run).
- **Run:** `pnpm tsx scripts/setup-posthog-dashboards.ts`
- **Requires:** `POSTHOG_PERSONAL_API_KEY` (phx_...) in `.env.local`. Idempotent.
- **See also:** [posthog-dashboards.md](./posthog-dashboards.md) for what each dashboard means and when to escalate.

### `migrate-polar-products.ts`
- **Purpose:** Polar product catalog management — creates Solo/Scale/Growth subscription products + Day Pass via Polar API, renames seat products, archives legacy ones.
- **When to run:** initial pricing setup; pricing restructures (rename brand from "Kaulby" to other in `PRODUCTS_TO_CREATE` to reuse for Clarus/Rowan/etc).
- **Run:** `POLAR_WRITE_TOKEN=polar_oat_... pnpm tsx scripts/migrate-polar-products.ts` (or `POLAR_ACCESS_TOKEN` as fallback)
- **Idempotent:** matches by product name, skips creation if exists. Writes resulting env vars back to `.env.local`.
- **Required scopes on token:** `products:write`, `prices:write`. The runtime `POLAR_ACCESS_TOKEN` in production is intentionally narrower; this needs admin scope.

### `eval-shootout.ts`
- **Purpose:** cross-model AI eval comparator. Runs the golden eval set against multiple OpenRouter model candidates, produces ranking with cost-adjusted scoring.
- **When to run:** when considering a model change for any tier (e.g., re-evaluating Sonnet vs Flash for Growth).
- **Run:** `KAULBY_RUN_AI_EVAL=1 OPENROUTER_API_KEY=... pnpm tsx scripts/eval-shootout.ts [--rounds N] [--models=flash,sonnet]`
- **Cost:** real OpenRouter API calls. Single round across 4 models ≈ $0.50-2 depending on prompt sizes.
- **Output:** writes incrementally to `.monitor-reports/` so multi-hour runs survive crashes.

### `setup-canary-monitor.ts`

- **What**: Idempotent creation (or re-activation) of the dedicated monitor that the AI quality canary (Inngest cron `ai-quality-canary`) scans every 6h. Keyword: "inngest" on GitHub + Hacker News. Created in the admin workspace.
- **When to run**: First-time canary bootstrap on any environment; or after manual deletion. Idempotent — safe to re-run.
- **Safety**: Inserts one monitor row for the admin user. Non-destructive.
- **Run**: `pnpm tsx scripts/setup-canary-monitor.ts`
- **Output**: logs the canary monitor ID. Store it for the runbook (`.github/runbooks/ai-quality-canary.md`).

## Pattern for new backfill scripts

When you need a new data migration (see `schema-migration.md`, Deploy 3 of the destructive flow), follow the shape of `backfill-workspace-ids.ts`:

1. Top-of-file doc comment stating purpose and run command.
2. `config({ path: ".env.local" });` for env loading.
3. Idempotent: only touch rows that need changes. Safe to re-run.
4. Log counts: rows considered, rows updated, rows skipped.
5. Exit 0 on success; throw on failure.

## How to verify a script worked

- Each script prints a summary. Read it.
- For DB-touching scripts: `pnpm db:studio` spot-check a few rows.
- For email scripts: check the inbox.
- For AI/API scripts: read the pass/fail console output.

## Common pitfalls

- **Running against the wrong Neon branch** — always `echo $DATABASE_URL` first, or use a dev branch.
- **Running a `test-*` script in production** — the `test-team-features.ts` and `clear-test-data.ts` scripts write/delete real rows. Production `DATABASE_URL` + these scripts = bad time.
- **Skipping the test-email recipient var** — `send-test-emails.ts` defaults to `test@example.com`, which bounces. Set `TEST_EMAIL`.
- **Forgetting to start the dev server before `smoke-test.ts`** — all URLs fail with connection refused.
- **Running AI scripts during quota crunch** — `test-ai-prompts.ts` makes multiple paid API calls per run.
