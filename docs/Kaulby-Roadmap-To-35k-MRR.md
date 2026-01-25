# Kaulby Roadmap to $35k MRR

> **Goal:** Match GummySearch's peak ($35k MRR, 10k paying customers) then exceed it with multi-platform advantage.

**Last validated:** January 26, 2026 - Most Phase 1-4 items complete. See `docs/todo.md` for current pending items.

---

## Phase 1: GummySearch Feature Parity (Capture Refugees)

*These features made GummySearch worth $29-59/month to 10,000 customers.*

### 1.1 Conversation Categorization System ✅ COMPLETE

**Why:** GummySearch's killer feature - automatically sort conversations into actionable categories.

**Status: COMPLETE** - Full categorization system with AI analyzer and UI integration.

#### Database Changes
- [x] Add `conversationCategory` column to results table (enum: pain_point, solution_request, advice_request, money_talk, hot_discussion)
- [x] Add `conversationCategoryConfidence` column to results table (decimal 0-1)
- [x] Add index for category filtering
- [ ] Add `category_keywords_matched` column (optional enhancement)

#### AI Prompt Updates
- [x] Create conversation categorization AI analyzer (`src/lib/ai/analyzers/conversation-category.ts`)
- [x] Define category detection with AI understanding (not just keywords)
- [x] Integrate with comprehensive analysis pipeline
- [x] Store category in results table after analysis

#### UI Updates
- [x] Add category badge/tag on each result card (8 components use it)
- [x] Color-code categories
- [x] Category breakdown in analytics charts
- [x] Filter results by category in API endpoints
- [ ] Add category filter chips as dedicated UI (categories visible but chips could be added)

#### Category-Specific Views
- [x] Categories visible in results list with filtering
- [ ] Create dedicated "Pain Points" view page (optional - filtering works)
- [ ] Create dedicated "Solution Requests" view page (optional)

#### Implementation Details
- Analyzer: `src/lib/ai/analyzers/conversation-category.ts`
- Schema: `conversationCategoryEnum` in `src/lib/db/schema.ts`
- Used in: 12+ API routes, 8 UI components

### 1.2 Audience System (Group Monitors) ✅ COMPLETE

**Why:** GummySearch's audience-first approach discovered conversations users wouldn't find with keywords alone.

#### Database Schema
- [x] Create `audiences` table with all fields
- [x] Create `audience_monitors` junction table
- [x] Add `audience_id` nullable FK to monitors table (for quick lookup)
- [x] Create indexes for performance

#### API Endpoints
- [x] `GET /api/audiences` - list user's audiences
- [x] `POST /api/audiences` - create audience
- [x] `GET /api/audiences/[id]` - get audience with monitors
- [x] `PATCH /api/audiences/[id]` - update audience
- [x] `DELETE /api/audiences/[id]` - delete audience (keeps monitors)
- [x] `POST /api/audiences/[id]/monitors` - add monitor to audience
- [x] `DELETE /api/audiences/[id]/monitors/[monitorId]` - remove monitor from audience
- [x] `GET /api/audiences/[id]/results` - get all results from audience's monitors (via detail page)

#### UI Pages
- [x] Create `/dashboard/audiences` - list all audiences
- [x] Create `/dashboard/audiences/new` - create audience wizard
- [x] Create `/dashboard/audiences/[id]` - audience detail view with all results
- [x] Create `/dashboard/audiences/[id]/edit` - edit audience
- [x] Add audience selector dropdown on monitors page
- [x] Add "Add to Audience" button on monitor cards
- [x] Add audience grouping view on main dashboard
- [x] Add audience-level analytics (combined stats from all monitors)

#### Audience Features
- [x] Aggregate results view across all monitors in audience
- [x] Combined mention count for audience
- [x] Audience-level sentiment average
- [x] Audience-level category breakdown
- [x] Quick-add related subreddits to audience (AI suggestions)

### 1.3 Boolean Search Operators ✅ CORE COMPLETE

