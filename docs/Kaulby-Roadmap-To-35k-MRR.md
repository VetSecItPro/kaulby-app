# Kaulby Roadmap to $35k MRR

> **Goal:** Match GummySearch's peak ($35k MRR, 10k paying customers) then exceed it with multi-platform advantage.

---

## Phase 1: GummySearch Feature Parity (Capture Refugees)

*These features made GummySearch worth $29-59/month to 10,000 customers.*

### 1.1 Conversation Categorization System

**Why:** GummySearch's killer feature - automatically sort conversations into actionable categories.

#### Database Changes
- [ ] Add `category` column to results table (enum: pain_point, solution_request, advice_request, money_talk, hot_discussion, general)
- [ ] Add `category_confidence` column to results table (decimal 0-1)
- [ ] Add `category_keywords_matched` column to results table (text array)
- [ ] Add `engagement_score` column to results table (for hot_discussion detection)
- [ ] Create migration file for all above

#### AI Prompt Updates
- [ ] Create `CATEGORIZE_CONVERSATION_PROMPT` in prompts.ts
- [ ] Define category detection keywords:
  - Pain & Anger: "frustrated", "annoyed", "hate", "worst", "terrible", "awful", "disappointed", "angry"
  - Solution Requests: "looking for", "need a tool", "recommend", "alternative to", "best app for", "any suggestions"
  - Advice Requests: "how do I", "what's the best way", "should I", "help me", "advice needed", "tips for"
  - Money Talk: "worth paying", "budget", "pricing", "cost", "expensive", "cheap", "ROI", "investment"
- [ ] Update `analyzeContent` function to include categorization
- [ ] Add category to comprehensive analysis output
- [ ] Store category in results table after analysis

#### UI Updates
- [ ] Add category filter chips on results page (Pain Points, Solution Requests, etc.)
- [ ] Add category badge/tag on each result card
- [ ] Color-code categories (red for pain, green for solutions, blue for advice, gold for money)
- [ ] Add category breakdown chart on dashboard
- [ ] Filter results by category in API endpoint
- [ ] Sort results by category option

#### Category-Specific Views
- [ ] Create "Pain Points" dedicated view - filtered results
- [ ] Create "Solution Requests" dedicated view - high-intent leads
- [ ] Create "Money Talk" dedicated view - pricing research
- [ ] Create "Hot Discussions" dedicated view - engagement-based

### 1.2 Audience System (Group Monitors)

**Why:** GummySearch's audience-first approach discovered conversations users wouldn't find with keywords alone.

#### Database Schema
- [ ] Create `audiences` table:
  ```
  id: UUID PK
  user_id: TEXT NOT NULL
  name: VARCHAR(100) NOT NULL
  description: TEXT
  color: VARCHAR(7) -- hex color for UI
  icon: VARCHAR(50) -- emoji or icon name
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
  ```
- [ ] Create `audience_monitors` junction table:
  ```
  audience_id: UUID FK -> audiences.id ON DELETE CASCADE
  monitor_id: UUID FK -> monitors.id ON DELETE CASCADE
  added_at: TIMESTAMPTZ
  PRIMARY KEY (audience_id, monitor_id)
  ```
- [ ] Add `audience_id` nullable FK to monitors table (for quick lookup)
- [ ] Create indexes for performance

#### API Endpoints
- [ ] `GET /api/audiences` - list user's audiences
- [ ] `POST /api/audiences` - create audience
- [ ] `GET /api/audiences/[id]` - get audience with monitors
- [ ] `PATCH /api/audiences/[id]` - update audience
- [ ] `DELETE /api/audiences/[id]` - delete audience (keeps monitors)
- [ ] `POST /api/audiences/[id]/monitors` - add monitor to audience
- [ ] `DELETE /api/audiences/[id]/monitors/[monitorId]` - remove monitor from audience
- [ ] `GET /api/audiences/[id]/results` - get all results from audience's monitors

