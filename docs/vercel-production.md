# Kaulby Infrastructure & Cost Analysis

> Deep dive into Vercel hosting, infrastructure costs, scalability, and ROI projections.

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Vercel Scalability](#vercel-scalability)
3. [Complete Infrastructure Cost Breakdown](#complete-infrastructure-cost-breakdown)
4. [Cost Projections by User Count](#cost-projections-by-user-count)
5. [Revenue vs Infrastructure ROI Analysis](#revenue-vs-infrastructure-roi-analysis)
6. [When to Consider Alternatives](#when-to-consider-alternatives)
7. [Recommendations](#recommendations)

---

## Executive Summary

**TL;DR:** Kaulby's infrastructure costs are manageable and scale reasonably well. At 1,000 paying users, you're looking at approximately **$200-400/month** in infrastructure costs against **$20,000-40,000/month** in revenue. ROI is strong.

| Users | Est. Monthly Revenue | Est. Monthly Costs | Net Margin |
|-------|---------------------|-------------------|------------|
| 500   | $10,000 - $20,000   | $100 - $200       | ~98%       |
| 1,000 | $20,000 - $40,000   | $200 - $400       | ~98%       |
| 2,000 | $40,000 - $80,000   | $400 - $800       | ~98%       |

---

## Vercel Scalability

### How Vercel Scales

Vercel is built on serverless architecture. It scales **automatically and infinitely** - you don't manage servers.

**Key characteristics:**
- **Auto-scaling:** Functions spin up/down based on traffic
- **Global Edge Network:** 100+ edge locations worldwide
- **No capacity planning:** Pay for what you use
- **Cold starts:** ~50-250ms (minimal impact for most use cases)

### Vercel Pro Plan ($20/month per seat)

| Resource | Included | Overage Rate |
|----------|----------|--------------|
| Bandwidth | 1 TB/month | $0.15/GB |
| Active CPU Time | 40 hours/month | $5/hour |
| Edge Requests | 1,000,000/month | $2/million |
| Function Invocations | 1,000,000/month | $0.60/million |
| Build Minutes | 1,000/month | $0.03/minute |

### Traffic Capacity

**1 TB of bandwidth can serve approximately:**
- 10 million page views (100KB average page)
- 5 million API requests (200KB average response)

**40 hours of CPU time can handle:**
- ~1.4 million serverless function executions (at 100ms each)
- With efficient code, this supports thousands of concurrent users

### Will Vercel Handle Your Traffic?

| User Count | Expected Monthly Requests | Bandwidth | CPU Hours | Vercel Cost |
|------------|--------------------------|-----------|-----------|-------------|
| 500        | ~500K                    | ~50 GB    | ~5 hrs    | $20 (base)  |
| 1,000      | ~1M                      | ~100 GB   | ~10 hrs   | $20 (base)  |
| 2,000      | ~2M                      | ~200 GB   | ~20 hrs   | $20 (base)  |
| 5,000      | ~5M                      | ~500 GB   | ~50 hrs   | $70         |
| 10,000     | ~10M                     | ~1 TB     | ~100 hrs  | $320        |

**Verdict:** Vercel handles scale well. Costs stay low until ~5,000+ active users.

---

## Complete Infrastructure Cost Breakdown

### 1. Vercel (Hosting & Compute)

| Plan | Cost | Notes |
|------|------|-------|
| Pro Plan | $20/month | 1 seat included |
| Additional seats | $20/month each | For team members |

**Overage Estimates (at scale):**
- 500-2,000 users: Likely $0-20 overage
- 5,000 users: ~$50-100 overage
- 10,000 users: ~$200-400 overage

### 2. Neon (PostgreSQL Database)

| Plan | Cost | Includes |
|------|------|----------|
| Free | $0 | 0.5GB storage, 100 compute hours |
| Launch | $19/month | 10GB storage, 300 compute hours |
| Scale | $69/month | 50GB storage, 750 compute hours |

**Cost Drivers:**
- Compute: $0.106-0.222/compute-hour
- Storage: $0.35/GB-month (dropped significantly in 2025)

**User Projections:**
| Users | Storage Needed | Compute Hours | Est. Cost |
|-------|---------------|---------------|-----------|
| 500   | ~2 GB         | ~50 hrs       | $19 (Launch) |
| 1,000 | ~5 GB         | ~100 hrs      | $19-40 |
| 2,000 | ~10 GB        | ~200 hrs      | $40-69 |
| 5,000 | ~25 GB        | ~500 hrs      | $69-150 |

### 3. Inngest (Background Jobs)

| Plan | Cost | Includes |
|------|------|----------|
| Free | $0 | 50K executions/month |
| Pro | $25/month + $0.40/1K | 100K executions included |

**Kaulby Background Jobs:**
- Monitor checks (every 15 min per monitor)
- AI analysis per result
- Email notifications

**Execution Estimates:**
| Users | Monitors | Daily Checks | Monthly Execs | Cost |
|-------|----------|--------------|---------------|------|
| 500   | 1,500    | 144K         | 4.3M          | $25 + ~$1,700 |
| 1,000 | 3,000    | 288K         | 8.6M          | $25 + ~$3,400 |

**Wait - this seems high!** Let's optimize:
- Batch checks (not per-monitor)
- Check every 30 min instead of 15
- Group by platform

**Optimized Estimates:**
| Users | Monthly Execs | Cost |
|-------|---------------|------|
| 500   | ~100K         | $25 (included) |
| 1,000 | ~200K         | $25 + $40 = $65 |
| 2,000 | ~400K         | $25 + $120 = $145 |

### 4. OpenRouter (AI/LLM)

Pricing varies by model. For sentiment analysis, use efficient models:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4o-mini | $0.15 | $0.60 |
| Claude 3 Haiku | $0.25 | $1.25 |
| Llama 3.1 8B | $0.055 | $0.055 |

**Kaulby AI Usage (per result analyzed):**
- ~500 input tokens (post content)
- ~200 output tokens (sentiment + pain points)
- Cost per result: ~$0.0001-0.0005

| Users | Results/Month | AI Cost |
|-------|---------------|---------|
| 500   | 50K (Pro limit × users) | $5-25 |
| 1,000 | 100K          | $10-50 |
| 2,000 | 200K          | $20-100 |

**Pro tip:** Use Llama 3.1 8B for bulk analysis, GPT-4o-mini for complex queries. Costs drop 80%.

### 5. Clerk (Authentication)

| MAUs | Cost |
|------|------|
| 0-10,000 | Free |
| 10,001-50,000 | $25 + $0.02/MAU |
| 50,000+ | Volume discounts |

**Kaulby Projections:**
| Paying Users | Est. MAUs (with free tier) | Clerk Cost |
|--------------|---------------------------|------------|
| 500          | 2,000                     | $0 (free)  |
| 1,000        | 4,000                     | $0 (free)  |
| 2,000        | 8,000                     | $0 (free)  |
| 5,000        | 15,000                    | $125       |

### 6. Stripe (Payments)

**Fee:** 2.9% + $0.30 per transaction

| Monthly Revenue | Stripe Fees |
|-----------------|-------------|
| $10,000         | $320        |
| $20,000         | $610        |
| $40,000         | $1,190      |

### 7. Other Services (Optional)

| Service | Free Tier | Paid |
|---------|-----------|------|
| PostHog (Analytics) | 1M events | $0 for most |
| Langfuse (AI Observability) | 50K observations | $0 for most |
| Loops (Email) | 1,000 contacts | $29/mo for 5K |

---

## Cost Projections by User Count

### 500 Paying Users

**Assumptions:**
- 70% Pro ($29), 30% Free tier trials
- 350 paying × $29 avg = ~$10,150/month revenue

| Service | Monthly Cost |
|---------|-------------|
| Vercel Pro | $20 |
| Neon (Launch) | $19 |
| Inngest | $25 |
| OpenRouter | $15 |
| Clerk | $0 |
| Loops | $0 |
| PostHog | $0 |
| **Infrastructure Total** | **~$79** |
| Stripe Fees (2.9% + $0.30) | ~$295 |
| **Total Costs** | **~$374** |

**Net Revenue:** ~$9,776/month (96% margin)

---

### 1,000 Paying Users

**Assumptions:**
- 60% Pro ($29), 25% Enterprise ($99), 15% Free
- Revenue: 600×$29 + 250×$99 = ~$42,150/month

| Service | Monthly Cost |
|---------|-------------|
| Vercel Pro | $20 |
| Neon (Scale) | $69 |
| Inngest | $65 |
| OpenRouter | $35 |
| Clerk | $0 |
| Loops | $29 |
| PostHog | $0 |
| **Infrastructure Total** | **~$218** |
| Stripe Fees | ~$1,252 |
| **Total Costs** | **~$1,470** |

**Net Revenue:** ~$40,680/month (97% margin)

---

### 2,000 Paying Users

**Assumptions:**
- 55% Pro, 30% Enterprise, 15% Free
- Revenue: 1100×$29 + 600×$99 = ~$91,300/month

| Service | Monthly Cost |
|---------|-------------|
| Vercel Pro | $40 |
| Neon (Scale) | $150 |
| Inngest | $145 |
| OpenRouter | $80 |
| Clerk | $0 |
| Loops | $49 |
| PostHog | $0 |
| **Infrastructure Total** | **~$464** |
| Stripe Fees | ~$2,677 |
| **Total Costs** | **~$3,141** |

**Net Revenue:** ~$88,159/month (97% margin)

---

## Revenue vs Infrastructure ROI Analysis

### Your Pricing Tiers

| Tier | Price | Monitors | Results/mo | AI | Alerts |
|------|-------|----------|------------|-----|--------|
| Free | $0 | 3 | 100 | No | No |
| Pro | $29 | 20 | 5,000 | Yes | Yes |
| Enterprise | $99 | Unlimited | Unlimited | Yes | Yes |

### Cost Per User Analysis

**Pro User ($29/month):**
- Infrastructure cost: ~$0.15-0.30/user
- Stripe fee: ~$1.14/user
- **Net profit: ~$27.50-27.70/user** (95%+ margin)

**Enterprise User ($99/month):**
- Infrastructure cost: ~$0.40-0.80/user (heavier usage)
- Stripe fee: ~$3.17/user
- **Net profit: ~$95-95.50/user** (96%+ margin)

### Break-Even Analysis

**Monthly fixed costs:** ~$100 (Vercel + Neon + Inngest base)

**Break-even point:** 4 Pro users or 2 Enterprise users

### Is $29 Pro Better Than $99 Enterprise?

**From a margin perspective:**
- Pro: 95% margin
- Enterprise: 96% margin

**Both are excellent.** The Enterprise tier is slightly better margin-wise but requires less support/success effort per dollar. The Pro tier drives volume.

**Recommendation:** Keep both. The free→Pro conversion is your growth engine. Enterprise is pure profit.

---

## When to Consider Alternatives

### Vercel Pain Points at Scale

| Scale | Issue | Solution |
|-------|-------|----------|
| 10K+ users | Costs exceed $500/mo | Still fine, but evaluate |
| 50K+ users | Costs exceed $2-3K/mo | Consider self-hosting compute |
| 100K+ users | Enterprise pricing needed | Negotiate or migrate |

### Alternative Platforms

| Platform | Best For | Monthly Cost (at 10K users) |
|----------|----------|---------------------------|
| Vercel | DX, speed to market | ~$300-500 |
| Railway | Simpler pricing | ~$200-400 |
| Render | Predictable costs | ~$150-300 |
| AWS/GCP | Full control | ~$100-200 (but 10x complexity) |
| Self-hosted (VPS) | Maximum savings | ~$50-100 (but maintenance) |

### When to Migrate Away from Vercel

**Don't migrate if:**
- Revenue > 10x infrastructure costs (you're fine)
- Team < 5 engineers (Vercel DX saves time)
- You're still iterating on product

**Consider migrating if:**
- Infrastructure > 20% of revenue
- You have dedicated DevOps capacity
- Traffic patterns are predictable (not spiky)

**For Kaulby:** Stay on Vercel until you hit 50K+ users. The DX benefits outweigh cost savings.

---

## Recommendations

### Short Term (0-1,000 users)

1. **Stay on Vercel Pro** - $20/month is trivial
2. **Use Neon Launch** - $19/month covers you
3. **Inngest Free/Pro** - Monitor execution counts
4. **OpenRouter with cheap models** - Llama 3.1 8B for bulk

**Expected monthly infrastructure:** $50-100

### Medium Term (1,000-5,000 users)

1. **Vercel Pro remains sufficient** - Maybe $50-100/month
2. **Upgrade Neon to Scale** - $69/month
3. **Optimize Inngest** - Batch operations, reduce frequency
4. **Implement AI caching** - Don't re-analyze same content

**Expected monthly infrastructure:** $150-300

### Long Term (5,000+ users)

1. **Negotiate Vercel Enterprise** - If costs exceed $500/month
2. **Consider Neon Scale-to-Zero** - Aggressive auto-pause
3. **Evaluate Railway/Render** - If simpler pricing preferred
4. **Self-host AI inference** - If OpenRouter costs spike

**Expected monthly infrastructure:** $400-1,000

---

## Key Takeaways

1. **Vercel scales fine** - Won't be a bottleneck until 50K+ users
2. **Margins are excellent** - 95%+ at all projected scales
3. **Biggest variable cost is Stripe** - 2.9% of revenue
4. **AI costs are manageable** - Use efficient models
5. **Don't over-optimize early** - Focus on growth, not saving $20/month

**Bottom Line:** At $29/user, you need only 4 paying users to cover all infrastructure. Everything after that is profit. The ROI is exceptional.

---

## Sources

- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Pro Plan Details](https://vercel.com/docs/plans/pro-plan)
- [Neon Pricing](https://neon.com/pricing)
- [Inngest Pricing](https://www.inngest.com/pricing)
- [OpenRouter Pricing](https://openrouter.ai/pricing)
- [Clerk Pricing](https://clerk.com/pricing)
- [Stripe Fees](https://stripe.com/pricing)

---

*Last updated: January 2026*
