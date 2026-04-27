# CLAUDE.md - Kaulby

AI-powered community monitoring SaaS. Tracks 16 platforms (Reddit, Hacker News, Product Hunt, Dev.to, Google Reviews, Trustpilot, App Store, Play Store, YouTube, G2, Yelp, Amazon Reviews, Indie Hackers, GitHub, Hashnode, X/Twitter) for keywords, analyzes sentiment/pain points via AI, sends alerts. Quora is deferred (dropped 2026-04-22 pending Team-tier-only Crawlee reactivation — see .mdmp/apify-platform-cost-audit-2026-04-21.md).

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
- Neon (Postgres) + Drizzle ORM
- Clerk (auth), Polar.sh (payments), Inngest (background jobs)
- OpenRouter (AI) + Langfuse (observability), Resend (email), PostHog (analytics)

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
