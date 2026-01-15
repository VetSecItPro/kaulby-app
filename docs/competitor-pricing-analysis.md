# Competitor Pricing Analysis & Product Strategy

Last Updated: January 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Market Landscape](#market-landscape)
3. [Competitor Pricing Breakdown](#competitor-pricing-breakdown)
4. [Competitor Tier Gating Analysis](#competitor-tier-gating-analysis)
5. [Kaulby Positioning](#kaulby-positioning)
6. [Platform Strategy](#platform-strategy)
7. [Notification Strategy](#notification-strategy)
8. [Refresh & Monitoring Strategy](#refresh--monitoring-strategy)
9. [Seat Management & Team Features](#seat-management--team-features)
10. [Pricing Recommendations](#pricing-recommendations)
11. [Implementation Roadmap](#implementation-roadmap)
12. [Sources](#sources)

---

## Executive Summary

Kaulby's pricing of **$29 Pro / $99 Enterprise** is competitively positioned in the market. With 9 platforms (Reddit, HN, Product Hunt, Google Reviews, Trustpilot, App Store, Play Store, Quora, Dev.to), we offer significantly more coverage than any competitor at our price point.

**Key Strategic Decisions (January 2026):**
- Pro tier: 2-hour refresh cycle, daily email digest, immediate Slack
- Enterprise tier: Real-time refresh, full notification control, up to 5 team seats
- Simple team implementation for MVP (owner + member roles only)
- No in-app notifications until mobile app development

---

## Market Landscape

### Key Finding: GummySearch Shutdown

**GummySearch shut down on November 30, 2025** due to inability to reach agreement with Reddit's Data API policies. This creates a significant opportunity for Kaulby to capture displaced users.

- GummySearch had 135,000+ users
- Previous pricing was $49-99/month
- Lifetime deal holders have access until December 2026

### Platform Sustainability Lesson

The GummySearch shutdown teaches us critical lessons about platform dependency:

1. **Never over-rely on a single platform** - Diversify coverage
2. **Use official APIs where available** - Even if limited
3. **Use reputable third-party services (Apify)** - Rather than direct scraping
4. **Maintain respectful rate limits** - Be a good citizen
5. **Store historical data** - Users retain value even if platform cuts access
6. **Have contingency plans** - For each platform's potential API changes

---

## Competitor Pricing Breakdown

### Reddit-Focused Tools

| Tool | Free Plan | Basic | Pro | Enterprise | Platforms |
|------|-----------|-------|-----|------------|-----------|
| **Redreach** | - | $19/mo | - | - | Reddit only |
| **Syften** | - | $15-20/mo | $100/mo | - | Reddit + 15 platforms |
| **KWatch.io** | Yes (limited) | $19/mo | $79/mo | $199/mo | Reddit, HN, LinkedIn, X |
| **Notifier** | Yes (5 results) | $49/mo | $199/mo | $499/mo | Reddit, X, YouTube, HN |
| **F5Bot** | Yes (basic) | - | - | - | Reddit, HN only |

### Enterprise Social Listening

| Tool | Starter | Team | Pro | Enterprise | Platforms |
|------|---------|------|-----|------------|-----------|
| **Brand24** | $99/mo | $179/mo | $239/mo | $399/mo | Multiple (no Reddit focus) |
| **Mention** | $41/mo | - | - | Custom | Multiple platforms |
| **Brandwatch** | - | - | - | $800+/mo | Enterprise-grade |

### Review Management Tools

| Tool | Basic | Pro | Premium | Notes |
|------|-------|-----|---------|-------|
| **ReviewFlowz** | $29/mo | $129/mo | $299/mo | Google, Yelp, Trustpilot |
| **Trustpilot Plus** | $259/mo | - | $1000+/mo | Official platform |
| **ReviewTrackers** | $119/location | - | Custom | Per-location pricing |

---

## Competitor Tier Gating Analysis

### How Competitors Structure Tiers

Research conducted January 2026 on how competitors differentiate their paid tiers:

#### KWatch.io Gating Strategy

| Feature | Free | Starter ($19) | Pro ($79) | Business ($199) |
|---------|------|---------------|-----------|-----------------|
| Keywords | 1 | 10 | 100 | 300 |
| Platforms | Reddit only | Reddit, HN | +LinkedIn | +X/Twitter |
| History | 7 days | 30 days | 90 days | 1 year |
| Alerts | Email only | +Slack | +Webhooks | +API |
| Refresh | Daily | 6 hours | 1 hour | Real-time |

**Key insight:** Gates primarily on keyword count per platform, not just platform access.

#### Notifier Gating Strategy

| Feature | Free | Pro ($49) | Business ($199) | Enterprise ($499) |
|---------|------|-----------|-----------------|-------------------|
| Searchers | 1 | 5 | 20 | 50 |
| Results/search | 5 | 50 | 200 | Unlimited |
| Platforms | Reddit | +HN, YouTube | +X/Twitter | All |
| Team members | 1 | 1 | 5 | Unlimited |

**Key insight:** Gates on results volume and team seats at higher tiers.

#### Syften Gating Strategy

| Feature | Basic ($15-20) | Pro ($100) |
|---------|----------------|------------|
| Filters | 3 | 20 |
| Results | 100/day | Unlimited |
| Platforms | All | All |
| History | 7 days | 90 days |

**Key insight:** Simpler two-tier model, gates on filter count and history.

### Kaulby Gating Strategy (Final)

Based on competitor analysis, our differentiation:

| Feature | Free | Pro ($29) | Enterprise ($99) |
|---------|------|-----------|------------------|
| **Monitors** | 1 | 10 | Unlimited |
| **Keywords/monitor** | 3 | 20 | 50 |
| **Platforms** | Reddit only | 8 platforms | All 9 platforms |
| **Results visible** | Last 3 | Unlimited | Unlimited |
| **History** | 3 days | 90 days | 1 year |
| **Refresh** | 24-hour delay | 2-hour cycle | Real-time |
| **AI Analysis** | First result only | Full | Full + Ask AI |
| **Slack** | ❌ | ✅ Immediate | ✅ Configurable |
| **Email** | ❌ | Daily digest | Immediate/Daily/Weekly |
| **Webhooks** | ❌ | ❌ | ✅ |
| **CSV Export** | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ✅ |
| **Team Seats** | 1 | 1 | Up to 5 (+$15/user) |

---

## Kaulby Positioning

### Current Kaulby Pricing (January 2026)

| Plan | Price | Monitors | Platforms | Key Features |
|------|-------|----------|-----------|--------------|
| **Free** | $0 | 1 | Reddit only | 3 keywords, 3 results, 3-day history |
| **Pro** | $29/mo | 10 | 8 platforms | Full AI, 90-day history, Slack/email |
| **Enterprise** | $99/mo | Unlimited | 9 platforms | API, webhooks, 1-year history, 5 seats |

### Platform Coverage (9 Total)

| Platform | Free | Pro | Enterprise | Notes |
|----------|------|-----|------------|-------|
| Reddit | ✅ | ✅ | ✅ | Core platform |
| Hacker News | ❌ | ✅ | ✅ | Tech community |
| Product Hunt | ❌ | ✅ | ✅ | Product launches |
| Google Reviews | ❌ | ✅ | ✅ | Business reviews |
| Trustpilot | ❌ | ✅ | ✅ | Consumer reviews |
| App Store | ❌ | ✅ | ✅ | iOS app reviews |
| Play Store | ❌ | ✅ | ✅ | Android app reviews |
| Quora | ❌ | ✅ | ✅ | Q&A discussions |
| Dev.to | ❌ | ❌ | ✅ | Enterprise exclusive |

### Unique Value Proposition

Kaulby is the **only tool offering**:
1. **9-platform monitoring** (most comprehensive in market)
2. **AI-powered sentiment analysis** and pain point detection
3. **Review + Community monitoring combined** (others do one or the other)
4. **Competitive pricing** at $29 for 8 platforms (competitors charge $79-199)

---

## Platform Strategy

### Platforms NOT Added to MVP (With Reasoning)

#### YouTube
- **Decision:** Not adding to MVP
- **Reasoning:**
  - Different use case (video content vs text discussions)
  - Low signal-to-noise ratio (lots of irrelevant content)
  - Complex to analyze (transcription, visual content)
  - Free official API available but requires different analysis approach
- **Future consideration:** Add if customers explicitly request it

#### LinkedIn
- **Decision:** Not adding
- **Reasoning:**
  - Most aggressive anti-scraping of any platform
  - High legal risk (LinkedIn vs hiQ Labs case)
  - Account bans common
  - Would require users to provide their own cookies
- **Recommendation:** Avoid entirely due to platform risk

#### X/Twitter
- **Decision:** Not adding
- **Reasoning:**
  - API pricing is prohibitive ($100+/month for basic access)
  - Scraping is risky and unreliable
  - Platform instability under current ownership
- **Future consideration:** Only if API pricing becomes reasonable

#### Indie Hackers
- **Decision:** Not adding to MVP
- **Reasoning:**
  - Good fit for target audience
  - Apify scrapers available
  - Lower priority than current 9 platforms
- **Future consideration:** Add post-launch if demand exists

### Platform Implementation Details

| Platform | Data Source | Actor/API | Refresh Frequency |
|----------|-------------|-----------|-------------------|
| Reddit | Apify | - | Every 30 min |
| Hacker News | Official API | Free | Every 30 min |
| Product Hunt | Apify | - | Every 2 hours |
| Google Reviews | Apify | compass/google-maps-reviews-scraper | Every 6 hours |
| Trustpilot | Apify | epctex/trustpilot-scraper | Every 4 hours |
| App Store | Apify | alexey/app-store-scraper | Every 6 hours |
| Play Store | Apify | epctex/google-play-scraper | Every 6 hours |
| Quora | Apify | jupri/quora-scraper | Every 4 hours |
| Dev.to | Official API | Free | Every 2 hours |

---

## Notification Strategy

### Design Principles

1. **Prevent notification burnout** - Don't overwhelm users
2. **Respect attention** - Slack for real-time, email for digests
3. **Clear tier differentiation** - Enterprise gets more control
4. **Timezone-aware delivery** - Respect business hours

### Notification Matrix

#### By Tier

| Tier | Slack | Email |
|------|-------|-------|
| **Free** | ❌ Not available | ❌ Not available |
| **Pro** | ✅ Immediate (per 2-hr refresh) | ✅ Daily digest only @ 8am |
| **Enterprise** | ✅ Immediate OR Hourly batch | ✅ Checkboxes: Immediate / Daily / Weekly |

#### Pro Tier Notifications ($29/mo)

- **Slack:** Immediate notification when 2-hour refresh finds new mentions
  - Batched per refresh cycle (not per-mention spam)
  - Format: "5 new mentions found" with summary
- **Email:** Daily digest only
  - Delivered at 8am in user's timezone
  - No immediate email option (prevents inbox overload)
- **No configuration options** - Sensible defaults, just works

#### Enterprise Tier Notifications ($99/mo)

- **Slack options (radio buttons):**
  - Immediate (per mention)
  - Hourly batched summary
- **Email options (checkboxes - can select multiple):**
  - ☐ Immediate (per mention)
  - ☐ Daily digest
  - ☐ Weekly digest
    - ☑ Monday morning (weekend catch-up)
    - ☑ Friday afternoon (week review)
- **Quiet hours toggle:** Only deliver between 8am-6pm in user's timezone

### Weekly Digest Timing Rationale

**Monday + Friday schedule for Enterprise:**

| Day | Purpose | Content Focus |
|-----|---------|---------------|
| **Monday AM** | Weekend catch-up | "Here's what happened over the weekend" |
| **Friday PM** | Week review | "Your week in review - plan for next week" |

This creates a business rhythm:
- Start week informed about weekend activity
- End week with summary for leadership/planning

### Notification Formats

#### Slack - Immediate (Per Mention)

```
🔔 New mention found

Monitor: Competitor Tracking
Platform: Reddit
Title: "Anyone tried Acme instead of YourProduct?"

"I've been using YourProduct for 6 months but
pricing is getting ridiculous. Has anyone tried
Acme? Heard good things about their support..."

Sentiment: Negative · Category: Pain Point

[View on Reddit]  [Open in Kaulby]
```

#### Slack - Batched Summary

```
📊 Kaulby: 5 new mentions found

Competitor Tracking (3 new)
• Reddit: "Anyone tried Acme instead?" — Negative
• HN: "YourProduct alternatives?" — Neutral
• Trustpilot: "Switching from YourProduct" — Negative

Brand Mentions (2 new)
• Quora: "Is YourProduct worth it?" — Neutral
• Play Store: "Best app I've used" — Positive

[View all in Kaulby →]
```

#### Email Subject Lines

| Type | Subject Line |
|------|--------------|
| **Immediate** | `[Kaulby] Reddit: "Anyone tried Acme instead?"` |
| **Daily** | `[Kaulby] Daily: 12 new mentions across 4 monitors` |
| **Weekly** | `[Kaulby] Week of Jan 13: 47 mentions, 8 need attention` |

### Timezone-Aware Delivery Implementation

**No infrastructure strain.** Implementation approach:

```typescript
// Daily digest cron runs every hour
// Queries users where it's currently 8am in their timezone
const usersToNotify = await db.query.users.findMany({
  where: sql`EXTRACT(HOUR FROM NOW() AT TIME ZONE ${users.timezone}) = 8`
});
```

- 24 timezones = 24 small batches per day max
- Each batch: Query users → Generate emails → Send to Loops
- Loops handles actual delivery async
- **Cost impact: ~$0** (using existing services)

### In-App Notifications

**Decision: Not implementing for MVP**

Reasoning:
- No mobile app yet
- Requires WebSocket or polling for real-time
- Users already getting Slack/email - would be redundant
- Adds complexity without clear value

**Future consideration:** Add when/if mobile app is built, or if web dashboard users request it.

---

## Refresh & Monitoring Strategy

### Refresh Frequency by Tier

| Tier | Refresh Cycle | Rationale |
|------|---------------|-----------|
| **Free** | 24-hour delay | Encourages upgrade; reduces server load |
| **Pro** | Every 2 hours | Good value; prevents notification fatigue |
| **Enterprise** | Real-time | Premium feature; justifies 3.4x price |

### Why 2-Hour Refresh for Pro (Not Real-Time)

1. **Creates Enterprise differentiation** - Real-time is premium
2. **Reduces notification fatigue** - Max 12 notification batches/day
3. **More efficient** - Batch processing is cheaper than real-time
4. **Still valuable** - 2-hour delay is excellent for most use cases
5. **Clear upgrade path** - "Need instant alerts? Upgrade to Enterprise"

### 24/7 vs Business Hours Refresh

**Decision: 24/7 refresh, timezone-aware notification delivery**

- Data collection runs continuously (don't miss anything)
- Notification delivery respects user's timezone setting
- Outside business hours → queue for morning delivery (Enterprise quiet hours option)

**Rationale:**
- Global users in different timezones
- Crisis mentions can happen anytime
- Competitive intelligence doesn't sleep
- Simple to implement (already have timezone in users table)

---

## Seat Management & Team Features

### Options Evaluated

#### Option A: Simple Teams (MVP-Friendly) ✅ SELECTED

**Database changes:**
```
users table (existing)
├── Add: workspaceId (nullable, UUID)
├── Add: workspaceRole ("owner" | "member")
└── Owner = the person who pays

workspaces table (new)
├── id (UUID)
├── name ("Acme Corp")
├── ownerId (references users.id)
├── seatLimit (5 for Enterprise)
├── createdAt
└── updatedAt
```

**How it works:**
- Enterprise user creates workspace automatically on signup/upgrade
- They become the "owner" (billing admin)
- Owner invites teammates via email
- All members see the same monitors/results
- **No granular permissions** - everyone can create, edit, view
- Owner can remove members

**Implementation effort:** 2-3 days

#### Option B: Full RBAC (Evaluated, Deferred)

**Would require:**
```
workspaces table
workspace_members table (with roles)
workspace_invites table (pending invites)
monitor_permissions table (per-resource)
```

**Roles evaluated:**
| Role | Create | Edit | View | Manage Team | Billing |
|------|--------|------|------|-------------|---------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editor | ✅ | ✅ | ✅ | ❌ | ❌ |
| Viewer | ❌ | ❌ | ✅ | ❌ | ❌ |

**Implementation effort:** 2-3 weeks

**Decision: Deferred** - Add RBAC only if customers explicitly request it.

### Why Simple Teams for MVP

1. **Teams of 5 don't need RBAC** - Small teams trust each other
2. **Ship speed matters** - 2-3 days vs 2-3 weeks
3. **Can add permissions later** - Start simple, collect feedback
4. **Real enterprise needs sales calls anyway** - Custom contracts will define needs

### Seat Pricing Model

| Plan | Included Seats | Additional Seats |
|------|----------------|------------------|
| Free | 1 | N/A |
| Pro | 1 | N/A (upgrade to Enterprise) |
| Enterprise | 5 | +$15/user |

**Rationale:**
- Pro is for individuals (solopreneurs, freelancers)
- Enterprise is for teams (clear upgrade trigger)
- $99 for 5 users = $20/user (competitive)
- Additional seats at $15/user is reasonable

### Team Settings UI (MVP)

**Owner View:**
```
Team Settings

Your workspace: Acme Corp
Plan: Enterprise (5 seats)
Seats used: 3 of 5

Team Members
┌─────────────────────────────────────────────────┐
│ 👤 john@acme.com          Owner    (You)       │
│ 👤 sarah@acme.com         Member   [Remove]    │
│ 👤 mike@acme.com          Member   [Remove]    │
└─────────────────────────────────────────────────┘

[+ Invite Teammate]

Need more seats? Contact support.
```

**Member View:**
```
Team Settings

Your workspace: Acme Corp
Workspace owner: john@acme.com

Team Members
┌─────────────────────────────────────────────────┐
│ 👤 john@acme.com          Owner                │
│ 👤 sarah@acme.com         Member   (You)       │
│ 👤 mike@acme.com          Member               │
└─────────────────────────────────────────────────┘

To leave this workspace, contact the owner.
```

---

## Competitive Analysis

### vs Reddit-Focused Tools (Redreach, Syften)
- **Kaulby advantage**: More platforms (9 vs 1-2)
- **Price comparison**: Same ballpark ($19-29/mo entry)
- **Recommendation**: Kaulby offers 9x more platforms at similar price - **strong value**

### vs KWatch.io
- **KWatch.io**: $79/mo for 100 keywords, 4 platforms
- **Kaulby Pro**: $29/mo for 20 keywords, 8 platforms
- **Recommendation**: Kaulby offers better platform coverage at lower price

### vs Notifier
- **Notifier Pro**: $199/mo for 20 searchers
- **Kaulby Enterprise**: $99/mo for unlimited monitors + 5 seats
- **Recommendation**: Kaulby is significantly cheaper with more features

### vs Brand24/Mention
- **Brand24**: $99-399/mo, generic social listening, weak Reddit
- **Kaulby**: $29-99/mo, specialized community + review monitoring
- **Recommendation**: Different market segments, but Kaulby wins on Reddit/reviews

### vs Review Tools (ReviewFlowz)
- **ReviewFlowz**: $29/mo basic, $129/mo for integrations
- **Kaulby Pro**: $29/mo includes reviews + community monitoring
- **Recommendation**: Kaulby offers community monitoring + reviews at same price

---

## Pricing Recommendations

### Current Pricing (Recommended to Keep)

**$29 Pro / $99 Enterprise**

**Pros:**
- Highly competitive - undercuts most alternatives
- Captures GummySearch refugees looking for affordable options
- Low barrier to entry builds user base
- 9 platforms at $29 is exceptional value
- Team seats at Enterprise justify 3.4x multiplier

**Cons:**
- May leave money on the table
- Could signal "cheap" rather than "value"

### Future Price Increase Strategy

Consider price increase to **$39 Pro / $149 Enterprise** when:
- Reaching 1,000+ paying customers
- Adding more platforms
- Proven clear ROI with case studies
- Team features fully built out

---

## Implementation Roadmap

### Phase 1: Core Features (Current)
- [x] 9 platform support (Reddit, HN, PH, Google Reviews, Trustpilot, App Store, Play Store, Quora, Dev.to)
- [x] AI sentiment analysis
- [x] Pain point detection
- [ ] Update Pro refresh to 2 hours
- [ ] Notification settings per tier

### Phase 2: Team Features (Next)
- [ ] Workspace model in database
- [ ] Invite flow for Enterprise
- [ ] Member management UI
- [ ] Seat billing integration

### Phase 3: Enhanced Notifications
- [ ] Timezone-aware delivery
- [ ] Monday + Friday weekly digests
- [ ] Quiet hours for Enterprise
- [ ] Email templates (immediate, daily, weekly)

### Phase 4: Future Considerations
- [ ] RBAC (if requested by customers)
- [ ] Activity log (if compliance needed)
- [ ] In-app notifications (if mobile app built)
- [ ] Additional platforms (Indie Hackers, YouTube)

---

## Sources

- [GummySearch Final Chapter](https://gummysearch.com/final-chapter/)
- [Redreach Pricing](https://redreach.ai/)
- [Syften Pricing](https://syften.com/)
- [KWatch.io Pricing](https://kwatch.io/)
- [Notifier Pricing](https://notifier.so/)
- [Brand24 Pricing](https://brand24.com/prices/)
- [Mention Pricing](https://mention.com/en/pricing/)
- [ReviewFlowz Pricing](https://www.reviewflowz.com/)
- [Apify Quora Scrapers](https://apify.com/jupri/quora-scraper)

---

## Document History

| Date | Changes |
|------|---------|
| January 2026 | Initial competitor analysis |
| January 2026 | Added Quora platform (9 total) |
| January 2026 | Added tier gating analysis from competitors |
| January 2026 | Added notification strategy (Pro vs Enterprise) |
| January 2026 | Added refresh timing strategy (2hr Pro, real-time Enterprise) |
| January 2026 | Added seat management planning (simple teams for MVP) |
| January 2026 | Added weekly digest timing (Monday + Friday) |
| January 2026 | Removed in-app notifications from scope |
