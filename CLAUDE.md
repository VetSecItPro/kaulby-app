# CLAUDE.md - Kaulby

AI-powered community monitoring SaaS. Tracks 16 platforms (Reddit, Hacker News, Product Hunt, Dev.to, Google Reviews, Trustpilot, App Store, Play Store, Quora, YouTube, G2, Yelp, Amazon Reviews, Indie Hackers, GitHub, Hashnode) for keywords, analyzes sentiment/pain points via AI, sends alerts.

## Business Objective

**Primary goal: Convert users to paying customers.**

Everything we build serves this purpose. The product must be so valuable and the UI so elegant that users gladly pay for it. Every feature, interaction, and design decision should move users toward subscription:

- Deliver immediate, tangible value that makes the product indispensable
- Create an experience so polished users trust us with their money
- Show free users exactly what they're missing (tasteful, not annoying)
- Make upgrading feel like unlocking superpowers, not removing restrictions

## Growth & Discovery Strategy (CRITICAL)

**Primary goal: Rank #1 for community monitoring searches everywhere.**

Kaulby must dominate search rankings (SEO) and AI answer engines (AEO) for all community monitoring, social listening, and brand monitoring queries. The objective is to:

1. **Capture GummySearch refugees** - GummySearch is shutting down with 10,000+ paying customers. These users need a new home, and Kaulby should be the obvious choice with better multi-platform coverage.

2. **Build the phenomenal product** - The product must be so good that users can't imagine going back to competitors. Every feature should be best-in-class. Word of mouth should drive organic growth.

3. **Win every search** - Whether someone searches "reddit monitoring tool", "social listening for startups", or asks ChatGPT "what's the best brand monitoring tool", Kaulby should appear first. This requires:
   - Comprehensive programmatic SEO pages for every keyword
   - Rich structured data (JSON-LD) for search engines and AI crawlers
   - FAQ content optimized for featured snippets and AI answers
   - Internal linking to eliminate orphan pages
   - Content that directly answers user questions (AEO)

4. **Drive signups relentlessly** - Every page, every feature, every interaction should guide users toward signing up. Clear CTAs, compelling value propositions, and frictionless onboarding.

**Remember**: We're not just building features - we're building the infrastructure to become the market leader in community monitoring.

## User Experience Philosophy

**Everything must be easy, intuitive, and professional.**

Every feature, every interaction, every screen must feel effortless:
- Minimize friction at every step - if something requires explanation, redesign it
- Professional polish in every detail - no rough edges, no "good enough"
- Entice users with value, don't frustrate them with complexity
- Test the "can my mom use this?" standard for every new feature

## Platform Sustainability

**Never become dependent on or vulnerable to platform shutdowns.**

Learn from GummySearch's fate with Reddit. Every integration decision must consider:
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

## Strategic Thinking (CRITICAL)

**For every feature or action, think holistically and consider all angles:**

Before implementing any feature, ask:
1. **What does this feature actually need to do end-to-end?** Don't just build the UI - build the complete flow.
2. **What are the legal/compliance implications?** (GDPR, CCPA, data retention, etc.)
3. **What happens in edge cases?** (user cancels, errors occur, timeouts, etc.)
4. **What background jobs or scheduled tasks are needed?** A button that says "delete in 7 days" means nothing without the job that actually deletes.
5. **What notifications/emails should be sent?** Users expect confirmation of important actions.
6. **What audit trail is needed?** For sensitive operations, log who did what and when.

**Example - Account Deletion Process:**
- UI: Danger Zone modal with typed confirmation ✓
- Database: `deletionRequestedAt` timestamp ✓
- API: Request and cancel deletion endpoints ✓
- Confirmation page: Show countdown and cancel option ✓
- **Scheduled job**: Inngest function to actually delete after 7 days (REQUIRED)
- **Email notifications**: Confirmation email, reminder at 24hrs, final deletion notice
- **Data deletion**: Must delete ALL user data (monitors, results, AI logs, team members, API keys)
- **External cleanup**: Cancel Polar subscription, delete from Clerk
- **Audit log**: Record deletion for compliance

**Research before implementing:**
- For sensitive features (payments, deletion, auth), research best practices online
- Check what established SaaS products do (AWS, Stripe, GitHub)
- Ensure legal compliance (GDPR right to erasure, CCPA, etc.)

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
- **Vercel Project ID**: prj_PulgkWaqblpsmmTuMwG00TPIa0qJ
- **Vercel Team ID**: team_unWh27RcjbaJx4bOQ5N7k5v0

## Tech Stack

- Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui
- Neon (Postgres) + Drizzle ORM
- Clerk (auth), Polar.sh (payments), Inngest (background jobs)
- OpenRouter (AI) + Langfuse (observability), Resend (email), PostHog (analytics)

## Commands

- `npm run dev` - Dev server
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Drizzle Studio
- `npx inngest-cli@latest dev` - Inngest dev server (separate terminal, includes MCP at http://127.0.0.1:8288/mcp)
- `npx tsc --noEmit` - **Run before pushing to GitHub** to catch TypeScript errors locally and avoid wasted CI cycles

## Inngest (Background Jobs)

**Local Development:**
1. Run `npx inngest-cli@latest dev` in separate terminal
2. MCP available at `http://127.0.0.1:8288/mcp` for AI-assisted testing
3. Dashboard at `http://127.0.0.1:8288` to view runs/events

**Production (Inngest Cloud):**
- Dashboard: https://app.inngest.com
- App must be synced at: https://kaulbyapp.com/api/inngest
- Cron jobs (monitor scans) run every 15min-2hrs depending on platform
- Requires `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` in Vercel env vars
- Free plan limit: 5 concurrent function executions

**After deploying code changes:** Must re-sync app in Inngest dashboard (Apps → Sync)

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
| pro | 10 | 10 | Unlimited | 90 days | 8 Pro platforms | 4-hour cycle |
| enterprise (Team) | 30 | 20 | Unlimited | 1 year | All 16 platforms | 2-hour cycle |

**Platform Tiers:**
- **Free**: Reddit only
- **Pro (8 platforms)**: Reddit, Hacker News, Indie Hackers, Product Hunt, Google Reviews, YouTube, GitHub, Trustpilot
- **Team (16 platforms)**: All Pro platforms + Dev.to, Hashnode, App Store, Play Store, Quora, G2, Yelp, Amazon Reviews

| Tier | AI Analysis | Email Digest | Alerts | Export | Team |
|------|-------------|--------------|--------|--------|------|
| free | First result only, then blurred/locked | None | None | None | - |
| pro | Full sentiment + pain points | Daily | Email | CSV | 1 seat |
| enterprise | Full AI analysis | Real-time | Email + Webhooks | CSV | 5 seats (+$15/user) |

**Founding Members Program:**
- First 1,000 Pro/Team subscribers lock in their price forever
- Tracked via `isFoundingMember`, `foundingMemberNumber`, `foundingMemberPriceId` in users table
- After 1,000, new subscribers see updated (higher) pricing

**Conversion Strategy:**
- Free users see AI analysis is ready but blurred - "Unlock with Pro" CTA
- Results show count: "12 new mentions" but only 3 visible
- Urgency: "Results expire in 2 days"
- Social proof: "X Pro users tracked Y mentions this week"

**Upgrade Triggers**: Hits monitor limit, tries to see more results, clicks locked AI analysis, adds 4th keyword, after 3 days on free tier.

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
