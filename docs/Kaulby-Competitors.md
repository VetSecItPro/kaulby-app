# Kaulby Competitive Intelligence Report

## Executive Summary

This report analyzes Reddit monitoring tools and social listening platforms to identify best practices, features, and implementation strategies that Kaulby can adopt to capture GummySearch refugees and establish market leadership.

**Key Competitors Analyzed:**
- GummySearch (shutting down - $35k MRR, 135k users, 10k paying customers)
- RedReach ($19-29/mo - AI-powered lead generation)
- Syften ($19.95-99.95/mo - Multi-platform monitoring)
- F5Bot (Free - Simple keyword alerts)
- Brand24 ($149-999/mo - Enterprise social listening)
- Mention ($599/mo - Comprehensive media monitoring)
- Notifier ($49-499/mo - Real-time alerts)

---

## Part 1: GummySearch Deep Dive

### Why GummySearch Succeeded

GummySearch reached $35k MRR with 10,000 paying customers by solving a real problem: **making Reddit research fast and organized**.

#### Core Value Proposition
> "Everything shown is publicly available on Reddit; the value is making it faster and easier to access and analyze."

For founders whose time is worth $100+/hour, saving 5 hours monthly justified $29-59/month.

### GummySearch's Methodology

#### 1. Audience-First Approach (NOT Topic-First)
Instead of monitoring individual keywords, GummySearch grouped subreddits into "Audiences":

```
Traditional Approach:        GummySearch Approach:
├── Monitor "quickbooks"     ├── Audience: "Small Business Owners"
├── Monitor "accounting"     │   ├── r/smallbusiness
└── Monitor "bookkeeping"    │   ├── r/Accounting
                             │   ├── r/Bookkeeping
                             │   ├── r/QuickBooks
                             │   └── r/Entrepreneur
                             └── Monitor ALL conversations in audience
```

**Why this matters:** Users discover conversations they wouldn't have found with keyword-only monitoring.

#### 2. AI-Powered Conversation Categorization

GummySearch automatically categorized every post into:

| Category | Description | Keywords Used |
|----------|-------------|---------------|
| **Pain & Anger** | Frustrations and complaints | "frustrated", "annoyed", "hate", "worst" |
| **Solution Requests** | People looking for tools | "looking for", "need a tool", "recommend" |
| **Advice Requests** | Questions seeking guidance | "how do I", "what's the best way" |
| **Money Talk** | Pricing/budget discussions | "worth paying", "budget", "pricing" |
| **Hot Discussions** | High engagement posts | (by engagement metrics) |

**"No Keyword" Mode (Beta):** AI detected pain points without any keyword matching - just semantic understanding.

#### 3. Subreddit Discovery Algorithm

GummySearch built a database of 130,000+ subreddits with:
- Member counts and growth rates (daily/weekly/monthly/yearly)
- Engagement metrics
- Related subreddit recommendations
- Programmatic SEO pages for each subreddit

#### 4. Email Digest System

```
Daily Digest Structure:
├── New mentions since last digest (deduplicated)
├── Keyword highlighted in title/body
├── Relevance/efficiency score
├── Direct links to Reddit
└── "View in GummySearch" deep links
```

Features:
- Daily/weekly/monthly frequency options
- Instant alerts for brand monitoring
- Slack/Discord integration via webhooks
- Efficiency tracking (signal-to-noise ratio)

### GummySearch Pricing That Worked

| Plan | Price | Key Differentiators |
|------|-------|---------------------|
| Free | $0 | 50 keyword searches |
| Starter | $29/mo | Unlimited searches, tracking, AI insights |
| Pro | $59/mo | Content reports, Slack/Discord, 5k AI minutes |
| Mega | $199/mo | Shareable reports, multi-user, enterprise |
| **Day Pass** | $10 one-time | 24-hour full access |

**Day Pass Innovation:** Smart response to subscription fatigue - users who only need occasional research.

### Why GummySearch Failed (Platform Risk)

- Reddit's 2023 API changes required commercial licenses
- Commercial API pricing starts at thousands/month
- 5+ weeks of silence from Reddit during negotiations
- Unable to reach agreement despite being profitable

**Lesson for Kaulby:** Never depend on a single platform. Diversify data sources.

---

## Part 2: Competitor Feature Matrix

