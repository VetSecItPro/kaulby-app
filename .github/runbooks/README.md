# Kaulby Operational Runbooks

One-page playbooks for common operational tasks. Each runbook is self-contained: "when to use", numbered steps, verification, and common pitfalls.

## Index

| Runbook | Purpose |
|---------|---------|
| [rollback-deploy.md](./rollback-deploy.md) | Roll back a bad Vercel deploy (revert commit, force-redeploy, patch vs rollback decision) |
| [inngest-drain.md](./inngest-drain.md) | Pause Inngest during an incident, drain the queue, resume safely |
| [clerk-key-rotation.md](./clerk-key-rotation.md) | Rotate Clerk publishable/secret keys with zero downtime (prod + E2E app) |
| [neon-branch-management.md](./neon-branch-management.md) | Neon branch strategy: main=prod, e2e-ci=CI, dev branches for risky migrations |
| [ci-env-drift.md](./ci-env-drift.md) | Diagnose "works locally, fails in CI" — env var drift between `.env.example` and GitHub Actions |
| [schema-migration.md](./schema-migration.md) | Apply schema changes safely — additive direct-push vs destructive multi-deploy flow |
| [scripts-inventory.md](./scripts-inventory.md) | What's in `scripts/` — each script, purpose, when to run, safety notes |
| [github-webhooks.md](./github-webhooks.md) | GitHub webhook event list, HMAC-SHA256 signature verification, GitHub App installation model, Kaulby receiver wiring |
| [reddit-safety.md](./reddit-safety.md) | Reddit data-path policy (R12): Apify primary + Public JSON fallback + Serper legacy opt-in. Hard rules, cease-and-desist playbook, GummySearch lesson |
| [posthog-dashboards.md](./posthog-dashboards.md) | The 3 operational dashboards (Activation funnel, AI health, Scan reliability): what each insight means, healthy ranges, when to escalate, how to re-create with `scripts/setup-posthog-dashboards.ts` |

## Conventions

- Commands are copy-pasteable. Replace `<PLACEHOLDERS>` with real values.
- "Who to notify" lines reference the solo-dev reality today but leave a placeholder for team growth.
- Runbooks live under `.github/runbooks/` because the repo's root `.gitignore` blanket-ignores `*.md`; an exception is added for this directory.
