# CLAUDE.md - Kaulby

AI-powered community monitoring SaaS. Tracks Reddit, Hacker News, Product Hunt for keywords, analyzes sentiment/pain points via AI, sends alerts.

## Business Objective

**Primary goal: ***.**

Everything we build serves this purpose. The product must be so valuable and the UI so elegant that users gladly pay for it. Every feature, interaction, and design decision should move users toward subscription:

- Deliver immediate, tangible value that makes the product indispensable
- Create an experience so polished users trust us with their money
- Show free users exactly what they're missing (tasteful, not annoying)
- Make upgrading feel like unlocking superpowers, not removing restrictions

## Development Philosophy

- **No shortcuts**: Always implement strategic, comprehensive fixes. Never apply band-aids or quick patches that defer the real problem.
- **Error tracking**: When discovering pre-existing errors or issues while working on a task, note them in `kaulby-todo.md` under "Known Issues" and fix them after completing the current task.
- **Complete solutions**: Fix root causes, not symptoms. Consider downstream effects and related code paths.
- **No over-engineering**: Solve the current problem completely, but don't build for hypothetical future requirements.

## Autonomous Work Authorization

- **Pre-cleared for all operations**: No permission requests needed for file edits, database pushes, or shell commands.
- **Validate before pushing**: Always run `npx tsc --noEmit` locally before pushing to GitHub to catch TypeScript errors and avoid wasted CI cycles.
- **No git commits**: Do not commit or push to GitHub unless explicitly requested.
- **Database operations allowed**: Can push schema changes to Neon freely.
- **Strategic execution**: Work methodically, don't rush, ensure quality.

## Deployment

- **Production URL**: https://kaulbyapp.com
- **Vercel Project**: kaulby-app
- **Vercel Project ID**: REDACTED
- **Vercel Team ID**: REDACTED

## Tech Stack

- Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui
- Neon (Postgres) + Drizzle ORM
- Clerk (auth), Stripe (payments), Inngest (background jobs)
- OpenRouter (AI) + Langfuse (observability), Loops (email), PostHog (analytics)

## Commands

- `npm run dev` - Dev server
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio
- `npx inngest-cli@latest dev` - Inngest dev server (separate terminal)
- `npx tsc --noEmit` - **Run before pushing to GitHub** to catch TypeScript errors locally and avoid wasted CI cycles

## Architecture Rules

- **Auth**: Always verify `userId` from Clerk before database operations
- **Mutations**: Prefer server actions over API routes for form submissions
- **Components**: Use shadcn/ui from `@/components/ui` (don't modify these). Dashboard components go in `@/components/dashboard`
- **Database**: Schema is source of truth at `src/lib/db/schema.ts`. Use Drizzle's relational queries
- **Background jobs**: Define in `src/lib/inngest/functions/`. Use step functions for atomic operations
- **AI calls**: Always log to `aiLogs` table and trace with Langfuse

## Subscription Limits

| Tier | Monitors | Keywords | Results Visible | History | Platforms | Refresh |
|------|----------|----------|-----------------|---------|-----------|---------|
| free | 1 | 3 | Last 3 | 3 days | Reddit | 24hr delay |
| pro | 10 | 20 | Unlimited | 90 days | Reddit + HN + PH | Real-time |
| enterprise | Unlimited | 50 | Unlimited | 1 year | All platforms | Real-time |

| Tier | AI Analysis | Email Digest | Alerts | Export |
|------|-------------|--------------|--------|--------|
| free | First result only, then blurred/locked | None | None | None |
| pro | Full sentiment + pain points | Daily + Weekly | Email + Slack | CSV |
| enterprise | Full + "Ask AI" feature | Real-time option | All + Webhooks | CSV + API |

*****:**
- Free users see AI analysis is ready but blurred - "Unlock with Pro" CTA
- Results show count: "12 new mentions" but only 3 visible
- Urgency: "***"
- Social proof: "X Pro users tracked Y mentions this week"

*****s**: Hits monitor limit, tries to see more results, clicks locked AI analysis, adds 4th keyword, after 3 days on free tier.

## Key Files

- `src/lib/db/schema.ts` - Database schema (source of truth)
- `src/lib/stripe.ts` - Plan definitions and tier logic
- `src/lib/inngest/functions/` - Background jobs
- `src/lib/ai/prompts.ts` - AI prompts
- `src/middleware.ts` - Route protection
- `kaulby-todo.md` - Active gaps, migrations, and known issues

## Conventions

- Server components by default; add "use client" only when needed
- Use Drizzle inferred types: `typeof monitors.$inferSelect`
- API errors: return JSON with appropriate HTTP status
- Never commit secrets; all env vars in `.env.local`
