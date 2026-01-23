# Kaulby Platform Expansion Plan

## Overview
Expand Kaulby from 9 platforms to 12 by adding YouTube Comments, G2 Reviews, Yelp, and Amazon Reviews, while removing Dev.to (too niche).

**Status:** Phase 1-4 Complete, Phase 5-6 Pending
**Created:** January 2026
**Updated:** January 2026

---

## Final Platform List (12 total)

| # | Platform | Type | Apify Actor | Needs URL? | Best For |
|---|----------|------|-------------|------------|----------|
| 1 | Reddit | Discussion | Serper + Apify fallback | No | Everyone |
| 2 | Hacker News | Discussion | Algolia API (free) | No | Tech/Startups |
| 3 | Product Hunt | Launches | Serper | No | Product launches |
| 4 | Google Reviews | Reviews | `compass/google-maps-reviews-scraper` | Yes | Local/All |
| 5 | Trustpilot | Reviews | `happitap/trustpilot-scraper` | Yes | E-commerce/SaaS |
| 6 | App Store | Reviews | `thewolves/appstore-reviews-scraper` | Yes | Mobile apps |
| 7 | Play Store | Reviews | `neatrat/google-play-store-reviews-scraper` | Yes | Mobile apps |
| 8 | Quora | Q&A | `jupri/quora-scraper` | No | General |
| 9 | **YouTube** | Comments | `streamers/youtube-comment-scraper` | Yes | Consumer/Tech |
| 10 | **G2** | Reviews | `epctex/g2-scraper` | Yes | SaaS |
| 11 | **Yelp** | Reviews | `maxcopell/yelp-scraper` | Yes | Local business |
| 12 | **Amazon** | Reviews | `junglee/amazon-reviews-scraper` | Yes | E-commerce |

**Removed:** Dev.to (too niche - only ~10% of users would benefit)

---

## Implementation Phases

### Phase 1: Core Type Definitions ✅ COMPLETE
- [x] Update `platformEnum` in `src/lib/db/schema.ts`
- [x] Update `platforms` array in `src/lib/platform-utils.ts`
- [x] Add `platformDisplayNames` for new platforms
- [x] Add `platformColors` for new platforms
- [x] Update `platforms` arrays in `src/lib/plans.ts` (free/pro/enterprise tiers)

### Phase 2: Apify Integration ✅ COMPLETE
- [x] Add new actors to `ACTORS` constant in `src/lib/apify.ts`
- [x] Add TypeScript interfaces for new platform responses
- [x] Create `fetchYouTubeComments()` function
- [x] Create `fetchG2Reviews()` function
- [x] Create `fetchYelpReviews()` function
- [x] Create `fetchAmazonReviews()` function
- [x] Implement scanning functions in `scan-on-demand.ts`

### Phase 3: Background Jobs (Inngest) ✅ COMPLETE
- [x] Create `src/lib/inngest/functions/monitor-youtube.ts`
- [x] Create `src/lib/inngest/functions/monitor-g2.ts`
- [x] Create `src/lib/inngest/functions/monitor-yelp.ts`
- [x] Create `src/lib/inngest/functions/monitor-amazon.ts`
- [x] Delete `src/lib/inngest/functions/monitor-devto.ts`
- [x] Update `src/lib/inngest/index.ts` exports
- [x] Update `scan-on-demand.ts` switch cases

### Phase 4: UI Updates ✅ COMPLETE
- [x] Update `ALL_PLATFORMS` in monitor creation form (`new-monitor-form.tsx`)
- [x] Update `ALL_PLATFORMS` in monitor edit form (`edit-monitor-form.tsx`)
- [x] Update `validPlatforms` in API route (`/api/monitors/route.ts`)
- [x] Update `VALID_PLATFORMS` in API route (`/api/monitors/[id]/route.ts`)
- [x] Update `validPlatforms` in v1 API route (`/api/v1/monitors/route.ts`)
- [x] Update platform union type in results-list.tsx (done in Phase 1)

### Phase 5: Content Updates (72 occurrences to update)
Files to update "9 platforms" → "12 platforms":
- [ ] `src/app/tools/page.tsx` (4 occurrences)
- [ ] `src/app/tools/[slug]/layout.tsx` (5 occurrences)
- [ ] `src/app/tools/[slug]/page.tsx` (9 occurrences)
- [ ] `src/app/gummysearch/layout.tsx` (2 occurrences)
- [ ] `src/app/gummysearch/page.tsx` (1 occurrence)
- [ ] `src/app/alternatives/[competitor]/layout.tsx` (6 occurrences)
- [ ] `src/app/alternatives/[competitor]/page.tsx` (22 occurrences)
- [ ] `src/app/alternatives/page.tsx` (4 occurrences)
- [ ] `src/app/(dashboard)/dashboard/monitors/new/new-monitor-form.tsx` (1 occurrence)
- [ ] `src/app/(dashboard)/dashboard/monitors/[id]/edit/edit-monitor-form.tsx` (1 occurrence)
- [ ] `src/app/(dashboard)/dashboard/settings/page.tsx` (1 occurrence)
- [ ] `src/app/(dashboard)/dashboard/help/page.tsx` (4 occurrences)
- [ ] `src/app/pricing/page.tsx` (3 occurrences)
- [ ] `src/components/dashboard/discover-view.tsx` (1 occurrence)
- [ ] `src/components/dashboard/audience-card.tsx` (1 occurrence)
- [ ] `src/components/dashboard/source-suggestions.tsx` (1 occurrence)
- [ ] `src/components/dashboard/upgrade-banner.tsx` (1 occurrence)
- [ ] `src/components/dashboard/onboarding.tsx` (1 occurrence)
- [ ] `src/components/dashboard/insights-view.tsx` (1 occurrence)
- [ ] `src/components/day-pass-card.tsx` (1 occurrence)
- [ ] `src/lib/seo/structured-data.tsx` (3 occurrences)
- [ ] `src/lib/polar.ts` (1 occurrence)

