# Reddit Safety Runbook (R12)

Operational policy for Kaulby's Reddit data path. Read before touching `src/lib/reddit.ts`, `src/lib/inngest/functions/monitor-reddit.ts`, or any code that fetches Reddit content. Applies always, not just during COA 4 execution.

---

## Why this runbook exists

GummySearch was at **$35K MRR** when Reddit demanded a commercial API license in Nov 2025. They couldn't reach agreement on terms and chose to responsibly shut down rather than operate non-compliantly. Then **Reddit v. SerpApi (Oct 2025)** applied DMCA §1201 to `site:reddit.com` SERP scraping. These events together make the Reddit data path the single highest legal-risk surface in Kaulby's architecture.

This runbook codifies the choices that keep Kaulby out of that hot zone.

---

## Current architecture (as of 2026-04-22)

Per `src/lib/reddit.ts` and PR #195 (`.mdmp/reddit-spike-results-2026-04-21.md`):

### Priority chain

1. **Apify `automation-lab/reddit-scraper`** (PRIMARY)
   - Pay-per-event: `$0.003/run start + $0.00115/post + $0.000575/comment` at FREE plan
   - Measured cost: **~$1.15 per 1,000 posts**
   - Why primary: Apify absorbs ToS risk contractually; no direct Reddit scraping from Kaulby IP
   - Failure mode: circuit breaker opens after 3 consecutive errors, cooldown 5 min

2. **Reddit Public JSON** (`/r/<sub>/search.json`, `/new.json`) — FALLBACK
   - Rate limit: ~60 req/min per IP (observed; not contractually guaranteed)
   - UA policy: `User-Agent: Kaulby/1.0` (identifies us; Reddit has historically tolerated identified traffic at low volume)
   - Handles 429/503 with exponential backoff: 1s / 2s / 4s / Retry-After header
   - No comments (JSON endpoint serves posts only)

3. **Reddit public search (`reddit.com/search.json`)** — DMCA-safe cross-subreddit search
   - `searchRedditPublicSiteWide(keywords, limit)` in `src/lib/reddit.ts`
   - Uses Reddit's OWN API (not Serper/Google), so no DMCA §1201 exposure
   - Used when subreddit-picker-based searches return zero matches (via fallback
     in both `monitor-reddit.ts` cron and `scan-on-demand.ts` on-demand path)
   - ~60 req/min rate limit (same class as public JSON)

**Deleted 2026-04-23:** the legacy Serper-based Reddit paths (`searchRedditSerper`,
`searchRedditSiteWide`, `KAULBY_ALLOW_SERPER_REDDIT` env gate). They had been
disabled since PR #195 (2026-04-21) and kept as "emergency opt-in" dead code —
that made them a footgun risk. The new public search.json endpoint covers the
same use case without DMCA exposure. See commit history if you ever need to
restore that path — easier to re-add than to accidentally re-enable the
DMCA-risky one.

### Per-tier cadence (target after COA 4 W2.1)

| Tier | Default cadence | Hot-subreddit cadence | Source mix |
|---|---|---|---|
| Free | 24hr | — | Apify primary, public JSON on failure |
| Pro | 6hr | — | Apify primary, public JSON on failure |
| Team | 4hr | 15min (workspace-configurable) | Apify primary + Public JSON watermark supplement for hot subs every 60s |

"Hot subreddits" are opted in per-workspace — tentatively a flag on the monitor's sources list. Keeps Apify costs bounded.

---

## Hard rules

These are codified in `src/lib/reddit.ts` and verified by tests in `src/lib/__tests__/reddit.test.ts`.

1. **Never fetch Reddit directly without a User-Agent.** Anonymous `fetch()` to reddit.com without a UA has been selectively blocked by Reddit in 2024-2025. Always set `User-Agent: Kaulby/1.0` or equivalent.

2. **Never exceed ~60 req/min from a single IP** to the Public JSON endpoint. Our backoff is tuned to stay well under this, but if you're adding a new caller, budget for coexistence.