### Data Collection Comparison

| Tool | Method | Frequency | Historical Data |
|------|--------|-----------|-----------------|
| GummySearch | Reddit API | Real-time | Limited (Pushshift died) |
| RedReach | AI + Extension | 24/7 | Dashboard archive |
| Syften | APIs + Crawlers | <1 minute | 60 days |
| F5Bot | Scraping (Aho-Corasick) | Real-time | None |
| Brand24 | APIs + Crawlers | Plan-dependent | Yes |
| Notifier | Independent | ~1 minute | 30 days |
| **Kaulby** | Reddit JSON API | 15-min cron | Database |

### Feature Comparison

| Feature | GummySearch | RedReach | Syften | Brand24 | Kaulby (Current) |
|---------|-------------|----------|--------|---------|------------------|
| Audience grouping | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI categorization | ✅ | ✅ | PRO | ✅ | ✅ (sentiment) |
| Pain point detection | ✅ | ✅ | ❌ | ✅ | ✅ |
| Subreddit discovery | ✅ (130k DB) | AI-based | ❌ | ❌ | ✅ (AI hybrid) |
| Boolean search | ✅ | AI | ✅ | ✅ | ❌ |
| Email digests | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slack/Discord | ✅ | ❌ | PRO | ✅ | ❌ |
| Day pass | ✅ | ✅ | ❌ | ❌ | ❌ |
| Multi-platform | ❌ | ❌ | ✅ | ✅ | ✅ (9 platforms) |

---

## Part 3: Platform-Specific Best Practices

### Reddit Monitoring

**Current Kaulby Approach:**
- Uses Reddit JSON API (`/r/{subreddit}/new.json`)
- 15-minute cron job
- AI-powered subreddit discovery (NEW)

**Improvements Needed:**

1. **Streaming instead of polling:**
   ```python
   # PRAW streaming (near real-time)
   for comment in reddit.subreddit("all").stream.comments():
       process(comment)
   ```

2. **Rate limit handling:**
   - Monitor `X-Ratelimit-Remaining` header
   - Implement exponential backoff
   - Cache aggressively (5-minute minimum)

3. **Compliance:**
   - User-Agent: `Kaulby/1.0 (by /u/kaulby_app)`
   - Respect rate limits (100 QPM authenticated)
   - Delete data when users delete content

### Hacker News Monitoring

**Best API: Algolia HN Search**
```
Base URL: https://hn.algolia.com/api/v1/

Endpoints:
- /search?query=foo&tags=story     # Stories matching "foo"
- /search_by_date?query=bar        # Recent matches
- /search?tags=comment&query=baz   # Comments only
```

**Advantages over official Firebase API:**
- Full-text search
- Date filtering
- No rate limits mentioned
- Returns relevance scores

### Product Hunt Monitoring

**Official GraphQL API:**
```graphql
query {
  posts(first: 10, order: VOTES) {
    edges {
      node {
        name
        tagline
        votesCount
        comments { totalCount }
      }
    }
  }
}
```

**Note:** Commercial use requires explicit permission from Product Hunt.

### Google Reviews Monitoring

**Two Approaches:**

1. **Official Google Business Profile API** (Compliant)
   - Requires GBP API access approval
   - Daily request limits
   - Only for your own business

2. **Apify Scraper** (Third-party)
   - $0.60 per 1,000 reviews
   - Extracts competitor reviews
   - Includes owner responses

**Kaulby should use Apify** for flexibility and competitor monitoring.

### Trustpilot Monitoring

**Official Business Units API:**
```
GET /v1/business-units/{businessUnitId}/reviews
```

- Public endpoint: Basic review data
- Private endpoint: Includes email/order ID (limited)

### App Store Reviews

**Apple App Store Connect API:**
- List all customer reviews
- Post replies programmatically
- Requires JWT authentication

**Google Play Developer API:**
- GET: 200 requests/hour
- POST: 2,000 requests/day
- Only returns reviews from last week

---

## Part 4: Action Items for Kaulby

### Implementation Status (Updated January 2026)

