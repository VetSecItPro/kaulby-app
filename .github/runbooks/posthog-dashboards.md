# PostHog Dashboards Runbook

**What this is:** the operational reference for the 3 PostHog dashboards Kaulby relies on for product, AI, and infrastructure health. Use this when:
- Onboarding a new operator who needs to know what each chart means
- Debugging a "something feels off" report and you need to know which dashboard to check first
- Tuning thresholds (when to ignore vs page someone)
- Replicating these dashboards in a new PostHog project (run `scripts/setup-posthog-dashboards.ts`)

**Created:** 2026-04-23 (W3.8 of COA 4) via `scripts/setup-posthog-dashboards.ts`. Re-running the script is idempotent — it skips dashboards/insights that already exist by name.

**PostHog org:** `vetsecitpro`
**PostHog project ID:** `288454`
**PostHog host:** `https://us.posthog.com`

---

## Why we have these specific dashboards

When the COA 4 mission shipped, three failure modes became simultaneously possible:
1. **Product fails to convert** — pricing wrong, onboarding broken, or value prop unclear
2. **AI quietly degrades or eats money** — failures spike, costs blow past margin assumptions, tier routing breaks
3. **Platform scans silently fail** — a scraper breaks, customers see empty monitors, we don't know until they email support

Each dashboard targets one of those failure modes. Together they cover the operational surface of the product without information overload — three dashboards is what an operator can reasonably check in five minutes.

**The dashboards are operational health, not product quality.** They tell us things are *running* — not whether they're *good*. Quality measurement lives in:
- The CI eval gate (`src/__tests__/ai/eval-runner.ts` — catches AI quality regressions before merge)
- The smoke test (`scripts/smoketest-monitor.ts` — catches scope drift between spec and implementation in production)

Use all three layers. None of them alone caught the W2.6 scope bug we found 2026-04-23 — only the manual probe did.

---

## Dashboard 1: Activation Funnel

**URL:** https://us.posthog.com/project/288454/dashboard/1500765
**Question it answers:** "Of the people who walk in the door, how many become paying customers — and where do they fall off?"
**Check this:** weekly, Mondays. After every pricing or onboarding change.

### Insights

| Insight | What it shows | Healthy range | Action when it breaks |
|---------|---------------|---------------|----------------------|
| Activation funnel (last 30d) | 5-step funnel: signup → monitor → scan → result viewed → conversion | 30-50% signup→monitor, 70%+ monitor→scan, 60%+ scan→result, 5-10% to paid | If signup→monitor < 30%, the onboarding wizard is broken. If scan→result < 60%, scans are slow/empty. If result→paid < 3%, the upgrade prompt isn't compelling. |
| Daily signups | Count of `user_signed_up` events per day | Steady or growing | Sudden zero = signup form broken. Steady drop = marketing channel dying. |
| Daily monitors created | Count of `monitor_created` events per day | ~70% of signups (smoothed 7d) | Far below signup count = first-run UX failure. Open the onboarding-wizard data and look for the step where users abandon. |
| Daily conversions | Count of `subscription_created` events per day | At least 1 per active marketing day | **Two zero days in a row = checkout broken.** This is your alarm event. Verify Polar webhooks are still firing. |
| Daily Day Pass purchases | Count of `day_pass_purchased` events per day | Some weekly volume | Zero = either $15 price wrong or Day Pass UI is hidden. |

### What "good" looks like at scale
For 100 signups/week (typical SMB SaaS at this stage):
- ~50 create a monitor (50% activation)
- ~35 see at least one result (70% scan completion)
- ~20 view a result detail (60% engagement)
- ~3-5 convert to paid (15-25% of viewers convert; 3-5% of total signups)

If you're at 100 signups and 0 paid, something is structurally wrong. Below 1% conversion = the funnel needs work, not the marketing.

### When to escalate
- **3 consecutive days of zero conversions** with non-zero signups → check Polar webhook delivery in Polar dashboard
- **Signup count drops to zero** → check Clerk dashboard for auth incidents
- **Monitor creation rate drops below 20%** → first-run experience regression; spot-check the onboarding chat

