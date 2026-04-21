# Rotate Clerk Keys Safely

**When to use this:** Suspected key leak, routine quarterly rotation, team member offboarding with access to the Clerk dashboard, or a compliance requirement. Applies to both the production app and the E2E-app used for CI.

## Keys involved

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — safe to expose, still rotate if paired secret rotates.
- `CLERK_SECRET_KEY` — server-side, rotate this first.
- `CLERK_WEBHOOK_SIGNING_SECRET` — rotate separately when rotating webhook endpoint.
- For the **E2E-app** (CI): `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, and test user tokens.

## 1. Create the new key with overlapping validity

- Clerk dashboard -> API Keys -> "Create new key". Do **not** revoke the old one yet.
- Copy the new values. Clerk supports multiple live keys per environment, so both old and new accept traffic during the overlap window.

## 2. Update GitHub Actions secrets

```bash
gh secret set CLERK_SECRET_KEY --body "<new-secret>" --repo VetSecItPro/kaulby-app
gh secret set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --body "<new-publishable>" --repo VetSecItPro/kaulby-app
# E2E app (if rotating those separately)
gh secret set E2E_CLERK_SECRET_KEY --body "<new-e2e-secret>" --repo VetSecItPro/kaulby-app
gh secret set E2E_CLERK_PUBLISHABLE_KEY --body "<new-e2e-publishable>" --repo VetSecItPro/kaulby-app
```

## 3. Update Vercel env vars

```bash
vercel env rm CLERK_SECRET_KEY production --yes --scope team_HFUTBVxI8jKYi334LvgVsVNh
vercel env add CLERK_SECRET_KEY production --scope team_HFUTBVxI8jKYi334LvgVsVNh
# Paste new value when prompted

vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --yes --scope team_HFUTBVxI8jKYi334LvgVsVNh
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --scope team_HFUTBVxI8jKYi334LvgVsVNh
```

Also update `preview` and `development` envs if they use distinct keys.

## 4. Trigger a production deploy with the new keys

```bash
vercel --prod --scope team_HFUTBVxI8jKYi334LvgVsVNh
```

Or push any trivial commit to `main` to trigger the CI -> Vercel pipeline.

## 5. Verify

- Hit `https://<your-domain>/` and sign in. Session should work.
- Check server logs (Vercel -> Functions -> Logs) for no Clerk 401s.
- Run a CI job to confirm E2E-app keys work: re-run the latest GitHub Actions workflow.
- Clerk dashboard -> Logs shows traffic on the new key id.

## 6. Revoke the old key (after 24h)

Wait **24 hours** so any cached tokens / long-lived sessions migrate. Then:

- Clerk dashboard -> API Keys -> old key -> Revoke.
- Confirm no 401 spike in Sentry. If there is, re-issue the key and investigate missed env var locations.

## 7. Local `.env.local` update

Remind yourself (or teammates) to pull fresh values locally:

```bash
vercel env pull .env.local --scope team_HFUTBVxI8jKYi334LvgVsVNh
```

## 8. Who to notify

- Solo-dev: log the rotation date in a rotation calendar.
- Team placeholder: notify anyone with local envs to run `vercel env pull`.

## How to verify it worked

- Active user sessions survive the deploy (no forced sign-outs).
- `/api/auth/*` and middleware-protected routes return 200 for signed-in users.
- CI green on the commit after rotation.
- Clerk dashboard logs show 0 traffic on the revoked key after 24h grace.

## Common pitfalls

- **Revoking the old key immediately** — breaks every active session. Always use a 24h overlap.
- **Forgetting the webhook signing secret** — Polar/Clerk webhooks silently fail. Rotate webhook secrets separately with their own endpoint redeploy.
- **Missing the E2E app** — CI goes red days later when a scheduled run hits expired E2E keys.
- **Not re-syncing Inngest** — if any Inngest function calls the Clerk SDK, it reads env vars at boot; re-sync the app after the deploy.
- **Preview envs left on old key** — preview deploys suddenly break. Rotate all three envs (prod/preview/dev).
