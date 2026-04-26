# Sandbox Branch Marker

This branch (`sandbox`) is the long-lived home for Polar sandbox webhook testing.

**Do not merge to main.** Keep this branch alive so its Vercel preview URL stays stable:
`https://kaulby-app-git-sandbox-vetsecitpro.vercel.app`

That URL is configured in the Polar sandbox dashboard as the webhook endpoint.
Sandbox env vars (POLAR_ENV=sandbox + sandbox token + sandbox product IDs) are set
on Vercel's Preview environment scope so this branch's deploys read them automatically.

See `.github/runbooks/polar-sandbox-setup.md` for the full setup.
