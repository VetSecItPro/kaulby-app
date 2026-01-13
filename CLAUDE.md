# CLAUDE.md - Kaulby

AI-powered community monitoring SaaS. Tracks Reddit, Hacker News, Product Hunt for keywords, analyzes sentiment/pain points via AI, sends alerts.

## Development Philosophy

- **No shortcuts**: Always implement strategic, comprehensive fixes. Never apply band-aids or quick patches that defer the real problem.
- **Error tracking**: When discovering pre-existing errors or issues while working on a task, note them in `kaulby-todo.md` under "Known Issues" and fix them after completing the current task.
- **Complete solutions**: Fix root causes, not symptoms. Consider downstream effects and related code paths.
- **No over-engineering**: Solve the current problem completely, but don't build for hypothetical future requirements.

## Autonomous Work Authorization

- **Pre-cleared for all operations**: No permission requests needed for file edits, database pushes, or shell commands.
- **Validate work**: Ensure no TypeScript errors, test compilation before moving on.
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

## Architecture Rules

- **Auth**: Always verify `userId` from Clerk before database operations
- **Mutations**: Prefer server actions over API routes for form submissions
- **Components**: Use shadcn/ui from `@/components/ui` (don't modify these). Dashboard components go in `@/components/dashboard`
- **Database**: Schema is source of truth at `src/lib/db/schema.ts`. Use Drizzle's relational queries
- **Background jobs**: Define in `src/lib/inngest/functions/`. Use step functions for atomic operations
- **AI calls**: Always log to `aiLogs` table and trace with Langfuse

## Subscription Limits

| Tier | Monitors | Keywords/Monitor | Sources/Monitor | Results History | Platforms |
|------|----------|------------------|-----------------|-----------------|-----------|
| free | 1 | 3 | 2 | 7 days | Reddit only |
| pro | 10 | 20 | 10 | 90 days | Reddit + HN |
| enterprise | Unlimited | 50 | 25 | 1 year | All (Reddit, HN, PH, Dev.to) |

| Tier | Email Digest | AI Features | Alerts | Export |
|------|--------------|-------------|--------|--------|
| free | Weekly only | Basic sentiment | None | None |
| pro | Daily + Weekly | Sentiment + Pain point categories | Email + Slack | CSV |
| enterprise | Real-time option | Full + "Ask" feature | All + Webhooks | CSV + API |

*****s**: User hits monitor limit, tries to add more keywords, clicks locked feature, 7 days on free tier.

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