3. **Never re-introduce Serper-based Reddit scraping.** The `KAULBY_ALLOW_SERPER_REDDIT` gate and `searchRedditSerper` function were deleted 2026-04-23. If you need cross-subreddit keyword search, use `searchRedditPublicSiteWide` (Reddit's own search.json endpoint — DMCA-safe). See `.mdmp/apify-platform-cost-audit-2026-04-21.md` for the legal context.

4. **Never bypass the circuit breaker.** If Apify is failing, the fallback chain exists for a reason. Don't add retry-after-cooldown logic that pretends the breaker isn't open.

5. **Never write comments or posts via the Public JSON endpoint.** It's read-only for us. Writes would require OAuth and trigger Reddit's enforcement.

6. **Never log raw post content with PII.** Redact user handles in debug logs where practical. Reddit usernames are technically public but treating them carefully reduces friction in any future dispute.

---

## Decision: Why we rejected the OAuth firehose

Before PR #195, the plan was to migrate Reddit to OAuth-authenticated API access with `/new` firehose endpoints. We rejected this because:

- **Reddit's paid Data API** (post-Apollo, 2023+) requires commercial sign-off that small operators rarely get. GummySearch was $35K MRR and still couldn't get terms.
- **OAuth rate limits** (100 req/min for free self-service dev apps) don't fit our workspace-multiplier scale.
- **Terms review** for commercial use is discretionary and can change. Apify absorbs that contractually on our behalf.
- **The trap** (see `docs/planning/kaulby-backlog.md` §"Reddit OAuth Setup"): the "Reddit Data API access request" form routes to sales, not the self-service developer app flow. It ghosts most applicants.

Apify isn't free — ~$1.15/1K posts at the FREE plan — but it's legally clean and the unit economics are workable when shared-scan dedup (PR-E.1) lands.

---

## What to do if Reddit enforcement escalates

Scenarios and responses:

### Scenario 1 — Apify actor stops returning results

- Circuit breaker opens after 3 errors; scans fall back to Public JSON automatically
- Investigate: is `automation-lab/reddit-scraper` down? Check [Apify status](https://status.apify.com/)
- If actor is permanently broken: switch `ACTORS.reddit` in `src/lib/apify.ts` to a comparable actor (tested alternatives: `trudax/reddit-scraper`, `pocesar/reddit-scraper`). Update cost math.

### Scenario 2 — Reddit blocks our Public JSON UA

- Rotate UA string in `src/lib/reddit.ts` `searchRedditPublic()` fetch headers
- Back off aggressively: drop hot-sub cadence from 60s to 5min
- If block persists >24hr: this is a serious escalation. Pause Reddit scans (set `KAULBY_REDDIT_PAUSED=true` feature flag) and consult legal before resuming.

### Scenario 3 — Reddit sends a cease-and-desist

- **Immediately:** pause all Reddit scans (`KAULBY_REDDIT_PAUSED=true`)
- Freeze Apify actor usage (set `ACTORS.reddit` to `null` or the pause-valve)
- Legal review before any response
- Document in an incident report under `.mdmp/incidents/`

### Scenario 4 — Apify gets sued and shuts down reddit-scraper actors

- Similar to Scenario 1 but permanent. Fall back to Public JSON as primary until a new plan is formed.
- Public JSON alone can sustain Free + Pro tier scan volume; Team tier hot-sub cadence would need to drop.

---

## Legacy Serper path (DELETED 2026-04-23)

The `KAULBY_ALLOW_SERPER_REDDIT` env gate and its associated functions
(`searchRedditSerper`, legacy `searchRedditSiteWide`) were deleted from
`src/lib/reddit.ts` 2026-04-23. Rationale:

- They had been DISABLED by default since PR #195 (2026-04-21)
- Keeping disabled dead code in the codebase is a footgun — someone could
  re-enable by typing `true` into a production env var
- The new `searchRedditPublicSiteWide` function (using Reddit's own
  `/search.json` endpoint) covers the same "cross-subreddit keyword search"
  use case without DMCA §1201 exposure
- Git history preserves the implementation if ever needed back

**If you're looking for cross-subreddit search:** use
`searchRedditPublicSiteWide(keywords, limit)`. It's DMCA-safe (Reddit's own
endpoint) and returns the same `RedditSearchResult` shape.

**If you're in a true emergency** (Apify down + Public JSON blocked + need
site-wide search): the Serper code is recoverable via git log — specifically
the commits prior to the 2026-04-23 cleanup PR. But legal sign-off
requirements still apply.

---

## References

- `.mdmp/reddit-spike-results-2026-04-21.md` — Reddit scraper cost spike (corrected $1.15/1K number)
- `.mdmp/apify-platform-cost-audit-2026-04-21.md` — 17-platform cost + legal-risk audit; Reddit row
- `docs/planning/kaulby-backlog.md` §"Reddit Safety Policy" — hard rules duplicated for commander quick-read
- `docs/planning/kaulby-improve.md` — GummySearch shutdown analysis + verified Reddit partner list
- PR #195 — Reddit automation-lab swap (source-of-truth commit for current architecture)
- [Reddit v. SerpApi complaint (Oct 2025)](https://www.courtlistener.com/docket/) — public docket; search for "Reddit Inc v. SerpApi"
- [Google v. SerpApi complaint (Dec 2025)](https://www.courtlistener.com/docket/) — companion case
- [Apify status page](https://status.apify.com/) — for Scenario 1 triage

---

**Created:** 2026-04-22 (COA 4 W2.3)
**Owner:** Engineering
**Review cadence:** quarterly, or immediately when any Scenario above fires.
