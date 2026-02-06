# Kaulby - AI-Powered Community Monitoring

Kaulby monitors 17 platforms for brand mentions, competitor activity, and customer feedback. AI-powered sentiment analysis, pain point detection, lead scoring, and automated alerts.

**Platforms:** Reddit, Hacker News, Product Hunt, Dev.to, Google Reviews, Trustpilot, App Store, Play Store, Quora, YouTube, G2, Yelp, Amazon Reviews, Indie Hackers, GitHub, Hashnode, X (Twitter)

## Tech Stack

- **Framework:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Database:** Neon (Postgres) + Drizzle ORM
- **Auth:** Clerk
- **Payments:** Polar.sh
- **Background Jobs:** Inngest
- **AI/LLM:** OpenRouter (Gemini 2.5 Flash primary, GPT-4o-mini fallback)
- **AI Observability:** Langfuse
- **Email:** Resend
- **Analytics:** PostHog
- **Scraping:** Apify
- **Caching:** Upstash Redis

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Accounts for: Neon, Clerk, Polar.sh, OpenRouter, Inngest, Resend

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in your credentials in .env.local

# Push database schema
pnpm db:push

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Inngest Dev Server

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

Dashboard at [http://127.0.0.1:8288](http://127.0.0.1:8288).

## Commands

```bash
pnpm dev           # Development server
pnpm build         # Production build
pnpm start         # Production server
pnpm lint          # ESLint
pnpm db:push       # Push schema to database
pnpm db:studio     # Drizzle Studio (database browser)
pnpm exec tsc --noEmit  # TypeScript type check
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Auth pages (sign-in, sign-up)
│   ├── (dashboard)/         # Protected dashboard routes
│   │   └── dashboard/       # Dashboard, monitors, results, analytics, settings
│   ├── (marketing)/         # Public pages (pricing, articles, tools, alternatives)
│   ├── api/
│   │   ├── webhooks/        # Clerk, Polar, email webhooks
│   │   ├── ai/              # AI endpoints (analysis, suggestions)
│   │   ├── results/         # Results API
│   │   ├── analytics/       # Analytics API
│   │   └── inngest/         # Inngest handler
│   └── articles/            # Blog/SEO articles
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── dashboard/           # Dashboard components
│   ├── landing/             # Landing page components
│   └── shared/              # Shared components
├── lib/
│   ├── db/                  # Database schema and queries (Drizzle)
│   ├── ai/                  # AI client, prompts, rate limiting
│   ├── inngest/             # Background job definitions
│   ├── security/            # Security utilities (XSS, sanitization)
│   ├── polar.ts             # Payments client
│   ├── email.ts             # Email templates (Resend)
│   └── server-cache.ts      # Server-side caching
└── e2e/                     # Playwright E2E tests
```

## Features

- **Multi-platform monitoring** across 17 platforms via Apify and xAI
- **AI-powered analysis** — sentiment, pain points, lead scoring, content categorization
- **Real-time alerts** — email, webhooks, Slack, Discord
- **Email digests** — daily, weekly, monthly with PDF report attachments
- **Team workspaces** with role-based permissions
- **API access** with key management
- **Saved searches** with visual query builder
- **SEO pages** — programmatic subreddit pages, JSON-LD, 20 blog articles
- **PWA** — installable progressive web app

## Subscription Tiers

| Tier | Monitors | Platforms | Refresh |
|------|----------|-----------|---------|
| Free | 1 | Reddit | 24hr |
| Pro | 10 | 9 platforms | 4hr |
| Team | 30 | All 17 | 2hr |

## Deployment

Designed for [Vercel](https://vercel.com):

1. Push to GitHub
2. Import in Vercel
3. Add environment variables (see `.env.example`)
4. Deploy
5. Sync Inngest app at `https://your-domain/api/inngest`

## License

Copyright (c) 2025-2026 Kaulby. All rights reserved.

This source code is provided for reference and educational purposes only.
No license is granted for copying, modification, distribution, or commercial use.
See [LICENSE](LICENSE) for details.
