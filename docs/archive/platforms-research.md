# Kaulby Platform Research

Comprehensive research on platform APIs for multi-platform monitoring. Goal: Expand beyond tech-focused platforms (Reddit/HN/PH) to serve any customer profile.

**Last Updated:** January 15, 2026

---

## Executive Summary

### Current Platforms (Tech-Heavy)
| Platform | Audience | Implementation | Status |
|----------|----------|----------------|--------|
| Reddit | Tech, gaming, hobbyists | Public JSON endpoint | ✅ Implemented |
| Hacker News | Developers, founders | Firebase API | ✅ Implemented |
| Product Hunt | Startups, early adopters | API with key | ✅ Implemented |

### Top 3 Recommendations for MVP Expansion

| Rank | Platform | Why | Cost | Difficulty |
|------|----------|-----|------|------------|
| 🥇 | **Google Reviews** | Every business type needs this - massive TAM | $5/mo (Apify free tier) | Easy |
| 🥈 | **Trustpilot** | E-commerce & SaaS obsess over reviews | $5/mo (Apify free tier) | Easy |
| 🥉 | **App Store/Play Store** | Mobile devs are underserved market | Free (open source tools) | Easy |

**Honorable Mention:** Quora (great for pain point discovery, but noisier data)

---

## Detailed Platform Research

---

### 1. Google Reviews / Google My Business

**Target Audience:** Every local business, restaurants, dentists, lawyers, retail, services - MASSIVE TAM

**Why It Matters:**
- Every business with a physical location cares about Google Reviews
- Instant credibility for Kaulby as a "serious" monitoring tool
- Opens up non-tech customer segments

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Apify** | $5/mo credits (~8,000 reviews) | $0.60 per 1,000 reviews | ⭐⭐⭐⭐⭐ Easy |
| **SerpAPI** | 250 searches/mo | $50/mo for 5,000 searches | ⭐⭐⭐⭐ Easy |
| **Outscraper** | Free tier available | Pay-as-you-go | ⭐⭐⭐⭐ Easy |
| **DataForSEO** | Pay-as-you-go | ~$0.002 per 10 results | ⭐⭐⭐ Medium |
| **Official Google API** | Limited | Only 5 reviews per place | ❌ Not viable |

#### Technical Notes
- Google's official API only returns 5 reviews per place - useless for monitoring
- Third-party scrapers work reliably
- Apify's Google Maps Reviews Scraper is production-ready
- SerpAPI has dedicated Google Maps Reviews endpoint with consistent JSON

#### Recommendation
**Use Apify** - $5 free tier is generous, scraper is battle-tested, easy JSON output

