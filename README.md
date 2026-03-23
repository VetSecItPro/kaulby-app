# Kaulby

**AI-powered social listening for startups that actually works.**

Monitor what people say about your brand across Reddit, Hacker News, Product Hunt, and 14 more platforms — with AI that understands context, not just keywords.

**[Try it free](https://kaulbyapp.com)** | **[Live Site](https://kaulbyapp.com)**

---

## What Kaulby Does

You're building a product. People are talking about it (or your competitors) right now on Reddit, Hacker News, and dozens of other communities. Kaulby finds those conversations automatically and tells you what matters.

- **Monitor 17 platforms** — Reddit, Hacker News, Product Hunt, Dev.to, GitHub, YouTube, Trustpilot, G2, App Store, Play Store, Quora, X/Twitter, Google Reviews, Yelp, Amazon Reviews, Indie Hackers, Hashnode
- **AI-powered analysis** — Sentiment detection, pain point extraction, lead scoring, and categorization that actually understands context
- **Real-time alerts** — Email, Slack, Discord, webhooks, and in-app notifications when someone mentions your brand
- **Smart digests** — Daily, weekly, or monthly email summaries with AI-generated insights so you don't have to check constantly
- **HubSpot CRM sync** — Automatically push high-scoring leads to your CRM
- **Team workspaces** — Role-based access, shared monitors, collaborative workflows

## How It Works

1. **Create a monitor** — Enter your brand name or keywords. Kaulby suggests relevant terms automatically.
2. **Pick your platforms** — Choose from 17 platforms or let Kaulby monitor all of them.
3. **Get insights** — AI analyzes every mention for sentiment, pain points, feature requests, and sales opportunities.
4. **Take action** — Reply to conversations, track trends, export reports, or let integrations handle the rest.

## Features

### Monitoring & Analysis
- Keyword and AI Discovery monitoring modes
- Sentiment trending over time
- Pain point and feature request detection
- Competitor mention tracking
- Custom detection keywords per category

### Alerts & Integrations
- Email, Slack, Discord, and webhook notifications
- HubSpot CRM contact sync with lead scoring
- Scheduled PDF reports with custom branding
- Daily/weekly/monthly AI-powered digests

### Dashboard
- Analytics with sentiment charts and platform breakdowns
- Saved searches with visual query builder
- Bookmarks and collections
- Audience segmentation
- Infinite scroll results with advanced filtering
- Dark mode (always-on)

### For Teams
- Workspace management with role-based permissions
- Monitor assignment and collaboration
- API key management with public API docs
- Shared audiences and saved searches

## Pricing

| | Free | Pro | Team |
|---|---|---|---|
| **Price** | $0/mo | $29/mo | $99/mo |
| **Monitors** | 1 | 10 | 30 |
| **Platforms** | Reddit | 9 platforms | All 17 |
| **Refresh** | 24hr | 4hr | 2hr |
| **AI Features** | Basic | Full | Full + API |

Annual billing and day passes also available.

**[Start monitoring for free](https://kaulbyapp.com)**

## Built With

Next.js, TypeScript, Tailwind CSS, Neon Postgres, Clerk, Inngest, OpenRouter, and deployed on Vercel.

---

Built by [VetSecItPro](https://github.com/VetSecItPro)

---

## Getting Started

```bash
git clone https://github.com/VetSecItPro/kaulby-app.git
cd kaulby-app
pnpm install
cp .env.example .env.local   # fill in credentials
pnpm db:push                 # push schema to Neon
pnpm dev                     # start dev server at http://localhost:3000
```

For background jobs, run Inngest in a second terminal:

```bash
npx inngest-cli@latest dev   # dashboard at http://127.0.0.1:8288
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk auth publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk auth secret key |
| `CLERK_WEBHOOK_SECRET` | Yes | Clerk webhook signing secret |
| `OPENROUTER_API_KEY` | Yes | LLM API key (OpenRouter) |
| `POLAR_ACCESS_TOKEN` | Yes | Polar.sh billing API token |
| `POLAR_WEBHOOK_SECRET` | Yes | Polar.sh webhook signing secret |
| `INNGEST_EVENT_KEY` | Prod | Inngest event key |
| `INNGEST_SIGNING_KEY` | Prod | Inngest signing key |
| `UPSTASH_REDIS_REST_URL` | Prod | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Prod | Upstash Redis token |

Full list with all optional variables: [docs/ENV-VARS.md](docs/ENV-VARS.md)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (dashboard)/        # Authenticated dashboard routes (/dash/*)
│   └── api/                # API route handlers
├── components/
│   ├── ui/                 # shadcn/ui primitives (do not modify)
│   └── dashboard/          # Dashboard-specific components
└── lib/
    ├── db/                 # Drizzle ORM schema and client (schema.ts is source of truth)
    ├── inngest/            # Background job definitions (functions/, client.ts)
    ├── ai/                 # AI prompts, OpenRouter client, rate limiting
    ├── security/           # Centralized security utilities (sanitize, HMAC, CSRF)
    └── ...                 # plans.ts, limits.ts, rate-limit.ts, csrf.ts, etc.
```

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Push Drizzle schema to Neon |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm exec tsc --noEmit` | TypeScript type checking |

## Documentation

| Doc | Description |
|---|---|
| [docs/ENV-VARS.md](docs/ENV-VARS.md) | All environment variables with descriptions |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel deployment guide |
| [docs/DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md) | Database schema reference |
| [docs/INNGEST-FUNCTIONS.md](docs/INNGEST-FUNCTIONS.md) | Background job reference |
| [docs/DEPENDENCY-MAP.md](docs/DEPENDENCY-MAP.md) | Service dependency map |
| [docs/DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md) | Incident response and recovery |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Release history |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and controls |

## Contributing

This is a private repository. All changes must go through a pull request:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit your changes on the branch
3. Push and open a PR against `main`
4. CI must pass (lint, typecheck, build, tests)
5. Squash-merge via PR — never push directly to `main`
6. Delete the feature branch after merge

## License

Proprietary — Copyright 2025 Steel Motion LLC. All rights reserved.
