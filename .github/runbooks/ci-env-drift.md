# Diagnose "Works Locally, Fails in CI"

**When to use this:** A PR builds fine on your machine but CI fails in GitHub Actions, usually with cryptic missing-env-var errors or module init failures. 90% of the time this is env drift between your `.env.local` and the CI job's `env:` block.

## 1. Confirm it's env drift (not a real bug)

Signs it's env drift:
- Error mentions `undefined` or "missing" for a config value.
- Error happens at module-load time (during build or the first `tsx` import), not mid-test.
- `pnpm build` passes locally with `.env.local` loaded.
- A recently merged PR introduced a new integration (Polar webhook, new Clerk feature, new AI model).

If instead the error is a real failing test or a flaky test, this runbook doesn't apply.

## 2. Inspect the CI job

```bash
gh run list --workflow ci.yml --limit 5
gh run view <RUN_ID> --log-failed
```

Or open the run in the browser: `gh run view <RUN_ID> --web`.

Look at the `env:` block for the failing job:

```bash
gh workflow view ci.yml
```

## 3. Compare against `.env.example`

```bash
# The source of truth for required vars
grep -E '^[A-Z_]+=' .env.example | cut -d= -f1 | sort > /tmp/required-vars.txt

# What CI provides (from the workflow YAML — skim manually)
# Compare the two lists.
```

Pattern-match: any var in `.env.example` that is **not** referenced in `.github/workflows/ci.yml`'s `env:` block or secrets is a drift candidate.

## 4. Quick-fix: add the missing secret

```bash
# Add to GitHub secrets (repo-level)
gh secret set MISSING_VAR_NAME --body "<value>" --repo VetSecItPro/kaulby-app

# Reference it in the workflow
```

Edit `.github/workflows/ci.yml` — add the var to the `env:` block of the failing job:

```yaml
env:
  MISSING_VAR_NAME: ${{ secrets.MISSING_VAR_NAME }}
```

Push the workflow change and re-run the job.

## 5. When the build passes but runtime fails

If `pnpm build` succeeds in CI but the app 500s after deploy, the issue is not CI env drift — it's **Vercel env drift**:

```bash
vercel env ls --scope team_HFUTBVxI8jKYi334LvgVsVNh
```

Compare against `.env.example` the same way. Add missing vars:

```bash
vercel env add MISSING_VAR production --scope team_HFUTBVxI8jKYi334LvgVsVNh
```

## 6. When to escalate past "env drift"

Stop assuming env drift if:
- All env vars are confirmed present (CI + Vercel) and the error persists.
- Error references a **shared layout or middleware path** — likely a build-time SSR issue touching the new integration.
- Error only happens on specific routes — investigate per-route `generateStaticParams` or `force-dynamic` annotations.

At that point, switch to `/investigate` or read the failing build's full trace for the real stack.

## How to verify it worked

- Re-run the failing CI job via `gh run rerun <RUN_ID>`.
- Build step passes.
- Subsequent jobs (lint, typecheck, tests, security, build) all green.
- A fresh PR (unrelated change) also passes, confirming the fix isn't flaky.

## Common pitfalls

- **Adding the secret but not referencing it in `env:`** — GitHub secrets aren't auto-injected; they must be mapped in the workflow YAML.
- **Adding to the wrong Vercel env (preview vs production)** — production-only vars don't apply to preview deploys and vice versa.
- **Forgetting to update `.env.example`** when the root cause was a new required var added to code. `.env.example` is the contract; keep it current.
- **Rotating a secret in GitHub but not Vercel (or vice versa)** — see `clerk-key-rotation.md` for the rotation-everywhere pattern.
- **Re-running a stale CI job** — always re-run the latest run on the PR, not an older one from before the fix.
