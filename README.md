# Kaulby - AI-Powered Community Monitoring Tool

Kaulby helps you track discussions across Reddit, Hacker News, and other online communities. AI-powered pain point detection, sentiment analysis, and natural language querying.

## Tech Stack

**Core:**
- Next.js 14 (App Router)
- TypeScript
- Neon (Postgres database)
- Drizzle ORM

**Auth & Payments:**
- Clerk (authentication)
- Stripe (payments/subscriptions)

**Background Jobs:**
- Inngest (async tasks, scheduled jobs, retries)

**Email:**
- Loops (transactional + marketing emails)

**Analytics & Observability:**
- PostHog (product analytics, session recordings)
- Langfuse (AI/LLM observability, prompt tracking, cost monitoring)

**AI/LLM:**
- OpenRouter as the LLM gateway
- Primary model: Gemini 2.5 Flash
- Fallback model: GPT-4o-mini

**UI:**
- Tailwind CSS
- shadcn/ui components

## Prerequisites

- Node.js 18+
- npm, pnpm, or yarn
- Accounts for: Neon, Clerk, Stripe, OpenRouter, Langfuse, Inngest, Loops, PostHog

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then fill in your credentials (see detailed setup below).

### 3. Database Setup

```bash
# Push schema to database (for development)
npm run db:push

# Or generate and apply migrations
npm run db:generate
npm run db:migrate

# Browse database with Drizzle Studio
npm run db:studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Inngest Dev Server

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

## Service Setup

### Clerk (Authentication)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application
3. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
4. Set up webhook:
   - Endpoint: `https://your-domain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy signing secret to `CLERK_WEBHOOK_SECRET`

### Neon (Database)
1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy connection string to `DATABASE_URL`

### Stripe (Payments)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get API keys from Developers > API Keys
3. Create products:
   - Pro: $29/month → copy price ID to `STRIPE_PRO_PRICE_ID`
   - Enterprise: $99/month → copy price ID to `STRIPE_ENTERPRISE_PRICE_ID`
4. Set up webhook:
   - Endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### OpenRouter (AI)
1. Go to [OpenRouter](https://openrouter.ai/keys)
2. Create an API key
3. Copy to `OPENROUTER_API_KEY`

### Langfuse (AI Observability)
1. Go to [Langfuse Cloud](https://cloud.langfuse.com)
2. Create a project
3. Copy keys to `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`

### Inngest (Background Jobs)
1. Go to [Inngest](https://app.inngest.com)
2. Create an app
3. Copy keys to `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`

### Loops (Email)
1. Go to [Loops](https://app.loops.so)
2. Get API key from Settings > API
3. Create transactional emails for: welcome, alert, digest, subscription, payment_failed
4. Copy email IDs to the corresponding env vars

### PostHog (Analytics)
1. Go to [PostHog](https://app.posthog.com)
2. Create a project
3. Copy keys to `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Auth pages (sign-in, sign-up)
│   ├── (dashboard)/         # Protected dashboard routes
│   │   ├── dashboard/       # Main dashboard
│   │   ├── monitors/        # Monitor management
│   │   ├── alerts/          # Alert feed
│   │   ├── audiences/       # Audience management
│   │   └── settings/        # User settings
│   ├── (marketing)/         # Public pages
│   │   └── pricing/         # Pricing page
│   ├── api/
│   │   ├── webhooks/        # Webhook handlers
│   │   ├── ai/              # AI endpoints
│   │   └── inngest/         # Inngest handler
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn components
│   ├── dashboard/           # Dashboard components
│   ├── monitors/            # Monitor components
│   └── shared/              # Shared components
├── lib/
│   ├── db/                  # Database (Drizzle)
│   ├── ai/                  # AI client (OpenRouter + Langfuse)
│   ├── inngest/             # Background jobs
│   ├── stripe.ts            # Stripe client
│   ├── loops.ts             # Email client
│   └── posthog.ts           # Analytics client
└── types/
```

## Database Schema

- **users**: User profiles synced with Clerk, subscription info
- **audiences**: Collections of communities to monitor
- **communities**: Reddit subreddits, HN, etc.
- **monitors**: Keyword/topic trackers
- **alerts**: Notification settings per monitor
- **results**: Found content with AI analysis
- **aiLogs**: AI usage and cost tracking

## AI Features

### Pain Point Detection
Categorizes content into:
- Pain and Anger
- Solution Requests
- Recommendations
- Questions

### Sentiment Analysis
- Score from -1 to 1
- Positive/Negative/Neutral classification

### Content Summarization
- Concise summaries of discussions
- Topic extraction
- Actionable insights detection

## Background Jobs (Inngest)

- `monitor-reddit`: Scans Reddit every 15 min
- `monitor-hackernews`: Scans HN every 15 min
- `analyze-content`: AI analysis on new results
- `send-alert`: Instant alert notifications
- `send-digest`: Daily/weekly digests

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## Local Webhook Development

### Stripe CLI
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### ngrok
```bash
ngrok http 3000
```

Then update webhook endpoints in Clerk, Stripe with the ngrok URL.

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add all environment variables
4. Deploy

### Production Checklist

- [ ] Update `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Update webhook URLs in Clerk, Stripe, Inngest
- [ ] Create transactional emails in Loops
- [ ] Set up Stripe products with production price IDs

## Pricing Tiers

| Feature | Free | Pro ($29/mo) | Enterprise ($99/mo) |
|---------|------|--------------|---------------------|
| Monitors | 3 | 20 | Unlimited |
| Results/month | 100 | 5,000 | Unlimited |
| AI Features | - | ✓ | ✓ |
| Real-time Alerts | - | ✓ | ✓ |
| API Access | - | - | ✓ |

## License

MIT