**Why:** Power users need precise control over keyword matching.

#### Search Parser
- [x] Create `parseSearchQuery()` function in new file `src/lib/search-parser.ts`
- [x] Support `title:keyword` - search only in titles
- [x] Support `body:keyword` - search only in body/content
- [x] Support `"exact phrase"` - match exact phrase
- [x] Support `NOT term` - exclude results with term
- [x] Support `OR` operator - match either term
- [x] Support `AND` operator (default) - match both terms
- [x] Support `author:username` - filter by author
- [x] Support `subreddit:name` - filter by subreddit
- [x] Support `platform:name` - filter by platform
- [ ] Support parentheses for grouping: `(A OR B) AND C` (future enhancement)

#### Integration
- [x] Update monitor keyword matching to use parser (via content-matcher.ts)
- [x] Update results search/filter to use parser
- [x] Add search syntax help tooltip in UI (SearchQueryInput component)
- [x] Add example queries in placeholder text
- [x] Validate search syntax on input
- [x] Show parsed query preview (what will be matched)

#### UI (Future Enhancements)
- [x] Add "Advanced Search" collapsible on monitor creation (Pro feature)
- [ ] Add search builder UI for non-technical users
- [ ] Add saved searches feature
- [ ] Add search history dropdown

### 1.4 Email Digest Improvements ✅ CORE COMPLETE

**Why:** GummySearch's digests were highly rated - keyword highlighting, deduplication, efficiency scores.

#### Digest Content Enhancements
- [x] Highlight matched keywords in title (bold/color)
- [ ] Highlight matched keywords in content snippet
- [ ] Add relevance/efficiency score to each result
- [x] Deduplicate - don't send same result twice
- [x] Track which results were sent in previous digests
- [x] Add `last_sent_in_digest_at` column to results
- [x] Show "X new mentions since last digest" count
- [x] Group results by platform in digest
- [x] Group results by category in digest
- [x] Add sentiment indicator (emoji or color)

#### Digest Frequency Options
- [x] Add "Instant" alert option (per-result, not batch)
- [x] Add "Weekly" digest option
- [ ] Add "Monthly" digest option
- [ ] Add custom schedule (specific days/times)
- [ ] Add "Pause digests" toggle (keep tracking, stop emails)
- [ ] Store digest preferences per monitor AND per user (global default)

#### Digest UI Improvements
- [x] Redesign email template with better formatting
- [x] Add "View in Kaulby" deep links to each result
- [x] Add "View on [Platform]" direct links
- [ ] Add unsubscribe link (per monitor)
- [x] Add digest preferences link
- [x] Mobile-responsive email template
- [ ] Dark mode email option

#### Tracking & Analytics (Future Enhancement)
- [ ] Track email open rates
- [ ] Track link click rates
- [ ] Calculate "efficiency score" (clicks / total results)
- [ ] Show efficiency trends over time
- [ ] Suggest pruning low-efficiency keywords

### 1.5 Slack Integration ✅ COMPLETE

**Why:** GummySearch Pro users got Slack/Discord - critical for teams.

#### Slack Setup
- [x] Add Slack webhook URL field to webhooks table (or webhook_type enum)
- [x] Create Slack OAuth app (optional, for richer integration)
- [x] Document how users get Slack incoming webhook URL
- [x] Add Slack setup guide in dashboard

#### Slack Payload Format
- [x] Format alerts as Slack attachments:
  ```json
  {
    "text": "New mention of [Company] on r/[subreddit]",
    "attachments": [{
      "color": "#sentiment-color",
      "title": "[Post Title]",
      "title_link": "[Reddit URL]",
      "text": "[Content snippet - 200 chars]",
      "fields": [
        {"title": "Platform", "value": "Reddit", "short": true},
        {"title": "Category", "value": "Pain Point", "short": true},
        {"title": "Sentiment", "value": "Negative", "short": true},
        {"title": "Engagement", "value": "45 upvotes", "short": true}
      ],
      "footer": "Kaulby",
      "ts": [timestamp]
    }]
  }
  ```
