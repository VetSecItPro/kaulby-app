# Chaos Scenario Playbook

**What this is:** the catalog of failure modes Kaulby has either deliberately
tested or accidentally experienced, with the detection signal and recovery
procedure for each. W4.3 of COA 4 launch prep asks us to confirm each
scenario's detection + recovery works. This doc is the durable record.

**When to use this:**
- Before launch, to go down the list and confirm each detection signal is wired
- During an incident, to identify which known class the failure belongs to
- When onboarding an operator, as the map of "how we'll know when things break"

**Living document:** as new failure classes emerge (and they will), add rows
here with the same shape: *symptom → detection signal → recovery procedure*.

---

## Scenario 1: `analyze-content` function deploy-orphan

**Last observed:** 2026-04-23 (PR #220 deploy caused 4-hour outage)
**Incident class:** Inngest function registered in manifest count but flagged
"Function not yet deployed to this environment" — events queue with zero runs.

### Symptom
- Monitors scan successfully (results land in DB)
- `content/analyze` events fire to Inngest (confirmable via REST API)
- But `aiLogs` table gets zero new rows → summaries never populate
- User-facing: results appear in dashboard without AI summaries

### Detection signal (PRIMARY)
**AI quality canary hard floor:** `ai_logs_count_since_run_start >= 1`. The
canary fires every 6 hours, scans a dedicated monitor, counts new `aiLogs`
rows since run start. Zero → Sentry page.

See `.github/runbooks/ai-quality-canary.md` for the full canary spec.

### Detection signal (SECONDARY)
PostHog dashboard `Scan reliability` → `AI quality canary passes` insight
should show 4 passes per day. Any tick missing → canary itself couldn't run,
investigate Inngest function health.

### Recovery procedure
1. Confirm in Inngest dashboard: Functions → analyze-content → shows
   "Function not yet deployed" banner → it IS the orphan state
2. Bump the function's `name` field (e.g., "Analyze Content" → "Analyze
   Content (v2)") — single-line code change
3. Deploy + click Resync in Inngest dashboard (or `PUT /api/inngest` via
   our endpoint, which triggers the SDK to re-register)
4. Verify function count in `curl https://kaulbyapp.com/api/inngest`
   increments by 1 (new registration doesn't replace orphaned one, it adds)
5. Fire `scripts/fire-canary.ts` to validate the pipeline end-to-end
6. Revert the name bump in a follow-up PR once confirmed stable

**Time to recover (observed):** ~15 min from PR to merged fix.

---

## Scenario 2: OpenRouter provider outage (Flash specifically)

**Last observed:** never (theoretical — test during chaos window)
**Incident class:** upstream LLM provider returns 5xx or times out.

### Symptom
- AI analyses start failing
- `ai_analysis_failed` events spike in PostHog `AI Health` dashboard
- User-facing: results populate but with `sentiment=null` and missing summaries

### Detection signal
- **AI Health dashboard:** `AI failures by tier` chart spiking >5% per tier
- **Canary hard floor:** if failure rate is 100%, canary will see zero fresh
  AI summaries in its 4-minute poll window → `ai_logs_count` could still be
  > 0 (from retry attempts) but `persona_rate` becomes 0 because there's
  no output to probe

### Recovery procedure
1. Check https://openrouter.ai/status
2. If outage confirmed: wait. The analyze-content function has `retries: 2`
   so transient failures are absorbed. For extended outages, consider
   temporarily routing to a different model via `KAULBY_TEAM_MODEL_OVERRIDE`
   env var (hot config, no redeploy)
3. Do NOT switch models permanently — the current prompts are calibrated
   for Gemini Flash per the 2026-04-23 reverted-Sonnet memory

---

## Scenario 3: Reddit Apify actor degraded

**Last observed:** occasionally (few times per month at 2026-04 rate)
**Incident class:** Apify's automation-lab/reddit-scraper actor returns
empty results, 500s, or hits Apify concurrency limits.

### Symptom
- Reddit scans complete but return 0 posts
- Other platforms (GitHub, HN, etc.) continue working

### Detection signal
- PostHog `Scan reliability` → `Reddit Apify circuit-breaker trips` insight
- The circuit breaker at `src/lib/reddit.ts` auto-degrades to Public JSON
  after 3 consecutive failures (non-blocking recovery)

### Recovery procedure
1. Check Apify dashboard: https://console.apify.com/
2. If actor health is red: the circuit breaker is already falling back to
   Public JSON. Results continue but with different rate limits.
3. If Public JSON is also failing: last-resort Serper can be enabled via
   `KAULBY_ALLOW_SERPER_REDDIT=true` (Oct 2025 DMCA risk — see
   `reddit-safety.md` for full context)
4. No immediate code action needed — circuit breaker handles it

See `.github/runbooks/reddit-safety.md` for the full resilience story.

---

## Scenario 4: Polar webhook delivery delayed or missed

**Last observed:** never directly (tested via fixture flows)
**Incident class:** Polar sends webhook event → our `/api/polar/webhook`
endpoint doesn't receive it → user's subscription status out of sync.

### Symptom
- User completes checkout in Polar but their Clerk metadata still shows free
- Or: user cancels but keeps paid access past their paid period

### Detection signal
- Activation funnel PostHog dashboard: `subscription_created` events drop to
  zero for >3 consecutive days (manual check on weekly)
- User support: "I paid but I'm still on free tier" tickets

### Recovery procedure
1. Check Polar dashboard webhook delivery log for failed/missed events
2. Manually reconcile via `scripts/test-polar-checkout.ts` (modify to sync
   mode, not test mode — one-off)
3. For chronic issues, Polar supports webhook retry — configure in dashboard

---

## Scenario 5: Inngest plan concurrency ceiling hit

**Last observed:** 2026-04-23 (github-webhook-processor was at concurrency=10,
plan limit is 5, blocked entire app resync)

### Symptom
- `scripts/fire-canary.ts` or any resync returns "concurrency exceeds limit"
- No functions run at all — full app sync is blocked
- Inngest dashboard shows validation error on app version

### Detection signal
- Manual: resync fails with visible error in dashboard
- Automatic: no canary data appearing means functions aren't firing; check
  Inngest app health

### Recovery procedure
1. Find the offending function: grep for `concurrency.*limit` across
   `src/lib/inngest/functions/*.ts`, identify any > 5
2. Cap it at 5 in code, deploy, resync
3. Fixed historically in PR #219 for github-webhook-processor (10→5)

---

## Scenario 6: URL-required scrapers silently skip (yelp, g2, amazon, playstore)

**Last observed:** 2026-04-23 (discovered via platform integration test)
**Incident class:** 4 review-platform scrapers require specific URLs/IDs
(business URLs, product URLs, ASINs, app package names) but silently
`continue` if the monitor has only a company name. Users creating monitors
with just a keyword get zero results with zero indication why.

### Symptom
- Monitor shows active and `lastCheckedAt` recent
- `newMatchCount = 0` persistently across many scans
- No error in `lastCheckFailedReason`
- No results written to DB

### Detection signal (new as of 2026-04-23)
`lastCheckFailedReason` now populates with `[platform] MissingInput: <platform> requires X` when these scanners skip due to missing URL. See PR #239 for the fail-loud fix across monitor-yelp / monitor-g2 / monitor-amazon / monitor-playstore.

### Recovery procedure
1. Populate `monitor.platformUrls.{yelp|g2|amazonreviews|playstore}` with the required identifier:
   - Yelp: full URL like `https://www.yelp.com/biz/starbucks-seattle-3`
   - G2: full URL like `https://www.g2.com/products/slack/reviews`
   - Amazon: product URL or ASIN like `B0D1XD1ZV3`
   - Play Store: URL like `https://play.google.com/store/apps/details?id=com.spotify.music` or just `com.spotify.music`
2. Next scan cycle will pick up the populated URL and fire the scraper

---

## Scenario 7: Reddit scanner picks wrong subreddits (keyword-heavy brands)

**Last observed:** 2026-04-23 (diagnosed via direct probe + platform integration test)
**Incident class:** Reddit monitor's AI subreddit picker sometimes returns
generic subs (r/technology, r/AskReddit) that don't contain brand-specific
content. Direct probe: r/technology with Tesla keywords = 0/10 match;
r/teslamotors = 7/10 match.

### Symptom
- Reddit scans complete (`lastCheckedAt` fresh)
- 0 results despite brand clearly being discussed on Reddit
- No error recorded — scanner "worked," just no matches

### Detection signal
- No automated one — brand visibility dashboards would need cross-reference
  against independent measures (Google Trends, mention volume elsewhere)
- Manual: user reports "my monitor isn't catching obvious mentions"

### Recovery (fixed 2026-04-23 in PR #239)
New `searchRedditPublicSiteWide()` function in `src/lib/reddit.ts` performs
site-wide keyword search via Reddit's own public JSON endpoint (NOT Serper —
no DMCA risk). Monitor-reddit.ts falls through to this when subreddit-picker
results return zero matches. Validated: 20 posts per keyword for Tesla,
Starbucks, Kubernetes, iPhone 15 Pro.

---

## Scenario 8: Hashnode GraphQL schema change

**Last observed:** 2026-04-23
**Incident class:** Hashnode removed `searchPostsOfFeed` from their public
GraphQL schema. Our monitor-hashnode.ts had been calling a dead field for
an unknown period, returning 0 results without errors.

### Symptom
- Monitor-hashnode completes with no results
- GraphQL returns 400 with "Cannot query field 'searchPostsOfFeed' on type 'Query'"

### Detection signal
Now: scan.failed events from the catch block capture the 400. Also visible
in `lastCheckFailedReason`.

### Recovery (fixed 2026-04-23 in PR #239)
Switched from the deprecated text-search query to `feed(type: RELEVANT)` +
client-side keyword filter. Hashnode's current public API has no platform-
wide text search — the feed-filter-client-match pattern is the only option
until they restore search. Monitor periodically for schema restoration.

---

## Scenario 9: xAI account state issues (no credits, deprecated models)

**Last observed:** 2026-04-23 (twice — no credits, then wrong model)
**Incident class:** xAI's team-level credit/license gating returns 403 even
with a valid API key. Separately, `grok-3-fast` was deprecated for server-
side tool use (must use `grok-4` family).

### Symptom
- `monitor-x` returns 0 results
- `searchX()` returns with error field set
- Error text references credits OR "model not supported when using
  server-side tools"

### Detection signal (new as of 2026-04-23)
`lastCheckFailedReason` populates with `[x] xAI: <error>` — PR #239 added
`trackScanFailed()` to the silent-skip path. Previously zero indication.

### Recovery procedure
1. If credits issue: https://console.x.ai/ → Team → Billing → Add credits ($10-50 minimum)
2. If model deprecation: update `model:` in `monitor-x.ts` to a `grok-4-*` variant (currently `grok-4-latest`)
3. Cost warning: at ~$0.04/call per X scan, X is Growth-tier-only as of PR #239. Don't re-enable at lower tiers without Apify-based scraper migration.

---

## Acceptance for W4.3 launch prep

For each scenario in this playbook, before launch verify:
- [x] **Scenario 1 (analyze-content orphan):** detection signal is LIVE via
      the canary (PR #222 onwards). Observed in production 2026-04-23, fix
      verified working.
- [ ] **Scenario 2 (OpenRouter outage):** detection signal is LIVE via
      AI Health dashboard. Not deliberately tested — theoretical.
- [x] **Scenario 3 (Reddit Apify degraded):** circuit breaker verified working
      via observed trips. Fallback to Public JSON tested in production.
- [ ] **Scenario 4 (Polar webhook):** theoretical. Test via
      `scripts/test-polar-checkout.ts` before launch.
- [x] **Scenario 5 (Inngest concurrency ceiling):** fixed in PR #219,
      documented here. Guardrail: lint rule blocking concurrency > 5 would
      prevent future occurrences (not yet implemented — future task).
- [x] **Scenario 6 (URL-required scrapers silent skip):** fail-loud fix
      shipped in PR #239 for yelp/g2/amazon/playstore. Users now see
      MissingInput errors in `lastCheckFailedReason`.
- [x] **Scenario 7 (Reddit wrong subreddits):** site-wide public search
      fallback shipped in PR #239 via new `searchRedditPublicSiteWide()`.
- [x] **Scenario 8 (Hashnode schema change):** fixed in PR #239 by
      switching to `feed()` + client-side keyword filter.
- [x] **Scenario 9 (xAI credits/model):** detection added in PR #239.
      Recovery requires manual action (add credits or update model name).
      X moved to Growth-tier-only to protect margins.