---

## Dashboard 2: AI Health

**URL:** https://us.posthog.com/project/288454/dashboard/1500768
**Question it answers:** "Is the AI delivering useful output, reliably, and within budget?"
**Check this:** after every PR that touches `src/lib/ai/*`, daily otherwise.

### Insights

| Insight | What it shows | Healthy range | Action when it breaks |
|---------|---------------|---------------|----------------------|
| AI analysis volume by tier | `ai_analysis_completed` events broken down by `plan` property | Roughly proportional to active users in each tier | A tier with 0 calls = the analyze function isn't running for them. A tier with 100x expected = runaway loop or webhook duplication. |
| AI failures by tier | `ai_analysis_failed` events broken down by `plan` | <2% failure rate | Spike = model down, prompt schema drift, or rate-limited at OpenRouter. Page if it crosses 5%. |
| Tier downgrade events (Sonnet → Flash) | `ai_analysis.tier_downgrade` count | Currently zero (Sonnet routing parked since 2026-04-22 revert in PR #207) | If non-zero with current config, that's a code bug — we're not supposed to be calling Sonnet. |
| AI cost cap hits | `ai_cost_cap_reached` events | 0-1% of paid users hitting cap on any given day | Spike = cost cap is too low for real usage. That user can't get analyses for the rest of their day. Either bug, abuse, or under-priced cap. Tune via `KAULBY_{SOLO,SCALE,GROWTH}_DAILY_AI_BUDGET_USD` env vars. |
| Eval baseline regressions | `ai_eval_regression` events | Zero | Should always be zero on main — the CI eval gate is supposed to catch regressions at PR time. If non-zero on main, the gate failed and we shipped degraded AI quality anyway. |

### Per-tier daily AI budgets (current as of 2026-04-23)
- Solo: $1/day (`KAULBY_SOLO_DAILY_AI_BUDGET_USD`)
- Scale: $2/day (`KAULBY_SCALE_DAILY_AI_BUDGET_USD`)
- Growth: $5/day (`KAULBY_GROWTH_DAILY_AI_BUDGET_USD`)

Defined in `src/lib/ai/rate-limit.ts`. Override via env without redeploy.

### When to escalate
- **Failure rate >5% sustained** across any tier → page someone, AI is broken
- **Cost cap hits >5% of paid users for >24hr** → either a runaway monitor (one user generating 100x normal volume) or the cap is misconfigured. Investigate the user with most cost first.
- **Volume drops to zero on any tier** → analyze function isn't routing to that tier; check getEffectiveTier logic
- **Eval regression event on main** → revert the offending PR; the CI gate should have caught it

---

## Dashboard 3: Scan Reliability

**URL:** https://us.posthog.com/project/288454/dashboard/1500769
**Question it answers:** "Are platform scans actually working, and which ones are silently failing?"
**Check this:** after any "my monitor isn't returning anything" report. Daily glance recommended.

### Insights

| Insight | What it shows | Healthy range | Action when it breaks |
|---------|---------------|---------------|----------------------|
| Scans completed by platform | `scan.completed` events broken down by `platform` | Steady volume across enabled platforms | A platform going to zero = its scraper or API broke silently. We won't know from user complaints because monitors just appear "quiet." This dashboard is the early warning. |
| Scan failures by platform | `scan.failed` events broken down by `platform` | <5% per platform | App Store at 50% = Apple changed HTML. Reddit at 30% = Apify actor degraded. Each spike has its own runbook (see `reddit-safety.md`, etc.). |
| Reddit Apify circuit-breaker trips | `reddit.apify_degraded` count | A few per week is normal (transient Apify issues). Sustained = Apify Reddit actor broken or our key is over quota. | Falls back to public JSON scraping (see `reddit-safety.md`). Users still get results, but margins shrink. Investigate by checking Apify dashboard for actor health. |
| Indie Hackers fetch outcomes | `ih_fetch` event with 5 outcomes: feed_ok, feed_empty, feed_fail_scrape_ok, feed_fail_scrape_empty, all_failed | feed_ok > 95% | If feed_ok drops below 80% sustained for 7 days → time to ship the deferred Crawlee custom actor (per `kaulby-deferred.md`). |
| GitHub webhook deliveries received | `github_webhook.received` count | Few per day per active GitHub monitor; spiky around repo activity | Zero with active monitors = either the webhook receiver is down OR users haven't actually configured their GitHub webhooks (Solo/Scale education issue). Check `monitorId` distribution in PostHog event properties to differentiate. |

### When to escalate
- **Any platform at zero scans for >24hr** with active monitors using it → that platform's scraper is broken. Open its module (`src/lib/inngest/functions/monitor-{platform}.ts`) and check for recent breakage.
- **Reddit Apify circuit-breaker trips >10/day sustained** → page someone; Reddit is our highest-volume platform and degraded mode costs more
- **IH feed_ok drops below 80%** → Indie Hackers feed format probably changed; ship the Crawlee fallback

---

## Operational sequence — when to check which

| Trigger | First dashboard to open |
|---------|------------------------|
| "My monitor returned no results" support ticket | Scan reliability — find which platform died |
| "I can't sign up" or "checkout failed" report | Activation funnel → look at Daily signups + Daily conversions trends |
| "AI summaries look weird" report | AI health → check failure rate; then run `scripts/smoketest-monitor.ts` for qualitative check |
| Monthly business review | Activation funnel for conversion rate; AI health for cost-vs-revenue ratio |
| Post-deploy of any AI-prompt change | AI health → watch volume + failure rate for 24hr |
| Post-deploy of any pricing change | Activation funnel → watch conversion rate for 7-14 days |
| Daily standup / sanity check | Glance at all 3; you're looking for shapes, not specific numbers |

---

## Re-running the setup script

If a dashboard gets accidentally deleted or you want to add a new insight:

```bash
# Requires POSTHOG_PERSONAL_API_KEY (phx_...) in .env.local
# Required PostHog scopes (all read+write where applicable):
#   dashboard, insight, query, person, cohort, feature_flag, experiment,
#   session_recording (read), annotation, notebook, event_definition (read),
#   property_definition (read), sharing_configuration, subscription,
#   survey, LLM analytics (read), LLM prompt, LLM skill (read), comment, alert (read)

pnpm tsx scripts/setup-posthog-dashboards.ts
```

The script is idempotent — it'll skip dashboards/insights that already exist by exact name match.

To add a new insight: edit `scripts/setup-posthog-dashboards.ts`, add a `createInsight()` call to the appropriate dashboard section, re-run the script.

---

## Known limitations / gotchas

- **PostHog `?dashboards=N` filter on the insights list endpoint 500s server-side.** The script works around this by listing project-wide insights once per run and deduping client-side. Don't try to use the filter directly.
- **Project-scoped tokens (the only kind we have) need `@current` literal in URLs**, not the numeric project ID. Trying to hit `/api/projects/{id}/...` with a project-scoped token gets `permission_denied`. Use `/api/projects/@current/...`.
- **Dashboards take 24-48 hours to populate meaningfully** because they query 30-day windows. Empty charts on day 1 are expected, not broken.
- **Some events shown in the dashboards aren't yet wired in code** (e.g., `ai_eval_regression` may be aspirational depending on the eval gate's instrumentation). When an insight shows perpetual zero, check that the underlying event actually fires — search `captureEvent` for the event name.

---

## Related runbooks
- [reddit-safety.md](./reddit-safety.md) — Reddit Apify + public JSON fallback architecture
- [github-webhooks.md](./github-webhooks.md) — GitHub real-time event handling
- [inngest-drain.md](./inngest-drain.md) — what to do if Inngest function backlog grows
- [scripts-inventory.md](./scripts-inventory.md) — index of operational scripts (smoketest, audit, cleanup, polar/posthog setup)
