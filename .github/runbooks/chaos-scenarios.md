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
