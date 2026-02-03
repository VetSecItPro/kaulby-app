# CLAUDE.md - Kaulby

AI-powered community monitoring SaaS. Tracks 16 platforms (Reddit, Hacker News, Product Hunt, Dev.to, Google Reviews, Trustpilot, App Store, Play Store, Quora, YouTube, G2, Yelp, Amazon Reviews, Indie Hackers, GitHub, Hashnode) for keywords, analyzes sentiment/pain points via AI, sends alerts.

## Development Philosophy

- **No shortcuts**: Always implement strategic, comprehensive fixes. Never apply band-aids or quick patches that defer the real problem.
- **Complete solutions**: Fix root causes, not symptoms. Consider downstream effects and related code paths.
- **No over-engineering**: Solve the current problem completely, but don't build for hypothetical future requirements.

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
| Pro | 10 | 10 | 8 platforms | 4hr |
| Team | 30 | 20 | All 16 platforms | 2hr |

**Platform Tiers:**
- **Free**: Reddit only
- **Pro (8 platforms)**: Reddit, Hacker News, Indie Hackers, Product Hunt, Google Reviews, YouTube, GitHub, Trustpilot
- **Team (16 platforms)**: All Pro platforms + Dev.to, Hashnode, App Store, Play Store, Quora, G2, Yelp, Amazon Reviews

## Key Files

- `src/lib/db/schema.ts` - Database schema (source of truth)
- `src/lib/plans.ts` - Plan definitions and tier logic
- `src/lib/inngest/functions/` - Background jobs
- `src/lib/ai/prompts.ts` - AI prompts
- `src/middleware.ts` - Route protection

## Conventions

- Server components by default; add "use client" only when needed
- Use Drizzle inferred types: `typeof monitors.$inferSelect`
- API errors: return JSON with appropriate HTTP status
- Never commit secrets; all env vars in `.env.local`

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
- Multi-platform monitoring (16 platforms via Apify)
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