Also update platform list mentions (remove Dev.to, add YouTube, G2, Yelp, Amazon Reviews)

### Phase 6: Database Migration
- [ ] Add new enum values via Drizzle migration
- [ ] Push schema to Neon

---

## New Platform Details

### YouTube Comments
- **Apify Actor:** `streamers/youtube-comment-scraper`
- **Input:** Video URL or Channel URL
- **Output:** Comment text, author, likes, replies, timestamp
- **Use Case:** Monitor product review videos, tutorial comments, brand mentions

### G2 Reviews
- **Apify Actor:** `epctex/g2-scraper`
- **Input:** G2 product page URL
- **Output:** Review text, rating, pros/cons, reviewer info, date
- **Use Case:** SaaS companies tracking competitor reviews, own product feedback

### Yelp Reviews
- **Apify Actor:** `maxcopell/yelp-scraper`
- **Input:** Yelp business page URL
- **Output:** Review text, rating, reviewer info, date, photos
- **Use Case:** Local businesses, restaurants, service providers

### Amazon Reviews
- **Apify Actor:** `junglee/amazon-reviews-scraper`
- **Input:** Amazon product URL (ASIN)
- **Output:** Review text, rating, verified purchase, helpful votes, date
- **Use Case:** E-commerce brands, product manufacturers

---

## Files to Modify

### Must Change:
| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add new platform enum values |
| `src/lib/platform-utils.ts` | Add display names and colors |
| `src/lib/plans.ts` | Update tier platform arrays |
| `src/lib/apify.ts` | Add actors and fetch functions |
| `src/lib/inngest/index.ts` | Update exports |
| `src/lib/inngest/functions/scan-on-demand.ts` | Add switch cases |
| `src/app/(dashboard)/dashboard/monitors/new/new-monitor-form.tsx` | Update ALL_PLATFORMS |
| `src/app/api/monitors/route.ts` | Update validPlatforms |

### Must Create:
- `src/lib/inngest/functions/monitor-youtube.ts`
- `src/lib/inngest/functions/monitor-g2.ts`
- `src/lib/inngest/functions/monitor-yelp.ts`
- `src/lib/inngest/functions/monitor-amazon.ts`

### Must Delete:
- `src/lib/inngest/functions/monitor-devto.ts`

### Content Updates (9→12):
- `src/app/tools/[slug]/page.tsx`
- `src/app/alternatives/[competitor]/page.tsx`
- `src/app/(dashboard)/dashboard/help/page.tsx`
- `src/components/dashboard/upgrade-banner.tsx`
- `src/components/dashboard/onboarding.tsx`
- `src/components/dashboard/insights-view.tsx`

---

## Platform Colors

| Platform | Badge Color | Bar Color |
|----------|-------------|-----------|
| YouTube | `bg-red-500/10 text-red-500` | `bg-red-500` |
| G2 | `bg-orange-600/10 text-orange-600` | `bg-orange-600` |
| Yelp | `bg-red-600/10 text-red-600` | `bg-red-600` |
| Amazon | `bg-amber-600/10 text-amber-600` | `bg-amber-600` |

---

## Testing Checklist

### New Platform Tests:
- [ ] YouTube: Create monitor with video URL, trigger scan, verify results
- [ ] G2: Create monitor with product URL, trigger scan, verify results
- [ ] Yelp: Create monitor with business URL, trigger scan, verify results
- [ ] Amazon: Create monitor with product URL, trigger scan, verify results

### Regression Tests:
- [ ] Reddit still works
- [ ] Hacker News still works
- [ ] Review platforms (Google, Trustpilot, App Store, Play Store) still work
- [ ] Quora still works
- [ ] Free tier only sees Reddit
- [ ] Pro/Team see all 12 platforms
- [ ] Platform filtering in results view works
- [ ] AI analysis runs on new platform results

### Edge Cases:
- [ ] Invalid URLs handled gracefully
- [ ] Rate limiting works
- [ ] Circuit breaker triggers on failures
- [ ] Empty results handled

---

## Rollback Plan

If issues arise:
1. Revert code changes via git
2. Keep new enum values in database (can't remove easily)
3. UI will simply not show the platforms that aren't in code

---

## Notes

- Dev.to enum value kept in database for historical data compatibility
- PostgreSQL doesn't support removing enum values easily
- All new platforms require Pro tier (same as existing non-Reddit platforms)
