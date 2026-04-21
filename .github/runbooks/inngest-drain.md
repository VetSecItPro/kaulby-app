# Drain Inngest During an Incident

**When to use this:** A cron is misbehaving (e.g. Reddit scan hitting an API rate limit in a tight retry loop), an external API is cascading failures into Inngest, or you're rolling back and need jobs to stop touching prod data.

## 1. Pause the app

- Open Inngest Cloud dashboard -> Apps.
- Find the Kaulby app (synced at `https://<your-domain>/api/inngest`).
- Click "Pause" (or the app-level kill switch). This halts **all** triggers: crons + event-driven functions.

No new runs will start. In-flight runs continue unless you also cancel them.

## 2. Decide: drain or cancel in-flight runs

- **Drain (default)**: let currently running steps finish. Safe when steps are idempotent (Kaulby's platform-scan steps are).
- **Cancel**: only if a function is stuck in a retry loop burning budget. Inngest dashboard -> Functions -> the offending one -> select runs -> Cancel.

## 3. Verify the queue is drained

- Dashboard -> Runs tab -> filter by status = "Running".
- Wait until the count is 0 and has been 0 for ~2 minutes.
- Check the "Queued" count is also 0.
- For the monitor-scan pipeline specifically: `reset-stuck-scans.ts` script can be run locally if DB-level `scanStatus` rows are stuck in `running` (see `scripts-inventory.md`).

## 4. Fix the root cause

Typical causes and fixes:
- **External API 429/5xx cascade**: add a circuit breaker or backoff in the scan function. Check `src/lib/inngest/functions/`.
- **Bad cron config**: fix the cron expression or frequency in the function definition.
- **Poison event**: inspect the failing run's input. If a single monitor is causing the issue, disable it in the DB: `UPDATE monitors SET status = 'paused' WHERE id = '<id>';`

## 5. Resume safely

- Deploy the fix (see `rollback-deploy.md` if rollback is the fix).
- Inngest dashboard -> Apps -> Sync (re-syncs function registrations with new code).
- Apps -> Resume / Unpause.
- Watch the Runs tab for the first 5-10 min. Error rate should be near zero.

## 6. Who to notify

- Solo-dev: log the incident timestamp + root cause in your notes.
- Team placeholder: `#incidents` channel with duration, impact (how many scans missed), mitigation.

## How to verify it worked

- New runs appear in the Runs tab after resume.
- Function error rate < 5% for the first hour.
- No growing backlog in "Queued" count.
- A manual trigger works: Inngest dashboard -> Functions -> pick a scan -> "Invoke" with a test monitor id.

## Common pitfalls

- **Forgetting to re-sync after deploying a fix** — paused app stays out of date; new function versions not registered.
- **Resuming before cancelling stuck runs** — zombie runs immediately re-fail and pollute metrics.
- **Skipping verification** — Inngest's "paused" UI state is sticky; double-check the app card shows green/active after resume.
- **Pausing during a digest window** — daily/weekly digests are time-sensitive. If you must pause during one, manually trigger the digest after resume for affected users.
