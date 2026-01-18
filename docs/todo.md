# Kaulby TODO

Active gaps, migrations, and known issues. See also: `docs/platforms-research.md` for platform API research.

**Last updated:** January 18, 2026

---

## Database Schema Gaps

Comparing current `schema.ts` against Project Bible requirements.

### Critical (Must Fix Before Launch)

- [x] **Result interaction tracking** - Add `is_viewed`, `viewed_at`, `is_clicked`, `clicked_at`, `is_saved`, `is_hidden` to results table ✅
- [x] **Pain point categories incomplete** - Expanded to 6: `pain_point`, `solution_request`, `question`, `feature_request`, `praise`, `discussion` ✅
- [x] **Usage tracking table** - Created `usage` table with period tracking and counts ✅
- [x] **Monitor health stats** - Added `last_checked_at`, `new_match_count` to monitors table ✅
- [x] **Subscription period tracking** - Added `current_period_start`, `current_period_end` to users table ✅
- [x] **Slack integrations table** - Created `slack_integrations` table for workspace connections ✅

### Moderate (Should Fix)

- [x] **Data retention enforcement** ✅ - Inngest cron job (`dataRetention`) runs daily at 3 AM UTC, deletes old results per tier (free=3d, pro=90d, enterprise=365d). Also includes `resetUsageCounters` and `cleanupAiLogs`.
- [x] **Webhook configurations** ✅ - Full implementation with `webhooks` and `webhookDeliveries` tables, HMAC signatures, exponential backoff retry logic (1min, 5min, 15min, 1hr, 4hr), and automatic cleanup.

### Post-MVP

See **[kaulby-postMVP.md](./kaulby-postMVP.md)** for full post-MVP roadmap including:
- API key management (Enterprise)
- X/Twitter monitoring (Enterprise)
- Admin dashboard improvements
- Additional platform integrations

---

## Migration Checklist

Run these in order after schema.ts updates:

1. [x] Update `src/lib/db/schema.ts` with all missing fields ✅
2. [x] Run `npm run db:push` to apply to Neon ✅
3. [ ] Verify in Drizzle Studio (`npm run db:studio`)
4. [ ] Update any affected queries/types in codebase
5. [ ] Test locally with dev server

---

## Feature Implementation Gaps

From Project Bible comparison:

### Tier Enforcement

- [x] Limit checking functions in `src/lib/limits.ts` ✅
- [x] Usage increment logic in Inngest jobs ✅
- [x] Feature gate checks in API routes and server actions ✅
- [x] Upgrade prompts when limits hit ✅

### Onboarding Flow

- [x] Welcome screen: "What do you want to track?" ✅ (`OnboardingWizard` step 1)
- [x] Quick monitor setup wizard ✅ (4-step wizard with templates)
- [x] First results shown immediately (seeded/cached data) ✅ (`SampleResultsPreview` component)
- [x] Getting started checklist on dashboard ✅ (`QuickStartGuide` component)

### Email Digests

- [x] Daily digest (Pro & Team) ✅ (`sendDailyDigest` - 9 AM local time, DST-aware)
- [x] Weekly digest (Team) ✅ (`sendWeeklyDigest` - 9 AM Monday, DST-aware)
- [x] Weekly insights summary with AI ✅ (`generateWeeklyInsights` for Pro+ users)

### UI Revamp

Complete overhaul for modern 2025-2026 SaaS aesthetic:

- [x] Modern color palette and typography refresh ✅ (teal/cyan primary, consistent typography)
- [x] Smooth page transitions and micro-interactions (Framer Motion) ✅ (`PageTransition` in dashboard)
- [x] Glassmorphism/subtle gradients where appropriate ✅ (empty state illustrations)
- [x] Improved card designs with hover states and shadows ✅ (`motion.div` with hover lift effects)
- [x] Loading skeletons instead of spinners ✅ (comprehensive skeleton components exist)
- [x] Empty state illustrations ✅ (`empty-states.tsx` with animated illustrations)
- [x] Responsive refinements for mobile/tablet ✅ (CSS-based responsive layout)
- [x] Dark mode support ✅ (always-on dark mode)
- [x] Toast notifications with animations ✅ (sonner toasts with animations)
- [x] Data visualization components (charts, sparklines) ✅ (`stat-card.tsx` sparklines, recharts)
- [x] Refined dashboard layout with better information hierarchy ✅ (`DashboardStats` component)

### Admin Dashboard

Full admin panel at `/manage` gated to admin accounts only:

- [x] Admin route protection middleware (`is_admin` check) ✅ (`manage/layout.tsx`)
- [x] Admin layout with dedicated navigation ✅ (Sidebar with "Admin Dashboard" link)
- [x] **User Management** ✅ (`/manage/users`)
  - [x] User list with search/filter ✅ (search by email/name/ID, filter by plan)
  - [x] User details (subscription, usage, monitors) ✅ (details dialog)
  - [x] Ability to upgrade/downgrade users ✅ (`updateUserPlan` server action)
  - [x] Ban/suspend functionality ✅ (PR #20 - `isBanned`, `bannedAt`, `bannedReason` fields added)
- [x] **Analytics & Metrics** ✅ (`/manage` main page)
  - [x] Total users, MRR, churn rate ✅ (`businessMetrics`)
  - [x] Signup trends (daily/weekly/monthly charts) ✅ (`userGrowth` chart)
  - [x] Active users graph ✅
  - [x] Conversion funnel visualization ✅ (`conversionRate`, `proConversions`)
- [x] **API Cost Tracking** ✅
  - [x] OpenRouter/AI costs by day/week/month ✅ (`aiCostsByDay`)
  - [x] Cost per user breakdown ✅ (`costBreakdown`, `topUsersByCost`)
  - [ ] Budget alerts/thresholds - See [kaulby-postMVP.md](./kaulby-postMVP.md)
- [x] **System Health** ✅ (`systemHealth` component)
  - [x] Inngest job success/failure rates ✅ (job status display)
  - [x] Average job processing times ✅ (`avgResponseTime`)
  - [ ] Error logs viewer - See [kaulby-postMVP.md](./kaulby-postMVP.md)
  - [ ] Database query performance - See [kaulby-postMVP.md](./kaulby-postMVP.md)
- [ ] **Content Moderation** - See [kaulby-postMVP.md](./kaulby-postMVP.md)

---

## Known Issues

Track pre-existing bugs/errors discovered during development here. Fix after current task.

*(None logged yet)*

---

## Completed

- [x] CLAUDE.md updated with development philosophy and expanded limits (Jan 13, 2026)
- [x] Created kaulby-todo.md for tracking gaps and issues (Jan 13, 2026)
- [x] Schema updated with result interaction fields, expanded pain point categories, usage table, monitor health stats, subscription period tracking, slack integrations table (Jan 13, 2026)
- [x] Pushed schema changes to Neon via `npm run db:push` (Jan 13, 2026)
- [x] Phase 9: UI Revamp - page transitions, empty states, sparklines, hover animations (Jan 17, 2026)
- [x] Phase 10: Admin Dashboard - already implemented at `/manage` with user management, analytics, cost tracking, system health (Jan 17, 2026)
- [x] Admin ban/unban functionality with `isBanned`, `bannedAt`, `bannedReason` fields (Jan 17, 2026)
- [x] Data retention enforcement - Inngest cron jobs for tier-based cleanup (already implemented)
- [x] Webhook configurations with retry logic - Full implementation with delivery tracking (already implemented)
- [x] Team workspaces - Schema, APIs, UI for Enterprise team management (already implemented)
