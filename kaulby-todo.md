# Kaulby TODO

Active gaps, migrations, and known issues. Reference: `kaulby-project-bible.md` in Downloads.

**Last updated:** January 13, 2026

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

- [ ] **Data retention enforcement** - Implement cron job to delete old results per tier (free=7d, pro=90d, enterprise=1yr)
- [ ] **Webhook configurations** - May need structured webhook table with retry logic (currently using `destination` field)

### Low Priority (Post-Launch)

- [ ] **Team workspaces** - Enterprise feature, not in MVP
- [ ] **API key management** - Enterprise feature, not in MVP

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

- [ ] Limit checking functions in `src/lib/limits.ts`
- [ ] Usage increment logic in Inngest jobs
- [ ] Feature gate checks in API routes and server actions
- [ ] Upgrade prompts when limits hit

### Onboarding Flow

- [ ] Welcome screen: "What do you want to track?"
- [ ] Quick monitor setup wizard
- [ ] First results shown immediately (seeded/cached data)
- [ ] Getting started checklist on dashboard

### Email Digests

- [ ] Daily digest (Pro+)
- [ ] Weekly digest (all tiers)
- [ ] Weekly insights summary with AI

### UI Revamp

Complete overhaul for modern 2025-2026 SaaS aesthetic:

- [ ] Modern color palette and typography refresh
- [ ] Smooth page transitions and micro-interactions (Framer Motion)
- [ ] Glassmorphism/subtle gradients where appropriate
- [ ] Improved card designs with hover states and shadows
- [ ] Loading skeletons instead of spinners
- [ ] Empty state illustrations
- [ ] Responsive refinements for mobile/tablet
- [ ] Dark mode support
- [ ] Toast notifications with animations
- [ ] Data visualization components (charts, sparklines)
- [ ] Refined dashboard layout with better information hierarchy

### Admin Dashboard

Full admin panel gated to admin accounts only:

- [ ] Admin route protection middleware (`is_admin` check)
- [ ] Admin layout with dedicated navigation
- [ ] **User Management**
  - [ ] User list with search/filter
  - [ ] User details (subscription, usage, monitors)
  - [ ] Ability to upgrade/downgrade users
  - [ ] Ban/suspend functionality
- [ ] **Analytics & Metrics**
  - [ ] Total users, MRR, churn rate
  - [ ] Signup trends (daily/weekly/monthly charts)
  - [ ] Active users graph
  - [ ] Conversion funnel visualization
- [ ] **API Cost Tracking**
  - [ ] OpenRouter/AI costs by day/week/month
  - [ ] Serper API usage and costs
  - [ ] Cost per user breakdown
  - [ ] Budget alerts/thresholds
- [ ] **System Health**
  - [ ] Inngest job success/failure rates
  - [ ] Average job processing times
  - [ ] Error logs viewer
  - [ ] Database query performance
- [ ] **Content Moderation**
  - [ ] Flag/review reported content
  - [ ] Monitor abuse detection

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
