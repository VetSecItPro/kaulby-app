# DORMANT - operator directive 2026-08-27

**This repository is not under active development.** Do not spend effort here on baseline work,
dependency sweeps, CI hardening, audits or refactors unless it is explicitly revived. If you found
this repo through an estate-wide scan, stop and go no further.

**Standing findings, recorded 2026-08-27 so they are not rediscovered as new:**
13 dependency pins, 12 of them **unbounded** (`>=X` with no upper bound), which can silently cross a
major on a fresh install. Has Dependabot, no Renovate.

**A bounding pass was attempted on 2026-08-27 and REVERTED.** `readonly-verifier` caught that it
downgraded `esbuild` 0.27.4 -> 0.25.12: for a 0.x package the minor is the breaking-change unit, and
the ceiling was computed from the floor (`>=0.25.0` -> `<0.26`) instead of from the version already
resolved. The other 11 bounds were correct and verified no-downgrade. Raising the ceiling to `<0.28`
did not restore 0.27.4 either, because 0.25.12 already satisfied the wider range - restoring it needs
the FLOOR raised, which is a different change. Given the repo is dormant, the diff was reverted with
`git checkout` rather than debugged further.

**This repo now carries NO uncommitted dependency diff.** `package.json` and `pnpm-lock.yaml` are
exactly as at HEAD; the only uncommitted file is a pre-existing `CLAUDE.md` change that was not mine.
If reviving: the 12 unbounded pins are still there, and the correct bound is one above the higher of
the floor and the version actually resolved - for 0.x, one above the higher MINOR.

**Dormancy makes these not urgent. It does not make them fixed.** Anything above must be resolved
before this repo is redeployed or brought back into active work.

To revive: delete this banner and the `.dormant` file at the repo root.

---

# CLAUDE.md - Kaulby

> # ⛔ PROJECT SHELVED — SUNSET 2026-06-03
> **Kaulby is NOT in active development. Do not resume building, fixing scrapers, or shipping features
> without an explicit founder decision to revive (see preconditions below).** Everything under this banner
> is preserved as historical reference, not a to-do list.
>
> **Why shelved (one line):** zero paying customers after ~5-6 months; structurally fragile + increasingly
> litigated data dependency (Reddit killed unauth JSON May 2026 + anti-scrape Rule 8; X pay-per-use; DMCA §1201
> enforcement). The best-case version of this exact niche — GummySearch ($35K MRR, 10k paying customers,
> profitable) — was killed by Reddit's API terms Nov 2025. Doubly-variable COGS (scrape + AI) under a flat
> subscription = worst margin shape; commoditized AI; squeezed $39-149 middle between free (F5Bot) and enterprise.
> Full validated analysis + citations: **`scraper-audit-2026-06-03.md`** and **`SUNSET.md`** (repo root, local-only).
>
> **Revival preconditions (ALL three required before resuming):**
> 1. A compliant + economically survivable Reddit data path at small scale (the make-or-break — what killed GummySearch).
> 2. Proven willing-to-pay demand from a sell-first test (real prospects, real money) BEFORE more building.
> 3. Radically narrowed scope — the only wedge with a pulse is **Reddit-led B2B-SaaS lead-gen** ($39-79,
>    intent-scored + drafted replies) targeting the orphaned GummySearch base.
>
> **Cost teardown — VERIFIED COMPLETE 2026-06-03. Net recurring cost ≈ $0/month.**
> - ✅ **Inngest** — crons paused (`INNGEST_PAUSED=1` in prod since 2026-04-30) → the expensive scan engine is OFF.
> - ✅ **Neon** — switched to **Free plan** + **VERIFIED $0/month on the console Billing page** (org "John",
>   "Current plan" badge). 18 MB DB preserved (under 512 MB cap), all 38 tables intact, compute scales to zero
>   when idle. Not deleted — reversible. (Free allows 100 projects/org, so no collateral impact on other DBs.)
> - ✅ **Sentry** Developer (free, confirmed by owner) · **Clerk** free (1 user, cap 10k MAU) ·
>   **Langfuse** Hobby (free, zero traces) — all confirmed $0.
> - ➖ **Vercel** team plan left as-is (shared with other VetSecItPro projects; not Kaulby-specific cost).
> - ✅ Usage-based providers (Apify/OpenRouter/xAI/Serper/Upstash/Resend/PostHog) bill ~$0 at zero usage.
> - ✅ Polar/Stripe — %-of-sales, zero customers = $0.
>
> **FINAL ENTRY.** Nothing further to do on Kaulby unless the founder explicitly revives it per the
> preconditions above. Code is in git, data is preserved, billing is zeroed, everything is documented here +
> in `SUNSET.md` + `scraper-audit-2026-06-03.md`. This is the end of the line for this build.
>
> ---
> *Historical product documentation below — accurate as of the sunset, kept for revival reference.*