| Feature | Status | Notes |
|---------|--------|-------|
| Audience System | ✅ 100% | Schema, UI at `/dashboard/audiences`, APIs, stats |
| Conversation Categories | ✅ 100% | AI categorization in `conversation-category.ts` |
| Boolean Search | ✅ 100% | Full parser in `search-parser.ts` |
| Day Pass | ✅ 100% | $10/24h via Polar in `day-pass.ts` |
| Slack/Discord Webhooks | ✅ 100% | Platform formatting in `webhooks.ts` |
| Cross-Platform Insights | ✅ 100% | `insights-view.tsx` with topic clustering |
| Historical Trend Charts | ✅ 100% | `analytics-charts.tsx` with recharts |
| Share of Voice | ✅ 100% | `share-of-voice.tsx` component |
| AI Discovery Mode | ✅ 100% | `ai_discovery` monitor type in schema |
| Subreddit SEO Pages | ✅ 100% | Dynamic ISR pages for 100+ subreddits with real stats |
| Community Stats Database | ✅ 100% | Weekly Inngest job populates `communityGrowth` table |

---

### Priority 1: Capture GummySearch Refugees (Immediate)

#### 1.1 ~~Implement Audience System~~ ✅ COMPLETE
**Status:** Fully implemented at `/dashboard/audiences`
- Schema: `audiences`, `audienceMonitors` tables
- UI: `audience-form.tsx`, `audience-card.tsx`, `audiences-list.tsx`
- APIs: Full CRUD at `/api/audiences`

#### 1.2 ~~Add Conversation Categories~~ ✅ COMPLETE
**Status:** Fully implemented in `src/lib/ai/analyzers/conversation-category.ts`
- Categories: `pain_point`, `solution_request`, `advice_request`, `money_talk`, `hot_discussion`
- AI-powered with confidence scores
- Integrated into result cards and filtering

#### 1.3 ~~Boolean Search Operators~~ ✅ COMPLETE
**Status:** Fully implemented in `src/lib/search-parser.ts`
- Supports: `title:`, `body:`, `author:`, `subreddit:`, `NOT`, `OR`, `AND`, `"exact phrase"`
- Includes query validation and explanation generation
- UI help tooltip in `search-help-tooltip.tsx`

#### 1.4 ~~Day Pass Pricing Option~~ ✅ COMPLETE
**Status:** Fully implemented via Polar
- `src/lib/day-pass.ts` - Activation and status checking
- `src/components/day-pass-card.tsx` - Purchase UI
- Polar webhook integration for payment processing

### Priority 2: Competitive Parity (Short-term)

#### 2.1 ~~Slack/Discord Integration~~ ✅ COMPLETE
**Status:** Fully implemented
- `src/lib/notifications/webhooks.ts` - Platform-specific formatting
- `src/lib/integrations/slack.ts` and `discord.ts` - Native integrations
- Block Kit for Slack, Embeds for Discord

#### 2.2 Subreddit Database & Discovery Pages ⚠️ PARTIALLY COMPLETE
**Status:** 10% complete - needs dynamic generation
- Current: ~10 hardcoded subreddits in `/subreddits/[slug]/page.tsx`
- Target: 130k+ dynamically generated pages
- **TODO:** Implement subreddit scraping/caching system
- **TODO:** Add growth stats tracking (daily/weekly/monthly)

#### 2.3 ~~Historical Data & Trends~~ ✅ COMPLETE
**Status:** Fully implemented in `src/components/dashboard/analytics-charts.tsx`
- Volume over time (AreaChart)
- Sentiment over time (stacked area)
- Category breakdown (PieChart)
- Platform breakdown (BarChart)

### Priority 3: Differentiation (Medium-term)

#### 3.1 ~~Multi-Platform Correlation~~ ✅ COMPLETE
**Status:** Fully implemented in `src/components/dashboard/insights-view.tsx`
- TopicCluster interface with platforms array
- PlatformCorrelation tracking shared topics
- Visual correlation display in Insights page

#### 3.2 ~~AI-Powered "No Keyword" Mode~~ ✅ COMPLETE
**Status:** Fully implemented
- Schema: `monitorType` enum with `ai_discovery` option
- Schema: `discoveryPrompt` field for natural language descriptions
- AI categorization finds pain points semantically

#### 3.3 ~~Competitive Intelligence Dashboard~~ ✅ COMPLETE
**Status:** Fully implemented in `src/components/dashboard/share-of-voice.tsx`
- Side-by-side mention counts with visual bar
- Sentiment comparison per brand
- Share of voice calculation with trends
- API: `/api/analytics/share-of-voice`