#### Sources
- [Apify Google Maps Reviews Scraper](https://apify.com/compass/google-maps-reviews-scraper)
- [SerpAPI Google Maps Reviews API](https://serpapi.com/google-maps-reviews-api)
- [Outscraper Google Maps Reviews API](https://outscraper.com/google-maps-reviews-api/)
- [Lobstr.io Google Reviews API Comparison](https://www.lobstr.io/blog/google-reviews-api)

---

### 2. Trustpilot

**Target Audience:** E-commerce brands, SaaS companies, online services - high-value customers

**Why It Matters:**
- E-commerce companies obsess over Trustpilot ratings
- SaaS companies use it for social proof
- High willingness to pay for monitoring tools

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Apify** | $5/mo credits | Pay per result | ⭐⭐⭐⭐⭐ Easy |
| **Outscraper** | Free tier available | Pay-as-you-go | ⭐⭐⭐⭐ Easy |
| **DataForSEO** | Pay-as-you-go | Per 10 results | ⭐⭐⭐ Medium |
| **Official Trustpilot API** | None | Enterprise only ($1000+/mo) | ❌ Too expensive |

#### Technical Notes
- Official API requires Enterprise plan (custom pricing, annual commitment)
- Even at $1,059/mo, their Advanced plan lacks API access
- Third-party scraping is the only viable option for MVP
- Public review pages are easily accessible

#### Recommendation
**Use Apify or Outscraper** - Public data, easy scraping, no auth required

#### Sources
- [Trustpilot Official API Docs](https://developers.trustpilot.com/)
- [Trustpilot Pricing](https://business.trustpilot.com/pricing)
- [Outscraper Trustpilot Reviews API](https://outscraper.com/trustpilot-reviews-api/)
- [Trustpilot Pricing Analysis](https://wiserreview.com/blog/trustpilot-pricing/)

---

### 3. App Store & Google Play Store Reviews

**Target Audience:** Mobile app developers, app publishers - growing market

**Why It Matters:**
- Mobile app market is huge and underserved by current tools
- Developers need sentiment analysis on app reviews
- Clear pain point: managing reviews across both stores

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Open Source (GitHub)** | Free | Free | ⭐⭐⭐⭐ Easy |
| **Apify** | $5/mo credits | Pay per result | ⭐⭐⭐⭐ Easy |
| **Appbot** | None | Large/Premium plans | ⭐⭐⭐ Medium |
| **AppTweak** | None | Contact sales | ⭐⭐ Complex |
| **Official Apple API** | Free (own apps) | Free (own apps) | ⭐⭐⭐ Medium |
| **Official Google API** | Free (own apps) | Free (own apps) | ⭐⭐⭐ Medium |

#### Technical Notes
- Official APIs only work for apps YOU own
- For competitor monitoring, need third-party tools
- Open source option: [datasciencecampus/app_review](https://github.com/datasciencecampus/app_review)
- Appfigures has a solid reviews API

#### Recommendation
**Start with open source tool** - Free, well-documented, covers both stores

#### Sources
- [Apple Customer Reviews API](https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews)
- [Google Play In-App Review API](https://developer.android.com/guide/playcore/in-app-review)
- [GitHub: app_review](https://github.com/datasciencecampus/app_review)
- [Appfigures Reviews API](https://docs.appfigures.com/api/reference/v2/reviews)

---

### 4. Quora

**Target Audience:** Anyone asking questions - broad market, great for pain point discovery

**Why It Matters:**
- Gold mine for finding customer pain points
- Questions reveal what people are struggling with
- Not tech-focused - covers all industries

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Apify** | $5/mo credits | Pay per result | ⭐⭐⭐⭐ Easy |
| **ScrapingBee** | Free credits on signup | Pay per API call | ⭐⭐⭐⭐ Easy |
| **Bright Data** | None | Premium pricing | ⭐⭐⭐ Medium |
| **Crawlbase** | Free trial | Pay-as-you-go | ⭐⭐⭐ Medium |
| **Official Quora API** | ❌ None | Does not exist | N/A |

#### Technical Notes
- **No official Quora API exists**
- Quora has anti-scraping measures - need proxy rotation
- Data is noisier than review platforms
- Good for content ideas and pain point discovery

#### Recommendation
**Use Apify** - Has working Quora scraper, handles anti-bot measures

#### Sources
- [ScraperAPI Quora Guide](https://www.scraperapi.com/web-scraping/quora/)
- [ScrapingBee Quora Scraper API](https://www.scrapingbee.com/scrapers/quora-api/)
- [Bright Data Quora Scraper](https://brightdata.com/products/web-scraper/quora)
- [Apify Quora Scraper](https://apify.com/inquisitive_sarangi/quora-scraper)

---

### 5. G2 & Capterra

**Target Audience:** B2B SaaS companies - high-value, willing to pay

**Why It Matters:**
- B2B SaaS companies live and die by G2/Capterra reviews
- High willingness to pay for competitive intelligence
- Clear use case: monitor competitor reviews

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Apify** | $5/mo credits | Pay per result | ⭐⭐⭐⭐ Easy |
| **RapidAPI (G2 Scraper)** | Limited | Pay per request | ⭐⭐⭐ Medium |
| **ScraperAPI** | $29 for 250k requests | Per request | ⭐⭐⭐ Medium |
| **Official G2 API** | ❌ None | Partner only | N/A |
| **Official Capterra API** | ❌ None | Does not exist | N/A |

#### Technical Notes
- No official APIs from G2 or Capterra
- Apify has working scrapers for both platforms
- Data is high-quality and structured
- B2B customers will pay premium for this data

#### Recommendation
**Use Apify** - Has scrapers for both G2 and Capterra, unified approach

#### Sources
- [Apify Capterra Reviews Scraper](https://apify.com/imadjourney/capterra-reviews-scraper/api)
- [Apify G2 Scraper](https://apify.com/alizarin_refrigerator-owner/g2-scraper/api/openapi)
- [GitHub: Advanced-G2-Scraper](https://github.com/biegehydra/Advanced-G2-Scraper/)

---

### 6. Yelp

**Target Audience:** Local businesses, restaurants, service providers

**Why It Matters:**
- Important for local business reputation
- Strong in restaurant/hospitality industries
- US-focused but significant market

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Yelp Fusion API** | 30-day trial (5,000 calls) | $7.99-$14.99 per 1,000 calls | ⭐⭐⭐ Medium |
| **SerpAPI** | 250 searches/mo | $50/mo+ | ⭐⭐⭐⭐ Easy |
| **Apify** | $5/mo credits | Pay per result | ⭐⭐⭐⭐ Easy |

#### Technical Notes
- Yelp killed their free tier in 2019 - caused developer backlash
- Even paid plans only give 3-7 reviews per business (truncated)
- Full review text requires Enterprise
- SerpAPI might be better value

#### ⚠️ Pricing Controversy
Yelp's API pricing angered developers in 2024. Many migrated away due to:
- No free tier (Google/Facebook still have free tiers)
- Limited reviews even on paid plans
- Sudden price increases

#### Recommendation
**Use SerpAPI instead** - More reliable, better value, includes Yelp endpoint

#### Sources
- [Yelp Fusion API Pricing](https://business.yelp.com/data/resources/pricing/)
- [Yelp API Pricing Controversy](https://techcrunch.com/2024/08/02/yelps-lack-of-transparency-around-api-charges-angers-developers/)
- [SerpAPI Yelp Support](https://serpapi.com/pricing)

---

### 7. TripAdvisor

**Target Audience:** Hotels, restaurants, travel industry, tourism businesses

**Why It Matters:**
- Essential for hospitality industry
- 7.5 million locations, 1 billion reviews
- International reach

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **TripAdvisor Content API** | 5,000 calls/mo free | Pay-as-you-go after | ⭐⭐⭐⭐ Easy |
| **DataForSEO** | Pay-as-you-go | Per 10 results | ⭐⭐⭐ Medium |
| **SerpAPI** | 250 searches/mo | $50/mo+ | ⭐⭐⭐⭐ Easy |

#### Technical Notes
- **Official API has free tier!** - 5,000 calls/month free
- Requires credit card for overage charges
- Only for B2C (consumer-facing) apps
- 3 reviews and 2 photos per location
- Rate limited: 50 calls/sec, 1,000/day during dev

#### Recommendation
**Use Official TripAdvisor API** - Free tier exists, official support

#### Sources
- [TripAdvisor Content API](https://developer-tripadvisor.com/content-api/)
- [TripAdvisor API Pricing](https://tripadvisor-content-api.readme.io/reference/faq)
- [DataForSEO TripAdvisor API](https://dataforseo.com/apis/reviews-api/tripadvisor-reviews-api)

---

### 8. Amazon Reviews

**Target Audience:** E-commerce brands, D2C companies, product manufacturers

**Why It Matters:**
- Huge market - every product brand monitors Amazon
- Sentiment analysis on product feedback
- Competitive intelligence

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Apify** | $5/mo credits | Pay per result | ⭐⭐⭐⭐ Easy |
| **Oxylabs** | None | Premium | ⭐⭐⭐ Medium |
| **ScrapingBee** | Free credits | Per API call | ⭐⭐⭐ Medium |
| **Official Amazon PA API** | Free | Free | ❌ No review text |

#### ⚠️ Recent Changes (2024-2025)
- **Nov 2024:** Amazon now requires login to view reviews
- **Feb 2025:** Cannot view 8 most recent reviews without cookie
- Scraping now requires authenticated session cookies

#### Technical Notes
- Official Product Advertising API does NOT include review text
- Third-party scraping is only option for review content
- Need to handle Amazon's aggressive anti-bot measures
- Cookie/auth requirements make this harder than before

#### Recommendation
**Deprioritize for MVP** - Recent auth changes make this complex. Revisit later.

#### Sources
- [Amazon PA API Limitations](https://tracefuse.ai/blog/is-there-an-amazon-api-to-retrieve-product-reviews/)
- [SerpAPI Amazon Scraping Tutorial](https://serpapi.com/blog/scrape-amazon-product-data-tutorial/)
- [Oxylabs Amazon Reviews API](https://oxylabs.io/products/scraper-api/ecommerce/amazon/reviews)

---

### 9. Glassdoor

**Target Audience:** HR teams, recruiters, employer branding

**Why It Matters:**
- Companies care deeply about employer reputation
- HR teams are a distinct customer segment
- Niche but willing to pay

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Apify** | $5/mo credits | Pay per result | ⭐⭐⭐ Medium |
| **Bright Data** | None | $0.001 per record | ⭐⭐⭐ Medium |
| **OpenWeb Ninja** | None | Contact sales | ⭐⭐ Complex |
| **Official Glassdoor API** | ❌ Closed | Partner only since 2021 | N/A |

#### Technical Notes
- Official API closed to public in 2021
- Only employers/partners can get access now
- High blocking rate - anti-scraping measures
- Scraping is technically possible but risky

#### Recommendation
**Skip for MVP** - API is closed, scraping is risky and complex

#### Sources
- [Glassdoor API Documentation](https://www.glassdoor.com/developer/index.htm)
- [How to Scrape Glassdoor](https://scrapfly.io/blog/posts/how-to-scrape-glassdoor)
- [Apify Glassdoor Reviews Scraper](https://apify.com/scrapio/glassdoor-reviews-scraper/api)

---

### 10. Facebook Groups

**Target Audience:** Non-tech communities, local groups, hobbyist communities

**Why It Matters:**
- 1.8 billion users, 25 million active groups
- Massive non-tech audience
- Community managers need monitoring tools

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Apify** | $5/mo credits (~1,000 posts) | $0.005 per post | ⭐⭐⭐ Medium |
| **Bright Data** | None | Premium | ⭐⭐ Complex |
| **Official Graph API** | Free | Free | ❌ Very limited |

#### ⚠️ Major Limitations
- Graph API doesn't allow scraping public groups unless you're admin
- Can only access groups you have explicit consent for
- Violates Facebook ToS to scrape without permission
- Public group scraping is legal gray area

#### Technical Notes
- Only works with **public** groups
- Private group scraping requires login (ToS violation)
- Facebook actively blocks scrapers
- Data quality is good but access is problematic

#### Recommendation
**Skip for MVP** - Legal/ToS risks too high, access too limited

#### Sources
- [Apify Facebook Groups Scraper](https://apify.com/apify/facebook-groups-scraper)
- [Data365 Facebook Group Scraper](https://data365.co/blog/facebook-group-scraper)
- [Best Facebook Scrapers 2025](https://medium.com/@datajournal/best-facebook-scrapers-e36f01b52e4f)

---

### 11. LinkedIn

**Target Audience:** B2B companies, recruiters, sales teams

**Why It Matters:**
- B2B audience lives on LinkedIn
- Professional services need mention monitoring
- High-value customer segment

#### API Options

| Provider | Free Tier | Paid Pricing | Ease of Use |
|----------|-----------|--------------|-------------|
| **Official LinkedIn API** | None | Partner only | ❌ Restricted |
| **Apify** | $5/mo credits | Pay per result | ⭐⭐ Risky |
| **Lix-it** | None | Contact sales | ⭐⭐ Complex |

#### ⚠️ Major Restrictions
- LinkedIn strictly prohibits scraping
- API access requires partner approval
- Scraping can result in legal action
- Account bans are common

#### Technical Notes
- Official API is heavily restricted
- Need to be LinkedIn Partner for most endpoints
- Anti-scraping measures are among the most advanced
- High legal risk

#### Recommendation
**Skip entirely** - Legal risk too high, API access too restricted

#### Sources
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn API Guide](https://www.outx.ai/blog/linkedin-api-guide)
- [ScrapFly LinkedIn Guide](https://scrapfly.io/blog/posts/guide-to-linkedin-api-and-alternatives)

---

## Provider Comparison

### Multi-Platform Providers

| Provider | Free Tier | Platforms Covered | Best For |
|----------|-----------|-------------------|----------|
| **Apify** | $5/mo (~8k reviews) | All major platforms | MVP - best value |
| **SerpAPI** | 250 searches/mo | Google, Yelp, TripAdvisor | Simple integration |
| **DataForSEO** | Pay-as-you-go | Google, Trustpilot, TripAdvisor, App Stores | Scale |
| **Outscraper** | Free tier | Google, Trustpilot | Google-focused |

### Apify Pricing Deep Dive

| Plan | Monthly Cost | Credits | Best For |
|------|--------------|---------|----------|
| Free | $0 | $5 (~8k reviews) | MVP/Testing |
| Starter | $39 | $39 in credits | Small scale |
| Scale | $199 | $199 in credits | Growth |
| Business | $999 | $999 in credits | Enterprise |

**Key Insight:** Apify's free tier renews monthly - you can run production monitoring on $0/month for low volume.

---

## Implementation Priority Matrix

### Phase 1: MVP (Do Now)
| Platform | Provider | Cost | Implementation Time |
|----------|----------|------|---------------------|
| Google Reviews | Apify | $0-5/mo | 1-2 days |
| Trustpilot | Apify | $0-5/mo | 1-2 days |
| App Store/Play Store | Open source | $0 | 2-3 days |

### Phase 2: Growth (After MVP)
| Platform | Provider | Cost | When |
|----------|----------|------|------|
| TripAdvisor | Official API | Free 5k/mo | If hospitality demand |
| Quora | Apify | $0-5/mo | For pain point feature |
| G2/Capterra | Apify | $0-5/mo | If B2B SaaS demand |

### Phase 3: Scale (Enterprise Customers)
| Platform | Provider | Cost | When |
|----------|----------|------|------|
| Yelp | SerpAPI | $50+/mo | If local business demand |
| Amazon Reviews | Custom | High | If e-commerce demand |
| X/Twitter | SerpAPI | $50+/mo | If social demand |

### Skip (Not Worth It)
| Platform | Reason |
|----------|--------|
| LinkedIn | Legal risk, restricted API |
| Facebook Groups | ToS violations, limited access |
| Glassdoor | API closed, complex scraping |

---

## Final Recommendations

### Top 3 for MVP

#### 1. 🥇 Google Reviews (via Apify)
- **Why:** Every business type needs this - restaurants, dentists, lawyers, retail
- **Cost:** $0-5/month (free tier covers MVP)
- **Difficulty:** Easy - Apify scraper is production-ready
- **TAM Impact:** Massive - opens entire local business market

#### 2. 🥈 Trustpilot (via Apify)
- **Why:** E-commerce and SaaS companies obsess over reviews
- **Cost:** $0-5/month (free tier covers MVP)
- **Difficulty:** Easy - public pages, no auth needed
- **TAM Impact:** High - attracts paying customers (e-commerce/SaaS)

#### 3. 🥉 App Store / Google Play (via open source)
- **Why:** Mobile app market is underserved, clear pain point
- **Cost:** $0 (open source tools available)
- **Difficulty:** Easy - well-documented GitHub repo
- **TAM Impact:** Medium - growing mobile app market

### Why These Three?

1. **Diversifies audience** - No longer just "tech bros"
2. **All are free/cheap** - Can implement without budget
3. **All are easy** - 1-2 days implementation each
4. **High perceived value** - Customers will pay for these
5. **Differentiates from GummySearch** - They're Reddit-only

### Implementation Order

```
Week 1: Google Reviews + Trustpilot (Apify)
Week 2: App Store / Play Store (Open source)
Week 3: Polish UI, add platform selectors
Launch: "Monitor your brand across 6 platforms"
```

---

## Appendix: Useful Links

### Apify Scrapers
- [Google Maps Reviews Scraper](https://apify.com/compass/google-maps-reviews-scraper)
- [Trustpilot Scraper](https://outscraper.com/trustpilot-reviews-api/)
- [App Store Scraper](https://apify.com/search?q=app+store)

### Open Source
- [App Store/Play Store Reviews](https://github.com/datasciencecampus/app_review)
- [G2 Scraper](https://github.com/biegehydra/Advanced-G2-Scraper/)

### Official APIs
- [TripAdvisor Content API](https://developer-tripadvisor.com/content-api/)
- [Apple App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews)

### Multi-Platform
- [SerpAPI](https://serpapi.com/pricing)
- [DataForSEO Reviews API](https://dataforseo.com/apis/reviews-api)