AI-powered community monitoring SaaS. Tracks 16 platforms (Reddit, Hacker News, Product Hunt, Dev.to, Google Reviews, Trustpilot, App Store, Play Store, YouTube, G2, Yelp, Amazon Reviews, Indie Hackers, GitHub, Hashnode, X/Twitter) for keywords, analyzes sentiment/pain points via AI, sends alerts. Quora is deferred (dropped 2026-04-22 pending Team-tier-only Crawlee reactivation — see `docs/archive/` for cost-audit history).

Installs as a PWA with native push notifications: subscribe in Settings → receive a phone/desktop notification the moment a high-intent lead is detected.

## Development Philosophy

- **No shortcuts**: Always implement strategic, comprehensive fixes. Never apply band-aids or quick patches that defer the real problem.
- **Complete solutions**: Fix root causes, not symptoms. Consider downstream effects and related code paths.
- **No over-engineering**: Solve the current problem completely, but don't build for hypothetical future requirements.

## Billing Policy (Polar)

**No proration. No refunds for tier changes. Everything happens at end of billing period.**

- Tier downgrades, plan switches, and cancellations: take effect at next billing cycle. Customer keeps current tier through period end.
- Tier upgrades: also next-period (consistent — keeps billing logic predictable).
- Seat-addon removals: take effect at next billing cycle (already implemented).
- Refunds only happen on `order.refunded` (Polar admin action), never as part of a tier change.

**Code enforcement:** every `polar.subscriptions.update()` call must pass `prorationBehavior: KAULBY_PRORATION_BEHAVIOR` (defined in `@/lib/polar`, value `"next_period"`). This overrides Polar's org-level default.

**Polar dashboard:** also configure org settings → Subscription proration → "next_period" in BOTH `sandbox.polar.sh` and `polar.sh` so customer-portal-initiated changes follow the same policy.

**Why:** simplifies finance. No partial refunds, no proration credits, no mid-cycle billing state to reconcile. The customer pays for what they signed up for through the period; the change applies cleanly at the next renewal boundary.

## Tech Stack

- Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui
- Neon (Postgres) + Drizzle ORM — pooled connection URL (`-pooler` host), HTTP driver for serverless + WS Pool driver for Inngest
- Clerk (auth), Polar.sh (payments), Inngest (background jobs)
- OpenRouter (AI) + Langfuse (observability), Resend (email), PostHog (analytics)
- Serwist 9.5 service worker — Kaulby-shaped runtime caching (NetworkFirst on /api/v1, SWR on /dashboard, CacheFirst on /icons + /screenshots), `/~offline` fallback
- Web Push (web-push + VAPID) — push_subscriptions table, /api/push/{subscribe,unsubscribe,test}, additive delivery in send-alerts.ts

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in your credentials
2. Install dependencies: `pnpm install`
3. Push the database schema: `pnpm db:push`
4. Start the dev server: `pnpm dev`

## Commands

- `pnpm dev` - Dev server
- `pnpm build` - Production build
- `pnpm lint` - ESLint
- `pnpm db:push` - Push schema to database
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm exec inngest-cli dev` - Inngest dev server (separate terminal)
- `pnpm exec tsc --noEmit` - TypeScript type checking

## Inngest (Background Jobs)

**Local Development:**
1. Run `npx inngest-cli@latest dev` in separate terminal
2. Dashboard at `http://127.0.0.1:8288` to view runs/events

**Production (Inngest Cloud):**
- App must be synced at: `https://<your-domain>/api/inngest`
- Cron jobs (monitor scans) run every 15min-2hrs depending on platform
- Requires `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` env vars

**After deploying code changes:** Must re-sync app in Inngest dashboard (Apps > Sync)

**Kill switch:** Set `INNGEST_PAUSED=1` in Vercel env to register a single never-fired stub function — Inngest cloud prunes all 44 cron schedules on next sync. Currently ACTIVE (paused 2026-04-30). To resume: `printf '0' | vercel env add INNGEST_PAUSED production` (use `printf` not `echo`, trailing newlines break the strict check), redeploy, sync. See `src/app/api/inngest/route.ts`.