#### UI Pages
- [ ] Create `/dashboard/audiences` - list all audiences
- [ ] Create `/dashboard/audiences/new` - create audience wizard
- [ ] Create `/dashboard/audiences/[id]` - audience detail view with all results
- [ ] Create `/dashboard/audiences/[id]/edit` - edit audience
- [ ] Add audience selector dropdown on monitors page
- [ ] Add "Add to Audience" button on monitor cards
- [ ] Add audience grouping view on main dashboard
- [ ] Add audience-level analytics (combined stats from all monitors)

#### Audience Features
- [ ] Aggregate results view across all monitors in audience
- [ ] Combined mention count for audience
- [ ] Audience-level sentiment average
- [ ] Audience-level category breakdown
- [ ] Quick-add related subreddits to audience (AI suggestions)

### 1.3 Boolean Search Operators

**Why:** Power users need precise control over keyword matching.

#### Search Parser
- [ ] Create `parseSearchQuery()` function in new file `src/lib/search-parser.ts`
- [ ] Support `title:keyword` - search only in titles
- [ ] Support `body:keyword` - search only in body/content
- [ ] Support `"exact phrase"` - match exact phrase
- [ ] Support `NOT term` - exclude results with term
- [ ] Support `OR` operator - match either term
- [ ] Support `AND` operator (default) - match both terms
- [ ] Support `author:username` - filter by author
- [ ] Support `subreddit:name` - filter by subreddit
- [ ] Support parentheses for grouping: `(A OR B) AND C`

#### Integration
- [ ] Update monitor keyword matching to use parser
- [ ] Update results search/filter to use parser
- [ ] Add search syntax help tooltip in UI
- [ ] Add example queries in placeholder text
- [ ] Validate search syntax on input
- [ ] Show parsed query preview (what will be matched)

#### UI
- [ ] Add "Advanced Search" toggle on results page
- [ ] Add search builder UI for non-technical users
- [ ] Add saved searches feature
- [ ] Add search history dropdown

### 1.4 Email Digest Improvements

**Why:** GummySearch's digests were highly rated - keyword highlighting, deduplication, efficiency scores.

#### Digest Content Enhancements
- [ ] Highlight matched keywords in title (bold/color)
- [ ] Highlight matched keywords in content snippet
- [ ] Add relevance/efficiency score to each result
- [ ] Deduplicate - don't send same result twice
- [ ] Track which results were sent in previous digests
- [ ] Add `last_sent_in_digest_at` column to results
- [ ] Show "X new mentions since last digest" count
- [ ] Group results by platform in digest
- [ ] Group results by category in digest
- [ ] Add sentiment indicator (emoji or color)

#### Digest Frequency Options
- [ ] Add "Instant" alert option (per-result, not batch)
- [ ] Add "Weekly" digest option
- [ ] Add "Monthly" digest option
- [ ] Add custom schedule (specific days/times)
- [ ] Add "Pause digests" toggle (keep tracking, stop emails)
- [ ] Store digest preferences per monitor AND per user (global default)

#### Digest UI Improvements
- [ ] Redesign email template with better formatting
- [ ] Add "View in Kaulby" deep links to each result
- [ ] Add "View on [Platform]" direct links
- [ ] Add unsubscribe link (per monitor)
- [ ] Add digest preferences link
- [ ] Mobile-responsive email template
- [ ] Dark mode email option

#### Tracking & Analytics
- [ ] Track email open rates
- [ ] Track link click rates
- [ ] Calculate "efficiency score" (clicks / total results)
- [ ] Show efficiency trends over time
- [ ] Suggest pruning low-efficiency keywords

### 1.5 Slack Integration

**Why:** GummySearch Pro users got Slack/Discord - critical for teams.

#### Slack Setup
- [ ] Add Slack webhook URL field to webhooks table (or webhook_type enum)
- [ ] Create Slack OAuth app (optional, for richer integration)
- [ ] Document how users get Slack incoming webhook URL
- [ ] Add Slack setup guide in dashboard

#### Slack Payload Format
- [ ] Format alerts as Slack attachments:
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
- [ ] Support Slack Block Kit for richer formatting
- [ ] Add action buttons (Mark as Read, View in Kaulby)