### Priority 4: Platform Resilience (Long-term)

#### 4.1 ~~Reduce Reddit Dependency~~ ✅ COMPLETE
**Status:** Fully implemented
1. ✅ **16 platforms** - Reddit, HN, PH, Dev.to, Google Reviews, Trustpilot, App Store, Play Store, Quora, YouTube, G2, Yelp, Amazon Reviews, Indie Hackers, GitHub, Hashnode
2. ✅ **Aggressive caching** - Upstash Redis + in-memory fallback in `cache.ts`
3. ✅ **Multiple access methods** - Apify scrapers as primary for most platforms

#### 4.2 Build Proprietary Data Assets ⚠️ PARTIALLY COMPLETE
**Status:** Schema exists, needs population mechanism
- ✅ Schema: `communityGrowth` table in `schema.ts`
- ⚠️ **TODO:** Implement scheduled scraping to populate community stats
- ⚠️ **TODO:** Build trending communities detection

---

## Part 5: Implementation Plan

### ✅ Phase 1: GummySearch Migration - COMPLETE

| Task | Status |
|------|--------|
| Conversation categories | ✅ Done |
| Email digest improvements | ✅ Done |
| Slack webhook support | ✅ Done |
| Discord webhook support | ✅ Done |
| Day pass pricing | ✅ Done |

### ✅ Phase 2: Feature Parity - COMPLETE

| Task | Status |
|------|--------|
| Audience system | ✅ Done |
| Boolean search operators | ✅ Done |
| Historical trend charts | ✅ Done |
| Subreddit stats pages | ⚠️ 10% (hardcoded only) |

### ✅ Phase 3: Differentiation - COMPLETE

| Task | Status |
|------|--------|
| Cross-platform insights | ✅ Done |
| No-keyword AI mode | ✅ Done |
| Competitive dashboard | ✅ Done |
| Programmatic SEO pages | ⚠️ TODO |

### Phase 4: Resilience - IN PROGRESS

| Task | Status |
|------|--------|
| Multi-platform support (16) | ✅ Done |
| Apify fallback integration | ✅ Done |
| Community stats database | ✅ Done |
| Data export for users | ✅ Done |

---

## Remaining Work (January 2026)

### ✅ ALL COMPETITOR FEATURES COMPLETE

All features from competitive analysis have been implemented:

1. **Dynamic Subreddit Pages** ✅ COMPLETE
   - `/subreddits/[slug]/page.tsx` - ISR pages with 24h revalidation
   - `/subreddits/page.tsx` - Index page with categories
   - 100+ subreddits pre-generated via `generateStaticParams`
   - Real stats from `communityGrowth` table with live API fallback
   - Full SEO: metadata, structured data, sitemap integration

2. **Community Stats Population** ✅ COMPLETE
   - `src/lib/inngest/functions/community-stats.ts`
   - `collectCommunityStats` - Weekly cron job (Sunday 3 AM UTC)
   - `fetchSubredditStats` - On-demand stats for new subreddits
   - Collects: member count, posts/day, engagement rate
   - 100+ priority subreddits tracked

### Future Enhancements (Post-Launch)
- Expand to 1000+ subreddits based on user demand
- Add growth trend charts to subreddit pages
- Community comparison tool

---

## Part 6: Technical Specifications

### New Database Schema Additions

```sql
-- Audiences (group monitors together)
CREATE TABLE audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audience-Monitor relationship
CREATE TABLE audience_monitors (
  audience_id UUID REFERENCES audiences(id) ON DELETE CASCADE,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  PRIMARY KEY (audience_id, monitor_id)
);

-- Community statistics cache
CREATE TABLE community_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,
  identifier VARCHAR(100) NOT NULL, -- e.g., subreddit name
  display_name VARCHAR(200),
  member_count INTEGER,
  daily_growth DECIMAL,
  weekly_growth DECIMAL,
  monthly_growth DECIMAL,
  engagement_score DECIMAL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, identifier)
);

-- Enhanced result categorization
ALTER TABLE results ADD COLUMN category VARCHAR(50);
ALTER TABLE results ADD COLUMN category_confidence DECIMAL;
-- Categories: pain_point, solution_request, advice_request, money_talk, hot_discussion
```