## PWA + Push Notifications

**Manifest:** `public/manifest.json` — id="/", scope="/", standalone display, share_target wired to `/dashboard/monitors/new` (prefills keyword from shared title/text/url), 4 shortcuts, screenshots for install prompt.

**Service worker:** `src/app/sw.ts` (Serwist 9.5)
- Runtime caching layered ON TOP of `defaultCache`:
  - `NetworkFirst` on `/api/v1/*` (5s timeout, 1h max age)
  - `NetworkFirst` on `/api/*` GET (4s timeout, 5min max age)
  - `StaleWhileRevalidate` on `/dashboard/*` shells (24h max age)
  - `CacheFirst` on `/icons/*`, `/screenshots/*`, branded PNGs (30d max age)
- Push handler shows notification with title/body/url/tag/icon
- Notificationclick focuses an existing tab if open at the URL, otherwise opens new

**Push notifications:**
- Schema: `push_subscriptions` table (user_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at, last_used_at)
- VAPID keys in env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- API: POST `/api/push/{subscribe,unsubscribe,test}` — all auth-required
- Library: `src/lib/push.ts` — `sendPushToUser(userId, payload)` auto-prunes dead subs (404/410)
- UI: Settings page → Push Notifications card (`src/components/dashboard/push-notifications-card.tsx`)
- Delivery: `send-alerts.ts` runs `sendPushToUser` ADDITIVELY on every alert dispatch (not as a channel) — failures logged but never break primary email/slack/teams paths

**alert_channel enum:** email, slack, in_app, teams, push (push value reserved for future per-channel UX, currently delivery is additive)

**Offline mutation queue (Background Sync):**
- `src/lib/offline-queue.ts` exposes `fetchOrQueue(url, init)` — wraps fetch; on network failure, writes to IndexedDB (`kaulby-offline-queue` / `mutations`) and registers the `replay-mutations` Background Sync tag. Returns synthetic 202 so callers can update UI optimistically.
- SW `sync` handler drains the queue when connectivity returns. Replays via fetch with idempotent error handling: 2xx/3xx/4xx (except 408/429) → remove; 408/429/5xx/network → re-throw so browser retries.
- **Server endpoints replayed by the queue MUST be idempotent.** Each takes the desired final state from the client (e.g., `{ saved: true }`), never flips server-side — multi-replay-safe.
- **Wired call sites (result-card.tsx):**
  - `POST /api/results/[id]/save` — body `{ saved: bool }`
  - `POST /api/results/[id]/mark-read` — body `{}`
  - `POST /api/results/[id]/hide` — body `{ hidden: bool }`
- Browser support: Chrome/Edge/Android Background Sync. Firefox/Safari fall back to immediate retry on next user action.
- Full integration guide: `.github/runbooks/offline-queue.md`.

## Architecture Rules

