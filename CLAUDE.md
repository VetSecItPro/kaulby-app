# CLAUDE.md - Kaulby

AI-powered community monitoring SaaS. Tracks Reddit, Hacker News, Product Hunt for keywords, analyzes sentiment/pain points via AI, sends alerts.

## Deployment

- **Production URL**: https://kaulbyapp.com
- **Vercel Project**: kaulby-app
- **Vercel Project ID**: prj_PulgkWaqblpsmmTuMwG00TPIa0qJ
- **Vercel Team ID**: team_unWh27RcjbaJx4bOQ5N7k5v0

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

## Architecture Rules

- **Auth**: Always verify `userId` from Clerk before database operations
- **Mutations**: Prefer server actions over API routes for form submissions
- **Components**: Use shadcn/ui from `@/components/ui` (don't modify these). Dashboard components go in `@/components/dashboard`
- **Database**: Schema is source of truth at `src/lib/db/schema.ts`. Use Drizzle's relational queries
- **Background jobs**: Define in `src/lib/inngest/functions/`. Use step functions for atomic operations
- **AI calls**: Always log to `aiLogs` table and trace with Langfuse

## Subscription Limits

| Tier | Monitors | Results/mo | AI | Alerts |
|------|----------|------------|-----|--------|
| free | 3 | 100 | No | No |
| pro | 20 | 5,000 | Yes | Yes |
| enterprise | Unlimited | Unlimited | Yes | Yes |

## Key Files

- `src/lib/db/schema.ts` - Database schema
- `src/lib/stripe.ts` - Plan definitions
- `src/lib/inngest/functions/` - Background jobs
- `src/lib/ai/prompts.ts` - AI prompts
- `src/middleware.ts` - Route protection

## Conventions

- Server components by default; add "use client" only when needed
- Use Drizzle inferred types: `typeof monitors.$inferSelect`
- API errors: return JSON with appropriate HTTP status
- Never commit secrets; all env vars in `.env.local`