#### Slack Features
- [ ] Per-monitor Slack channel configuration
- [ ] Per-category Slack channel (pain points to #feedback, etc.)
- [ ] Slack notification preferences (all, high-priority only, daily summary)
- [ ] Test Slack webhook button

### 1.6 Discord Integration

**Why:** Many indie hackers and communities use Discord over Slack.

#### Discord Setup
- [ ] Add Discord webhook URL field to webhooks
- [ ] Document how users create Discord webhook
- [ ] Add Discord setup guide in dashboard

#### Discord Payload Format
- [ ] Format alerts as Discord embeds:
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
        {"name": "Sentiment", "value": "Negative", "inline": true}
      ],
      "footer": {"text": "Kaulby"},
      "timestamp": "[ISO 8601]"
    }]
  }
  ```
- [ ] Support multiple embeds for batch notifications
- [ ] Add Kaulby branding/avatar

#### Discord Features
- [ ] Per-monitor Discord channel configuration
- [ ] Test Discord webhook button
- [ ] Discord bot option (future - richer interaction)

### 1.7 Day Pass Pricing

**Why:** GummySearch's $10 day pass was genius - captures users who don't want subscriptions.

#### Stripe Setup
- [ ] Create "Day Pass" product in Stripe ($10 one-time)
- [ ] Create price ID for day pass
- [ ] Add `DAY_PASS_PRICE_ID` to environment variables

#### Database Changes
- [ ] Add `day_pass_expires_at` column to users table (TIMESTAMPTZ nullable)
- [ ] Add `day_pass_purchase_count` column to users table (track repeat buyers)
- [ ] Add `last_day_pass_purchased_at` column to users table

#### Access Control
- [ ] Update `getUserPlan()` to check day pass expiry
- [ ] Return "day_pass" plan type if active
- [ ] Day pass grants Pro-level access for 24 hours
- [ ] Show countdown timer in UI when day pass active
- [ ] Send reminder email 1 hour before expiry
- [ ] Send "Day pass expired" email with upgrade CTA

#### Checkout Flow
- [ ] Create `/api/stripe/day-pass` endpoint
- [ ] Create day pass checkout button on pricing page
- [ ] Create day pass purchase success page
- [ ] Add day pass option in upgrade modals
- [ ] Handle day pass webhook from Stripe

#### UI
- [ ] Show "Day Pass Active - X hours remaining" banner
- [ ] Add "Buy Day Pass" CTA for free users
- [ ] Add day pass to pricing page
- [ ] Show day pass history in settings

---

## Phase 2: Competitive Advantages (Exceed GummySearch)

*Features that make Kaulby BETTER than GummySearch ever was.*

### 2.1 Multi-Platform Correlation

**Why:** Kaulby has 9 platforms - GummySearch had 1. This is our moat.

#### Cross-Platform Detection
- [ ] Create `cross_platform_topics` table:
  ```
  id: UUID PK
  user_id: TEXT
  topic: VARCHAR(200) -- detected topic/theme
  first_seen_at: TIMESTAMPTZ
  platforms: TEXT[] -- which platforms mentioned it
  total_mentions: INTEGER
  average_sentiment: DECIMAL
  is_trending: BOOLEAN
  ```
- [ ] Create topic detection algorithm:
  - Extract key phrases from results
  - Group similar phrases across platforms
  - Calculate correlation score
- [ ] Detect when same topic trends on multiple platforms
- [ ] Alert user to cross-platform trends

#### Cross-Platform Dashboard
- [ ] Create `/dashboard/insights` page
- [ ] Show "Trending Across Platforms" widget
- [ ] Show platform comparison chart (mentions by platform)
- [ ] Show sentiment comparison by platform
- [ ] Show timing correlation (did Reddit mention before HN?)
- [ ] Show "Your brand on each platform" summary

#### Cross-Platform Reports
- [ ] Generate cross-platform weekly report
- [ ] Compare brand presence across platforms
- [ ] Identify platform-specific sentiment patterns
- [ ] Recommend which platforms to focus on

### 2.2 AI "No Keyword" Mode

**Why:** GummySearch's beta feature that found pain points semantically. We can ship it fully.

#### Semantic Analysis Pipeline
- [ ] Create new monitor type: "AI Discovery" (no keywords required)
- [ ] Add `monitor_type` column to monitors (keyword, ai_discovery, hybrid)
- [ ] Create AI prompt for semantic pain point detection:
  ```
  Analyze this post from r/[subreddit].
  The user is monitoring [industry/company].

  Does this post represent:
  1. A potential customer with a problem we can solve?
  2. Someone frustrated with a competitor?
  3. Someone asking for product recommendations?
  4. A discussion about pricing/budgets in this space?

  Return relevance score 0-100 and explanation.
  ```
- [ ] Process posts without keyword matching
- [ ] Filter by relevance threshold (configurable)
- [ ] Learn from user feedback (thumbs up/down on results)

#### AI Discovery UI
- [ ] Add "AI Discovery Mode" toggle on monitor creation
- [ ] Show relevance score on AI-discovered results
- [ ] Add "Why this was shown" explanation tooltip
- [ ] Add thumbs up/down feedback buttons
- [ ] Train model on feedback (future)

### 2.3 Competitive Intelligence Dashboard

**Why:** Track competitors alongside your brand - something GummySearch didn't focus on.

#### Competitor Tracking
- [ ] Add `competitors` table:
  ```
  id: UUID PK
  user_id: TEXT
  monitor_id: UUID FK -- parent monitor
  name: VARCHAR(100) -- competitor name
  keywords: TEXT[] -- competitor-specific keywords
  created_at: TIMESTAMPTZ
  ```
- [ ] Track competitor mentions separately
- [ ] Calculate share of voice (your mentions / total)
- [ ] Compare sentiment: you vs competitors
- [ ] Track competitor pain points (opportunities for you)

#### Competitive Dashboard UI
- [ ] Create `/dashboard/competitive` page
- [ ] Side-by-side mention counts chart
- [ ] Share of voice pie chart
- [ ] Sentiment comparison bar chart
- [ ] "Competitor Pain Points" feed (their frustrated users)
- [ ] "Competitive Wins" - positive mentions of you vs negative of them
- [ ] Trend lines over time

### 2.4 Historical Trends & Analytics

**Why:** GummySearch had limited history. We store everything - use it.

#### Trend Charts
- [ ] Create mention volume over time chart (line chart)
- [ ] Create sentiment trend chart
- [ ] Create category breakdown over time (stacked area)
- [ ] Create platform comparison over time
- [ ] Add date range selector (7d, 30d, 90d, 1y, all time)
- [ ] Add comparison to previous period

#### Analytics Dashboard
- [ ] Create `/dashboard/analytics` page
- [ ] Show total mentions (with trend indicator)
- [ ] Show average sentiment (with trend)
- [ ] Show most active platform
- [ ] Show most common category
- [ ] Show peak activity times (heatmap)
- [ ] Show top engaging posts
- [ ] Export analytics as PDF report

### 2.5 Subreddit/Community Database

**Why:** GummySearch had 130k subreddit pages for SEO. We can do this for all platforms.

#### Community Stats Table
- [ ] Create `community_stats` table:
  ```
  id: UUID PK
  platform: platform_enum
  identifier: VARCHAR(100) -- subreddit name, HN, etc.
  display_name: VARCHAR(200)
  description: TEXT
  member_count: INTEGER
  subscriber_growth_daily: DECIMAL
  subscriber_growth_weekly: DECIMAL
  subscriber_growth_monthly: DECIMAL
  posts_per_day: DECIMAL
  comments_per_day: DECIMAL
  engagement_score: DECIMAL
  top_keywords: TEXT[]
  related_communities: TEXT[]
  last_updated: TIMESTAMPTZ
  UNIQUE (platform, identifier)
  ```

#### Community Discovery
- [ ] Scrape subreddit stats periodically (weekly cron)
- [ ] Calculate growth rates
- [ ] Identify trending subreddits
- [ ] Find related subreddits algorithmically
- [ ] Suggest communities based on user's monitors

#### Programmatic SEO Pages
- [ ] Create `/communities/[platform]/[identifier]` route
- [ ] Generate SEO-optimized page for each community
- [ ] Include: description, stats, growth charts, top posts
- [ ] Add "Monitor this community" CTA
- [ ] Add related communities sidebar
- [ ] Create sitemap for all community pages
- [ ] Target: 10k pages initially, scale to 100k+

---

## Phase 3: Platform Resilience (Don't Die Like GummySearch)

*GummySearch died from platform dependency. We won't.*

### 3.1 Multi-Source Data Collection

#### Apify Fallback for Reddit
- [ ] Add `APIFY_API_KEY` to environment variables
- [ ] Create Apify Reddit scraper integration
- [ ] Implement fallback logic: try API first, fall back to Apify
- [ ] Track which source was used for each result
- [ ] Monitor API health and auto-switch if degraded

#### Rate Limit Management
- [ ] Parse `X-Ratelimit-Remaining` header from Reddit
- [ ] Implement request queue with rate limiting
- [ ] Implement exponential backoff on 429 errors
- [ ] Add circuit breaker pattern for failing APIs
- [ ] Dashboard showing API health status

#### Caching Layer
- [ ] Implement 5-minute cache for Reddit API responses
- [ ] Cache subreddit metadata for 1 hour
- [ ] Cache user profiles for 1 day
- [ ] Use Redis or in-memory cache
- [ ] Cache invalidation on relevant events

### 3.2 Data Portability

#### User Data Export
- [ ] Create `/api/user/export` endpoint
- [ ] Export all monitors as JSON
- [ ] Export all results as CSV
- [ ] Export all settings as JSON
- [ ] Include audience configurations
- [ ] Zip all exports together
- [ ] Send download link via email

#### Import from Competitors
- [ ] Create GummySearch import tool (if they provide export)
- [ ] Import audiences/keyword groups
- [ ] Import saved searches
- [ ] Import notification preferences

### 3.3 Platform-Specific Optimizations

#### Reddit Improvements
- [ ] Use official OAuth authentication
- [ ] Register proper User-Agent: `Kaulby/1.0 (by /u/kaulby_official)`
- [ ] Implement comment streaming (not just posts)
- [ ] Track post score changes over time
- [ ] Detect deleted/removed posts

#### Hacker News Improvements
- [ ] Switch to Algolia API for search
- [ ] Monitor comments, not just stories
- [ ] Track "Ask HN" and "Show HN" specifically
- [ ] Detect front page posts
- [ ] Calculate HN-specific engagement score

#### Product Hunt Improvements
- [ ] Use GraphQL API properly
- [ ] Track product launches in real-time
- [ ] Monitor product comments
- [ ] Track maker responses
- [ ] Integrate with PH launch calendar

#### Review Platform Improvements
- [ ] Google Reviews via Apify (competitor reviews)
- [ ] Trustpilot API integration
- [ ] App Store Connect API for iOS
- [ ] Google Play Developer API for Android
- [ ] Aggregate review scores across platforms
- [ ] Track review response rates

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

#### Churn Prevention
- [ ] Detect inactive users (no login in 7 days)
- [ ] Send re-engagement email with highlights
- [ ] Offer pause subscription option (vs cancel)
- [ ] Exit survey on cancellation
- [ ] Win-back campaign for churned users

---

## Phase 5: Marketing & Launch (GummySearch Refugees)

*Capture the 10,000 GummySearch customers looking for alternatives.*

### 5.1 GummySearch Migration Campaign

#### Landing Page
- [ ] Create `/gummysearch` landing page
- [ ] Headline: "GummySearch is closing. Kaulby is here."
- [ ] Feature comparison table
- [ ] Import tool (if possible)
- [ ] Special offer for GummySearch users (30% off first 3 months?)
- [ ] Testimonials from converted users

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

### 5.2 SEO Strategy

#### Programmatic Pages
- [ ] 10,000 subreddit pages (initial)
- [ ] 1,000 "how to monitor X on Reddit" pages
- [ ] 500 competitor comparison pages
- [ ] Industry-specific landing pages
- [ ] Tool comparison pages (vs Brand24, vs Mention, etc.)

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