- **Auth**: Always verify `userId` from Clerk before database operations
- **Mutations**: Prefer server actions over API routes for form submissions
- **Components**: Use shadcn/ui from `@/components/ui` (don't modify these). Dashboard components go in `@/components/dashboard`
- **Database**: Schema is source of truth at `src/lib/db/schema.ts`. Use Drizzle's relational queries
- **Background jobs**: Define in `src/lib/inngest/functions/`. Use step functions for atomic operations
- **AI calls**: Always log to `aiLogs` table and trace with Langfuse

## Subscription Tiers

| Tier | Monitors | Keywords | Platforms | Refresh |
|------|----------|----------|-----------|---------|
| Free | 1 | 3 | Reddit only | 24hr |
| Pro | 10 | 10 | 9 platforms | 4hr |
| Team | 30 | 20 | All 16 platforms | 2hr |

**Platform Tiers:**
- **Free**: Reddit only
- **Pro (9 platforms)**: Reddit, Hacker News, Indie Hackers, Product Hunt, Google Reviews, YouTube, GitHub, Trustpilot, X (Twitter)
- **Team (16 platforms)**: All Pro platforms + Dev.to, Hashnode, App Store, Play Store, G2, Yelp, Amazon Reviews

## Key Files

- `src/lib/db/schema.ts` - Database schema (source of truth)
- `src/lib/plans.ts` - Plan definitions and tier logic
- `src/lib/inngest/functions/` - Background jobs
- `src/lib/ai/prompts.ts` - AI prompts
- `src/lib/push.ts` - Web Push helper (sendPushToUser, auto-prunes 404/410 subs)
- `src/app/sw.ts` - Service worker (Serwist) — runtime caching, push handler, notificationclick
- `src/app/api/push/{subscribe,unsubscribe,test}/route.ts` - Push subscription API
- `src/components/dashboard/push-notifications-card.tsx` - Settings UI for push toggle
- `public/manifest.json` - PWA manifest (id="/", scope="/", screenshots, share_target)
- `src/middleware.ts` - Route protection
- `src/lib/security/` - Security utilities (sanitize, HMAC, rate-limit)
- `src/lib/limits.ts` - Plan limits and tier logic
- `src/lib/rate-limit.ts` - API rate limiting

## Conventions

- Server components by default; add "use client" only when needed
- Use Drizzle inferred types: `typeof monitors.$inferSelect`
- API errors: return JSON with appropriate HTTP status
- Never commit secrets; all env vars in `.env.local`
- **NEVER commit planning/audit/TODO markdown files to git.** Files like `TODO.md`, audit reports, roadmaps, and any skill-generated reports are local-only references. Add them to `.gitignore` if they don't already exist there.

---

## Security Library (`src/lib/security/`)

Centralized security utilities:
- **`escapeHtml()`** - XSS prevention for HTML content
- **`escapeRegExp()`** - ReDoS prevention for regex patterns
- **`sanitizeUrl()`** - URL validation (blocks javascript:, data:, vbscript:)
- **`sanitizeForLog()`** - Log injection prevention
- **`isValidEmail()`, `isValidUuid()`, `truncate()`** - Input validation helpers

Import from: `import { escapeHtml, sanitizeUrl } from '@/lib/security'`

---

## Features

### Core
- Multi-platform monitoring — tracks 16 platforms (Reddit, Hacker News, Product Hunt, Dev.to, Google Reviews, Trustpilot, App Store, Play Store, YouTube, G2, Yelp, Amazon Reviews, Indie Hackers, GitHub, Hashnode, X/Twitter) for keywords, analyzes sentiment/pain points via AI, sends alerts
- AI-powered sentiment analysis and categorization
- Real-time and scheduled alerts (email, webhooks, Slack)
- Daily/weekly/monthly email digests with AI insights
- Scheduled PDF reports
- Team workspaces with role-based permissions
- API key management with public API docs
- Lead scoring

### User Experience
- Onboarding wizard with templates
- Spotlight tour for new users
- Empty state illustrations
- Page transitions and micro-interactions
- Infinite scroll on results
- Dark mode (always-on)
- Saved searches with visual query builder

### SEO & Marketing
- Programmatic subreddit SEO pages
- JSON-LD structured data
- 20 SEO-optimized blog articles at `/articles`

### Billing
- Polar.sh integration (Pro/Team tiers)
- Annual pricing
- Day pass for one-time access


---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         KAULBY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  Clerk   │    │  Polar   │    │ PostHog  │                  │
│  │  (Auth)  │    │(Billing) │    │(Analytics)│                  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                  │
│       │               │               │                          │
│  ┌────▼───────────────▼───────────────▼─────┐                  │
│  │              NEXT.JS APP                  │                  │
│  │         (App Router + RSC)                │                  │
│  │                                           │                  │
│  │  ┌─────────────┐  ┌─────────────┐        │                  │
│  │  │  Dashboard  │  │  Marketing  │        │                  │
│  │  │   /dash/*   │  │     /*      │        │                  │
│  │  └─────────────┘  └─────────────┘        │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────┐                  │
│  │              INNGEST                      │                  │
│  │         (Background Jobs)                 │                  │
│  │                                           │                  │
│  │  • Platform scans (16 platforms)         │                  │
│  │  • AI analysis batches                   │                  │
│  │  • Email digests (daily/weekly)          │                  │
│  │  • Data retention cleanup                │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────┐                  │
│  │           EXTERNAL SERVICES               │                  │
│  │                                           │                  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐       │                  │
│  │  │ Apify  │ │OpenRouter│ │ Resend │       │                  │
│  │  │(Scrape)│ │  (AI)   │ │(Email) │       │                  │
│  │  └────────┘ └────────┘ └────────┘       │                  │
│  │                                           │                  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐       │                  │
│  │  │Langfuse│ │Upstash │ │  Neon  │       │                  │
│  │  │(Traces)│ │(Redis) │ │(Postgres)│      │                  │
│  │  └────────┘ └────────┘ └────────┘       │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
