# CLAUDE.md - Kaulby

AI-powered community monitoring SaaS. Tracks 9 platforms (Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot, App Store, Play Store, Quora, Dev.to) for keywords, analyzes sentiment/pain points via AI, sends alerts.

## Business Objective

**Primary goal: ***.**

Everything we build serves this purpose. The product must be so valuable and the UI so elegant that users gladly pay for it. Every feature, interaction, and design decision should move users toward subscription:

- Deliver immediate, tangible value that makes the product indispensable
- Create an experience so polished users trust us with their money
- Show free users exactly what they're missing (tasteful, not annoying)
- Make upgrading feel like unlocking superpowers, not removing restrictions

## User Experience Philosophy

**Everything must be easy, intuitive, and professional.**

Every feature, every interaction, every screen must feel effortless:
- Minimize friction at every step - if something requires explanation, redesign it
- Professional polish in every detail - no rough edges, no "good enough"
- Entice users with value, don't frustrate them with complexity
- Test the "can my mom use this?" standard for every new feature

## Platform Sustainability

**Never become dependent on or vulnerable to platform shutdowns.**

Learn from ***'s fate with Reddit. Every integration decision must consider:
- Use official APIs where available, even if limited
- For scraping: use reputable third-party services (Apify) rather than direct scraping
- Maintain respectful rate limits - never abuse platform resources
- Diversify platform coverage - don't over-rely on any single source
- Store historical data so users retain value even if a platform cuts access
- Build relationships, not dependencies - be a good citizen of each platform's ecosystem
- Have contingency plans for each platform's potential API changes or shutdowns

## Development Philosophy

- **No shortcuts**: Always implement strategic, comprehensive fixes. Never apply band-aids or quick patches that defer the real problem.
- **Error tracking**: When discovering pre-existing errors or issues while working on a task, note them in `docs/todo.md` under "Known Issues" and fix them after completing the current task.
- **Complete solutions**: Fix root causes, not symptoms. Consider downstream effects and related code paths.
- **No over-engineering**: Solve the current problem completely, but don't build for hypothetical future requirements.

## Autonomous Work Authorization

- **Pre-cleared for all operations**: No permission requests needed for file edits, database pushes, or shell commands.
- **MANDATORY local validation before pushing**: Always run ALL validation checks locally before saying ready to push:
  1. `npm run lint` - Fix all ESLint errors
  2. `npx tsc --noEmit` - Fix all TypeScript errors
  3. `npm run build` - Ensure build succeeds
  Never announce "ready to push" until all checks pass locally.
- **NEVER push to GitHub**: Do not commit or push to GitHub unless explicitly requested. Always explain what you plan to do and wait for user confirmation before any git push. The user will specify when to push and act without requiring permission.
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
- Clerk (auth), Polar.sh (payments), Inngest (background jobs)
- OpenRouter (AI) + Langfuse (observability), Resend (email), PostHog (analytics)

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
| free | 1 | 3 | Last 3 | 3 days | Reddit only | 24hr delay |
| pro | 10 | 20 | Unlimited | 90 days | All 9 platforms | 4-hour cycle |
| enterprise (Team) | 30 | 35 | Unlimited | 1 year | All 9 platforms | 2-hour cycle |

| Tier | AI Analysis | Email Digest | Alerts | Export | Team |
|------|-------------|--------------|--------|--------|------|
| free | First result only, then blurred/locked | None | None | None | - |
| pro | Full sentiment + pain points | Daily | Email | CSV | 1 seat |
| enterprise | Full AI analysis | Real-time | Email + Webhooks | CSV | 5 seats (+$15/user) |

*****s Program:**
- First 1,000 Pro/Team subscribers lock in their price forever
- Tracked via `isFoundingMember`, `***Number`, `***PriceId` in users table
- After 1,000, new subscribers see updated (higher) pricing

*****:**
- Free users see AI analysis is ready but blurred - "Unlock with Pro" CTA
- Results show count: "12 new mentions" but only 3 visible
- Urgency: "***"
- Social proof: "X Pro users tracked Y mentions this week"

*****s**: Hits monitor limit, tries to see more results, clicks locked AI analysis, adds 4th keyword, after 3 days on free tier.

## Key Files

- `src/lib/db/schema.ts` - Database schema (source of truth)
- `src/lib/plans.ts` - Plan definitions and tier logic
- `src/lib/inngest/functions/` - Background jobs
- `src/lib/ai/prompts.ts` - AI prompts
- `src/middleware.ts` - Route protection
- `docs/todo.md` - Active gaps, migrations, and known issues
- `docs/platforms-research.md` - Platform API research and recommendations

## Conventions

- Server components by default; add "use client" only when needed
- Use Drizzle inferred types: `typeof monitors.$inferSelect`
- API errors: return JSON with appropriate HTTP status
- Never commit secrets; all env vars in `.env.local`