- [x] Support Slack Block Kit for richer formatting
- [x] Add action buttons (Mark as Read, View in Kaulby)

#### Slack Features
- [ ] Per-monitor Slack channel configuration (future enhancement)
- [ ] Per-category Slack channel (pain points to #feedback, etc.) (future enhancement)
- [ ] Slack notification preferences (all, high-priority only, daily summary) (future enhancement)
- [x] Test Slack webhook button

### 1.6 Discord Integration ✅ COMPLETE

**Why:** Many indie hackers and communities use Discord over Slack.

#### Discord Setup
- [x] Add Discord webhook URL field to webhooks
- [x] Document how users create Discord webhook
- [x] Add Discord setup guide in dashboard

#### Discord Payload Format
- [x] Format alerts as Discord embeds:
  ```json
  {
    "content": "New mention of [Company]",
    "embeds": [{
      "title": "[Post Title]",
      "url": "[Reddit URL]",
      "description": "[Content snippet]",
      "color": 16711680,
      "fields": [
        {"name": "Platform", "value": "Reddit", "inline": true},
        {"name": "Category", "value": "Pain Point", "inline": true},
        {"name": "Sentiment", "value": "Negative", "inline": true},
        {"name": "Engagement", "value": "👍 45", "inline": true}
      ],
      "footer": {"text": "Kaulby"},
      "timestamp": "[ISO 8601]"
    }]
  }
  ```
- [x] Support multiple embeds for batch notifications
- [x] Add Kaulby branding/avatar

#### Discord Features
- [ ] Per-monitor Discord channel configuration (future enhancement)
- [x] Test Discord webhook button
- [ ] Discord bot option (future - richer interaction)

### 1.7 Day Pass Pricing ✅ COMPLETE

**Why:** GummySearch's $10 day pass was genius - captures users who don't want subscriptions.

**Status: COMPLETE** - Full day pass implementation with Polar integration.

#### Polar Setup (using Polar instead of Stripe)
- [x] Create "Day Pass" product in Polar ($10 one-time)
- [x] Configure in environment variables
- [x] Handle Polar webhook for day pass purchases

#### Database Changes
- [x] Add `dayPassExpiresAt` column to users table
- [x] Add `dayPassPurchaseCount` column to users table
- [x] Add `lastDayPassPurchasedAt` column to users table

#### Access Control
- [x] Check day pass expiry in limits system
- [x] Day pass grants Pro-level access for 24 hours
- [x] Show countdown timer in UI when day pass active
- [ ] Send reminder email 1 hour before expiry (optional enhancement)
- [ ] Send "Day pass expired" email with upgrade CTA (optional enhancement)

#### Checkout Flow
- [x] Create `/api/polar/day-pass` endpoint
- [x] Create `/api/user/day-pass` status endpoint
- [x] Handle day pass webhook from Polar

#### UI
- [x] Day pass status component (`day-pass-card.tsx`)
- [x] Show hours/minutes remaining
- [x] Integrated in sidebar and dashboard layout

#### Implementation Details
- Library: `src/lib/day-pass.ts` - activation, status checking, history
- API: `/api/polar/day-pass`, `/api/user/day-pass`
- Webhook: Handled in `/api/webhooks/polar/route.ts`
- UI: `src/components/day-pass-card.tsx`

---

## Phase 2: Competitive Advantages (Exceed GummySearch)

*Features that make Kaulby BETTER than GummySearch ever was.*

### 2.1 Multi-Platform Correlation ✅

**Why:** Kaulby has 9 platforms - GummySearch had 1. This is our moat.

**Status: COMPLETE** - Full cross-platform insights dashboard with topic detection and correlation.

#### Cross-Platform Detection
- [x] Create `cross_platform_topics` table (schema at `src/lib/db/schema.ts`)
- [x] Create topic detection algorithm (`findTopicClusters` in insights API)
  - Extract key phrases from results
  - Group similar phrases across platforms
  - Calculate correlation score
- [x] Detect when same topic trends on multiple platforms
- [x] AI-powered topic extraction fallback for sparse data
- [ ] Alert user to cross-platform trends - future enhancement

#### Cross-Platform Dashboard
- [x] Create `/dashboard/insights` page
- [x] Show "Trending Across Platforms" widget
- [x] Show platform comparison chart (mentions by platform)
- [x] Show sentiment comparison by platform
- [x] Show platform correlation (which platforms discuss same topics)
- [ ] Show timing correlation (did Reddit mention before HN?) - future enhancement
- [ ] Show "Your brand on each platform" summary - future enhancement

#### Cross-Platform Reports
- [x] Insights data available for report generation
- [x] Platform-specific sentiment patterns in insights API
- [ ] Generate cross-platform weekly report - can be added to email digest
- [ ] Recommend which platforms to focus on - future enhancement

#### Implementation Details
- Database: `cross_platform_topics` table with indexes
- API: `/api/insights` - topic clustering, correlation, AI fallback
- UI: `/dashboard/insights` - InsightsView component with topic cards, correlation display

### 2.2 AI "No Keyword" Mode ✅

**Why:** GummySearch's beta feature that found pain points semantically. We can ship it fully.

**Status: COMPLETE** - Implemented AI Discovery mode with semantic matching.

#### Semantic Analysis Pipeline
- [x] Create new monitor type: "AI Discovery" (no keywords required)
- [x] Add `monitor_type` column to monitors (keyword, ai_discovery)
- [x] Create AI prompt for semantic pain point detection (`aiDiscovery` in prompts.ts)
- [x] Process posts without keyword matching (via `checkAIDiscoveryMatch`)
- [x] Filter by relevance threshold (0.5 minimum score)
- [ ] Learn from user feedback (thumbs up/down on results) - future enhancement

#### AI Discovery UI
- [x] Add "AI Discovery Mode" toggle on monitor creation
- [x] Add discovery prompt textarea with examples
- [x] Integrate with monitors API (stores `monitorType` and `discoveryPrompt`)
- [ ] Show relevance score on AI-discovered results - future enhancement
- [ ] Add "Why this was shown" explanation tooltip - future enhancement
- [ ] Add thumbs up/down feedback buttons - future enhancement
- [ ] Train model on feedback (future)

#### Implementation Details
- New file: `src/lib/ai/analyzers/ai-discovery.ts` - AI semantic matching
- Updated: `src/app/api/monitors/route.ts` - handles monitorType/discoveryPrompt
- Updated: `src/app/(dashboard)/dashboard/monitors/new/new-monitor-form.tsx` - UI for mode selection
- Updated: `src/lib/inngest/functions/scan-on-demand.ts` - unified content matching function

### 2.3 Competitive Intelligence Dashboard ✅

**Why:** Track competitors alongside your brand - something GummySearch didn't focus on.

**Status: COMPLETE** - Implemented via monitors + Share of Voice architecture.

#### Architecture Decision
Instead of a separate `competitors` table, competitive analysis is elegantly implemented through the existing monitor system:
- Users create monitors for their brand AND competitor brands
- Each monitor tracks mentions, sentiment, and trends
- Share of Voice API aggregates all monitors for comparison
- This approach is simpler and more flexible than a separate table

#### Competitor Tracking
- [x] Track competitors via dedicated monitors (each monitor = one brand)
- [x] Calculate share of voice (`/api/analytics/share-of-voice`)
- [x] Compare sentiment: you vs competitors (in Share of Voice component)
- [x] Trend comparison with previous period
- [ ] Dedicated "competitor pain points" feed - future enhancement

#### Competitive Dashboard UI
- [x] Share of Voice component (`share-of-voice.tsx`)
  - Horizontal stacked bar showing distribution
  - Brand rows with percentages and trends
  - Sentiment breakdown per brand
- [x] Integrated in Analytics page for Team tier
- [x] Trend indicators (up/down arrows)
- [ ] Dedicated `/dashboard/competitive` page - future enhancement (data already available)
- [ ] "Competitive Wins" feed - future enhancement

#### Implementation Details
- Component: `src/components/dashboard/share-of-voice.tsx`
- API: `src/app/api/analytics/share-of-voice/route.ts`
- Integration: `src/components/dashboard/analytics-charts.tsx`
- Tier: Team (enterprise) feature

### 2.4 Historical Trends & Analytics ✅ COMPLETE

**Why:** GummySearch had limited history. We store everything - use it.

#### Trend Charts
- [x] Create mention volume over time chart (area chart)
- [x] Create sentiment trend chart (stacked area)
- [x] Create category breakdown over time (pie chart)
- [x] Create platform comparison over time (bar chart)
- [x] Add date range selector (7d, 30d, 90d, 1y)
- [x] Add comparison to previous period (Share of Voice)

#### Analytics Dashboard
- [x] Create `/dashboard/analytics` page
- [x] Show total mentions (with trend indicator)
- [x] Show average sentiment (with trend)
- [x] Show most active platform
- [x] Show most common category
- [ ] Show peak activity times (heatmap) - future enhancement
- [ ] Show top engaging posts - future enhancement
- [x] Export analytics as HTML report

### 2.5 Subreddit/Community Database ✅ IMPLEMENTED

**Why:** GummySearch had 130k subreddit pages for SEO. We can do this for all platforms.

**Status: COMPLETE** - `communityGrowth` table exists and powers SEO pages.

#### Community Stats Table
- [x] Created `community_growth` table in schema with:
  - platform, identifier (e.g., "r/SaaS")
  - member_count, post_count_daily, engagement_rate
  - recorded_at for historical tracking
  - Indexes for efficient lookup

#### Community Discovery
- [x] Stats collected via Inngest cron job
- [x] Growth data used in subreddit SEO pages
- [ ] Calculate growth rates (future enhancement)
- [ ] Identify trending subreddits (future enhancement)
- [ ] Find related subreddits algorithmically (future enhancement)

#### Programmatic SEO Pages
- [x] Created `/subreddits` index page with all tracked subreddits
- [x] Created `/subreddits/[slug]` dynamic pages for each subreddit
- [x] Member count and posts/day displayed
- [x] "Monitor this subreddit" CTA on each page
- [x] Structured data (JSON-LD) for SEO
- [x] Categories: Business, Marketing, Tech, Finance, Productivity, Indie
- [ ] Expand to other platforms beyond Reddit (future)

---

## Phase 3: Platform Resilience (Don't Die Like GummySearch)

*GummySearch died from platform dependency. We won't.*

### 3.1 Multi-Source Data Collection ✅ PARTIALLY COMPLETE

#### Apify Integration
- [x] Add `APIFY_API_KEY` to environment variables
- [x] Create Apify integration (`src/lib/apify.ts`)
- [x] Use Apify for 10+ platforms: Google Reviews, Trustpilot, App Store, Play Store, Quora, YouTube, G2, Yelp, Amazon
- [x] Track platform source in results
- [ ] Implement fallback logic for Reddit (currently Apify-only for some, API-only for Reddit)
- [ ] Monitor API health and auto-switch if degraded

#### Rate Limit Management
- [ ] Parse `X-Ratelimit-Remaining` header from Reddit
- [ ] Implement request queue with rate limiting
- [x] Implement retry logic on errors
- [ ] Add circuit breaker pattern for failing APIs
- [ ] Dashboard showing API health status

#### Caching Layer
- [ ] Implement caching for API responses
- [ ] Use Redis or in-memory cache
- [ ] Cache invalidation on relevant events

### 3.2 Data Portability ✅

#### User Data Export
- [x] Create `/api/user/export` endpoint (full JSON export)
- [x] Export all monitors as JSON
- [x] Export all results as CSV (`/api/results/export`)
- [x] Export user settings/profile as JSON
- [x] Include audience configurations
- [x] Include AI usage logs
- [ ] Zip all exports together (optional enhancement)
- [ ] Send download link via email (optional enhancement)

#### Implementation Details
- Full export: `POST /api/user/export` - Returns JSON with monitors, results, alerts, audiences, AI logs
- CSV export: `GET /api/results/export` - Returns CSV of all results (Pro/Team feature)
- Both endpoints return downloadable files with proper Content-Disposition headers

#### Import from Competitors
- [ ] Create GummySearch import tool (if they provide export)
- [ ] Import audiences/keyword groups
- [ ] Import saved searches
- [ ] Import notification preferences

### 3.3 Platform-Specific Optimizations ✅ PARTIALLY COMPLETE

#### Reddit Improvements
- [ ] Use official OAuth authentication (currently using web scraping)
- [ ] Register proper User-Agent
- [ ] Implement comment streaming (not just posts)
- [ ] Track post score changes over time
- [ ] Detect deleted/removed posts

#### Hacker News Improvements ✅
- [x] Switch to Algolia API for search (`src/lib/hackernews.ts`)
- [x] Support story, comment, ask_hn, show_hn, front_page search types
- [x] Track comments and stories
- [x] Detect front page posts via `_tags`
- [x] Calculate engagement score from points/comments

#### Product Hunt Improvements ✅
- [x] Use GraphQL API (`src/lib/inngest/functions/monitor-producthunt.ts`)
- [x] Track product launches
- [x] Monitor product comments
- [ ] Track maker responses (future enhancement)
- [ ] Integrate with PH launch calendar (future enhancement)

#### Review Platform Improvements ✅
- [x] Google Reviews via Apify
- [x] Trustpilot via Apify
- [x] App Store via Apify
- [x] Play Store via Apify
- [x] G2, Yelp, Amazon Reviews via Apify
- [x] YouTube comments via Apify
- [ ] Aggregate review scores across platforms (future enhancement)
- [ ] Track review response rates (future enhancement)

---

## Phase 4: Growth & Monetization

*Turn features into revenue.*

### 4.1 Pricing Optimization

#### Tier Structure
- [ ] **Free:** 1 monitor, Reddit only, 3 visible results, 7-day history
- [ ] **Day Pass ($10):** 24hr Pro access, one-time purchase
- [ ] **Pro ($29/mo):** 10 monitors, all 9 platforms, full AI, 90-day history
- [ ] **Team ($79/mo):** Unlimited monitors, Slack/Discord, 5 seats, 1-year history
- [ ] **Enterprise (Custom):** API access, white-label, SSO, dedicated support

#### Pricing Page Updates
- [ ] Redesign pricing page with comparison table
- [ ] Add feature breakdown per tier
- [ ] Add "Most Popular" badge on Pro
- [ ] Add annual discount (2 months free)
- [ ] Add Day Pass prominent placement
- [ ] Add FAQ section
- [ ] Add testimonials (when available)

### 4.2 Conversion Optimization

#### Free-to-Paid Triggers
- [ ] "You've hit your monitor limit" upgrade prompt
- [ ] "Unlock 47 more results" blur overlay
- [ ] "AI analysis available on Pro" teaser
- [ ] "This result expires in 2 days" urgency
- [ ] "X users upgraded this week" social proof
- [ ] Day 3 email: "Unlock full potential"
- [ ] Day 7 email: "Your trial results expire soon"

#### Upgrade Modals
- [ ] Contextual upgrade modals (not generic)
- [ ] Show specific feature being unlocked
- [ ] Show value: "Users find X leads/month on average"
- [ ] One-click upgrade button
- [ ] Day pass as secondary CTA

### 4.3 Retention Features

#### Engagement Hooks
- [ ] Weekly insights email (even if no new mentions)
- [ ] "Your brand health score" monthly report
- [ ] "Trending in your industry" weekly digest
- [ ] Achievement badges (first monitor, first 100 results, etc.)
- [ ] Streak tracking (days with mentions)

#### Churn Prevention ✅ CORE COMPLETE
- [x] Track user activity (`lastActiveAt` column in users table)
- [x] Detect inactive users (7+ days without dashboard visit)
- [x] Daily cron job scans for inactive paying users (10 AM UTC)
- [x] Send re-engagement email with highlights:
  - Number of new mentions since last visit
  - Active monitors count
  - Top mention highlight with direct link
  - Personalized message based on days inactive
- [x] Cooldown to prevent email fatigue (30 days between re-engagement emails)
- [ ] Offer pause subscription option (vs cancel) - future enhancement
- [ ] Exit survey on cancellation - future enhancement
- [ ] Win-back campaign for churned users - future enhancement

**Implementation Details:**
- Schema: `lastActiveAt`, `reengagementEmailSentAt` columns in users table
- Inngest: `detectInactiveUsers` cron + `sendReengagement` event handler
- Email: `sendReengagementEmail()` in `src/lib/email.ts`
- Activity tracking: Dashboard layout updates `lastActiveAt` on every visit

---

## Phase 5: Marketing & Launch (GummySearch Refugees)

*Capture the 10,000 GummySearch customers looking for alternatives.*

### 5.1 GummySearch Migration Campaign ✅

#### Landing Page
- [x] Create `/gummysearch` landing page
- [x] Headline: "GummySearch is closing. Kaulby is here."
- [x] Feature comparison table (21 features compared)
- [x] Benefits grid (16 platforms, AI features, resilience, active development)
- [x] Special offer for GummySearch users (GUMMY30 code - 30% off first 3 months)
- [x] Migration steps guide (3-step process)
- [x] Export CTA section
- [ ] Import tool (if they provide export) - pending GummySearch data format
- [ ] Testimonials from converted users - collect post-launch

#### Implementation Details
- Page: `src/app/gummysearch/page.tsx`
- Static generation with hourly revalidation
- Includes promo code tracking via `?ref=gummysearch` signup link

#### Content Marketing
- [ ] Blog post: "GummySearch Alternative: What We Learned"
- [ ] Blog post: "Reddit Monitoring in 2026: A Complete Guide"
- [ ] Reddit posts in r/Entrepreneur, r/SaaS, r/startups
- [ ] Hacker News "Show HN" post
- [ ] Product Hunt launch
- [ ] Twitter/X thread about the migration

#### Outreach
- [ ] Identify GummySearch power users on Twitter
- [ ] Direct outreach with migration offer
- [ ] Partner with indie hacker communities
- [ ] Sponsor relevant newsletters

### 5.2 SEO Strategy ✅ PARTIALLY COMPLETE

#### Programmatic Pages
- [x] Subreddit pages with SEO metadata (`/subreddits`, `/subreddits/[slug]`)
  - 140+ subreddits with categories (business, marketing, tech, finance, etc.)
  - Dynamic pages with growth stats, structured data
- [x] Competitor comparison pages (`/alternatives`, `/alternatives/[competitor]`)
  - GummySearch, Brand24, Mention, Hootsuite, etc.
  - Feature comparison tables, SEO-optimized
- [ ] 10,000 subreddit pages (scale up from current 140)
- [ ] 1,000 "how to monitor X on Reddit" pages
- [ ] Industry-specific landing pages

#### Content Strategy
- [ ] Weekly blog posts on Reddit marketing
- [ ] Case studies from users
- [ ] Industry benchmark reports
- [ ] Free tools (subreddit analyzer, etc.)

---

## Success Metrics

### Phase 1 Targets (Month 1-2)
- [ ] 500 GummySearch refugees signed up
- [ ] 100 paying customers
- [ ] $2,900 MRR

### Phase 2 Targets (Month 3-4)
- [ ] 2,000 total users
- [ ] 500 paying customers
- [ ] $14,500 MRR

### Phase 3 Targets (Month 5-6)
- [ ] 5,000 total users
- [ ] 1,200 paying customers
- [ ] $35,000 MRR (GummySearch parity!)

### Long-term Targets (Year 1)
- [ ] 20,000 total users
- [ ] 5,000 paying customers
- [ ] $100,000+ MRR

---

## Quick Reference: Database Migrations

```sql
-- Phase 1 Migrations

-- 1.1 Conversation Categories
ALTER TABLE results ADD COLUMN category VARCHAR(50);
ALTER TABLE results ADD COLUMN category_confidence DECIMAL;
ALTER TABLE results ADD COLUMN category_keywords_matched TEXT[];
ALTER TABLE results ADD COLUMN engagement_score INTEGER;
ALTER TABLE results ADD COLUMN last_sent_in_digest_at TIMESTAMPTZ;

-- 1.2 Audiences
CREATE TABLE audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audience_monitors (
  audience_id UUID REFERENCES audiences(id) ON DELETE CASCADE,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (audience_id, monitor_id)
);

CREATE INDEX idx_audiences_user_id ON audiences(user_id);
CREATE INDEX idx_audience_monitors_monitor ON audience_monitors(monitor_id);

-- 1.7 Day Pass
ALTER TABLE users ADD COLUMN day_pass_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN day_pass_purchase_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_day_pass_purchased_at TIMESTAMPTZ;

-- Phase 2 Migrations

-- 2.1 Cross-Platform Topics
CREATE TABLE cross_platform_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  topic VARCHAR(200) NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  platforms TEXT[] NOT NULL,
  total_mentions INTEGER DEFAULT 0,
  average_sentiment DECIMAL,
  is_trending BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Competitors
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Community Stats
CREATE TABLE community_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,
  identifier VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  description TEXT,
  member_count INTEGER,
  subscriber_growth_daily DECIMAL,
  subscriber_growth_weekly DECIMAL,
  subscriber_growth_monthly DECIMAL,
  posts_per_day DECIMAL,
  comments_per_day DECIMAL,
  engagement_score DECIMAL,
  top_keywords TEXT[],
  related_communities TEXT[],
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, identifier)
);

CREATE INDEX idx_community_stats_platform ON community_stats(platform);
CREATE INDEX idx_community_stats_engagement ON community_stats(engagement_score DESC);
```

---

## Quick Reference: New Files to Create

```
src/
├── lib/
│   ├── search-parser.ts           # Boolean search parsing
│   ├── slack.ts                   # Slack webhook formatting
│   ├── discord.ts                 # Discord webhook formatting
│   ├── cross-platform.ts          # Cross-platform correlation
│   └── community-stats.ts         # Community scraping/caching
├── app/
│   ├── (dashboard)/dashboard/
│   │   ├── audiences/
│   │   │   ├── page.tsx           # Audience list
│   │   │   ├── new/page.tsx       # Create audience
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Audience detail
│   │   │       └── edit/page.tsx  # Edit audience
│   │   ├── insights/page.tsx      # Cross-platform insights
│   │   ├── competitive/page.tsx   # Competitive dashboard
│   │   └── analytics/page.tsx     # Historical analytics
│   ├── (marketing)/
│   │   ├── gummysearch/page.tsx   # Migration landing page
│   │   └── communities/
│   │       └── [platform]/
│   │           └── [identifier]/page.tsx  # SEO pages
│   └── api/
│       ├── audiences/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── monitors/route.ts
│       ├── stripe/
│       │   └── day-pass/route.ts
│       └── export/route.ts
└── components/
    ├── dashboard/
    │   ├── category-filter.tsx
    │   ├── audience-selector.tsx
    │   ├── trend-chart.tsx
    │   ├── sentiment-chart.tsx
    │   └── cross-platform-widget.tsx
    └── marketing/
        └── competitor-table.tsx
```

---

*Total items: 200+ specific tasks across 5 phases*
*Estimated timeline: 6 months to $35k MRR*
*Key differentiator: 9 platforms vs competitors' 1-3*