### New AI Prompts

```typescript
// Conversation categorization prompt
export const CATEGORIZE_CONVERSATION_PROMPT = `
Analyze this social media post and categorize it:

Post Title: {title}
Post Content: {content}
Platform: {platform}

Categories:
1. PAIN_POINT - User expressing frustration, complaint, or problem
2. SOLUTION_REQUEST - User looking for a tool, service, or product
3. ADVICE_REQUEST - User asking for guidance or recommendations
4. MONEY_TALK - Discussion about pricing, budgets, or ROI
5. HOT_DISCUSSION - High engagement post (use only if engagement > threshold)
6. GENERAL - None of the above

Return JSON:
{
  "category": "PAIN_POINT" | "SOLUTION_REQUEST" | "ADVICE_REQUEST" | "MONEY_TALK" | "GENERAL",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}
`;
```

### Webhook Payload Formats

```typescript
// Slack webhook format
interface SlackWebhookPayload {
  text: string;
  attachments: Array<{
    color: string; // sentiment-based
    title: string;
    title_link: string;
    text: string;
    fields: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
    footer: string;
    ts: number;
  }>;
}

// Discord webhook format
interface DiscordWebhookPayload {
  content: string;
  embeds: Array<{
    title: string;
    url: string;
    description: string;
    color: number; // decimal color
    fields: Array<{
      name: string;
      value: string;
      inline: boolean;
    }>;
    footer: { text: string };
    timestamp: string; // ISO 8601
  }>;
}
```

---

## Part 7: Competitive Positioning

### Kaulby's Unique Advantages

| Advantage | vs GummySearch | vs Brand24 | vs F5Bot |
|-----------|----------------|------------|----------|
| 9 platforms | Reddit only | Multi but $149+ | Reddit/HN only |
| AI analysis included | Extra cost | Extra cost | None |
| Affordable | $29 Starter | $149 minimum | Free but limited |
| Not dependent on one API | Reddit killed them | Enterprise pricing | Scraping risk |

### Target Customer Segments

1. **GummySearch Refugees** (Immediate)
   - Pain: Lost their research tool
   - Solution: Familiar features at similar price
   - Message: "GummySearch features + 9 platforms"

2. **Bootstrapped Founders** (Primary)
   - Pain: Need market research, limited budget
   - Solution: Affordable AI-powered insights
   - Message: "Find customers, not keywords"

3. **Marketing Teams** (Growth)
   - Pain: Manual brand monitoring
   - Solution: Automated cross-platform tracking
   - Message: "All your mentions, one dashboard"

### Pricing Recommendation

| Plan | Price | Positioning |
|------|-------|-------------|
| Free | $0 | 1 monitor, Reddit only, 3 results visible |
| **Day Pass** | $10 | 24-hour full access (NEW) |
| Pro | $29/mo | 10 monitors, all platforms, AI analysis |
| Team | $79/mo | Unlimited, Slack/Discord, team seats |
| Enterprise | Custom | API access, white-label reports |

---

## Appendix A: Competitor URLs

- GummySearch: https://gummysearch.com (shutting down Dec 2026)
- RedReach: https://redreach.ai
- Syften: https://syften.com
- F5Bot: https://f5bot.com
- Brand24: https://brand24.com
- Mention: https://mention.com
- Notifier: https://notifier.so

## Appendix B: API Documentation

- Reddit API: https://www.reddit.com/dev/api
- HN Algolia: https://hn.algolia.com/api
- Product Hunt: https://api.producthunt.com/v2/docs
- Google Business Profile: https://developers.google.com/my-business
- Trustpilot: https://developers.trustpilot.com
- App Store Connect: https://developer.apple.com/documentation/appstoreconnectapi
- Google Play Developer: https://developers.google.com/android-publisher

## Appendix C: Research Sources

- GummySearch Final Chapter: https://gummysearch.com/final-chapter/
- GummySearch Startup Obituary: https://startupobituary.com/p/gummysearch
- Reddit API Changes Impact: https://newsletter.failory.com/p/when-reddit-pulls-over
- F5Bot Architecture: https://intoli.com/blog/f5bot/
- Social Listening Tools Comparison: https://www.meltwater.com/en/blog/top-social-media-monitoring-tools

---

*Report generated: January 2026*
*For Kaulby internal use*
