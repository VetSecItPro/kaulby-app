# Rollback a Bad Vercel Deploy

**When to use this:** A production deploy is causing errors, degraded UX, or user-visible regressions and patching forward would take longer than reverting.

## 1. Identify the bad commit

- Open the Vercel dashboard: Project -> Deployments. The current production deploy is marked "Current".
- Cross-reference with:
  - **Sentry**: a spike in new issues or error rate since the deploy timestamp.
  - **PostHog**: drop in session count, checkout funnel, or a custom alert.
  - **Alerts**: any Inngest failure rate spike (monitor-scan jobs, email digests).
- Note the commit SHA and PR number shown on the Vercel deployment page.

## 2. Decide: rollback vs patch-forward

- **Rollback** when: regression touches auth, billing, core monitor scan flow, or data integrity; fix isn't obvious within ~15 min.
- **Patch-forward** when: issue is cosmetic, limited to a single page, or the fix is a one-line change with a clear root cause.

## 3. Roll back via git revert + PR (preferred)

```bash
# From main, up to date
git fetch origin main && git checkout main && git pull

# Revert the bad PR (preferred — reverts the whole squash-merged commit cleanly)
gh pr revert <PR_NUMBER>

# OR revert a single SHA manually
git checkout -b revert/<short-description>
git revert <BAD_SHA>
git push -u origin revert/<short-description>
gh pr create --title "revert: <bad PR title>" --body "Reverts #<PR_NUMBER>. Reason: <1 line>."
```

Merge the revert PR (squash) once CI is green. Vercel will auto-deploy on merge to `main`.

## 4. Force-redeploy via Vercel CLI (if auto-deploy fails or lags)

```bash
vercel --scope team_HFUTBVxI8jKYi334LvgVsVNh
# Then promote a known-good prior deployment:
vercel ls --scope team_HFUTBVxI8jKYi334LvgVsVNh
vercel promote <DEPLOYMENT_URL> --scope team_HFUTBVxI8jKYi334LvgVsVNh
```

Or use the dashboard: Deployments -> click the last known-good deployment -> "Promote to Production".

## 5. Post-rollback sync steps

- **Inngest**: after code changes land, re-sync the app. Inngest dashboard -> Apps -> Sync (`https://<your-domain>/api/inngest`).
- **Cache**: Vercel edge cache self-invalidates on deploy. No manual step.
- **DB**: if the bad deploy ran a destructive migration, see `schema-migration.md` before rolling back code.

## 6. Who to notify

- Solo-dev today: no one (log in the PR description what happened).
- Team placeholder: post in `#incidents` with: bad SHA, symptom, revert PR link, duration of impact.

## How to verify it worked

- Vercel "Current" production deployment now points at the revert commit.
- Sentry error rate returns to baseline within 5-10 min.
- Manually walk through: sign-in, create monitor, view dashboard, view digest email route.
- Inngest dashboard: no new function failures since rollback.

## Common pitfalls

- **Reverting a merge commit without `-m 1`** — `gh pr revert` handles this. If doing it manually, `git revert -m 1 <merge_sha>`.
- **Forgetting Inngest sync** — new code is live but Inngest still references removed functions, causing silent job failures.
- **Schema drift** — reverting app code while the DB still has a new column is fine (Drizzle ignores unknown columns). Reverting app code that expected a column that never shipped is not fine — check `db:push` history.
- **Assuming Vercel promote is instant** — it is, but DNS/edge propagation takes 30-60s. Give it a minute before declaring success.
