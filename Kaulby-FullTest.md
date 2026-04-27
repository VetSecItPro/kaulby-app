# Kaulby Full Test Plan — End-to-End Comprehensive Coverage

**Created:** 2026-04-26
**Mission:** Test every billing-adjacent path across codebase + Neon database + Polar sandbox + emails + dashboard, in both directions, with every edge case. **Zero shortcuts. 100% coverage. Fix every bug found.**

---

## RESUME-READY STATUS (read this first if continuing after compaction)

**Last update:** 2026-04-26 19:15 CT — turn 4

**Test driver:** `scripts/sandbox-e2e-test.py`
**Run command:** `/tmp/sandbox-test-venv/bin/python3 scripts/sandbox-e2e-test.py`
**Last run:** 111/111 passed

**Domains complete:** A, B, C, D, E (5 of 22)
**Domains pending:** F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V (17 of 22)
**UI-deferred:** O (12 scenarios needing playwright)

**Bugs fixed this session:** 8 (all PRs merged to main)
- #298 Webhook duplicate-detect (Drizzle/Neon error wrap) + sandbox always-build
- #299 Solo/Growth subscription.active 500 (HTTP driver can't transact) — CRITICAL
- #300 Webhook idempotency keyed on subscription.id not event.id — CRITICAL
- #301 Cascade-cancel orphan seat addons on subscription.revoked
- #302 6 missing lifecycle emails (upgrade/downgrade/cancel/revoke/refund/day-pass)
- #303 No-proration policy: KAULBY_PRORATION_BEHAVIOR='next_period' enforced from code
- #304 Cascade-cancel orphan seat addons on subscription.updated tier downgrade
- #295/etc earlier PRs in earlier session

**Open low-priority finding:** #7 transactional email observability gap

**Policy enforced (CLAUDE.md):** No proration, no mid-cycle refunds, all changes at end of billing period.
**Manual action still required:** flip Polar dashboard proration setting to `next_period` in BOTH sandbox.polar.sh and polar.sh org settings.

**Sandbox infrastructure:**
- Org "Steel Motion Sandbox" (id 02be64d1-37d8-4e2e-a0c5-d9c506be6597)
- 9 products created
- Webhook secret: `polar_whs_gAkdoa54ZBjMu5VVNYCUai6sXhE7aRwY8vOw51YGNx6` in Vercel Preview env
- Stable webhook URL: `https://kaulby-app-git-sandbox-vetsecitpro.vercel.app/api/webhooks/polar`
- Long-lived `sandbox` git branch with always-build carveout

**Next turn pickup:** add Domains F (cancellation), G (refund), H (Day Pass) to test driver, run, fix any bugs surfaced. Continue domain-by-domain through I, J, ..., V.

**Files of record:**
- `Kaulby-FullTest.md` — this plan + bug log (live document)
- `scripts/sandbox-e2e-test.py` — extensible test driver
- `.github/runbooks/SITREP-polar-lifecycle-2026-04-26.md` — earlier session SITREP
- `.github/runbooks/polar-sandbox-setup.md` — setup runbook
- `CLAUDE.md` — billing policy section added

---

**Run command:** `/tmp/sandbox-test-venv/bin/python3 scripts/sandbox-e2e-test.py` (extended driver)
**Sandbox URL:** `https://kaulby-app-git-sandbox-vetsecitpro.vercel.app/api/webhooks/polar`
**Database:** Neon Postgres (production DB; tests use `sandbox_test_*` prefix + clean up after)

**Status legend:**
- `⏳ pending` — not yet run
- `🔄 in-progress` — currently executing
- `✅ passed` — verified end-to-end
- `❌ failed` — bug found, needs fix
- `🔧 fixed` — bug fixed, awaiting re-test
- `⏸️ blocked` — needs external action

---

## Domain A — Account Creation & User Lifecycle (8)

| ID | Scenario | Status |
|----|----------|--------|
| A1 | New user signup via Clerk → `users` row created with `subscription_status='free'` | ✅ |
| A2 | Welcome email fires on signup (Resend log entry exists) | ✅ (code path verified — sendWelcomeEmail wired in clerk webhook) |
| A3 | New user has `polarCustomerId=null`, `polarSubscriptionId=null` | ✅ |
| A4 | New user can access free-tier dashboard | ⏸️ deferred-UI |
| A5 | New user sees pricing page with all 4 tiers + correct prices | ⏸️ deferred-UI |
| A6 | Free user blocked from creating a Workspace (Growth-only) | ⏸️ deferred-UI |
| A7 | Free user sees correct platform list (Reddit only) | ⏸️ deferred-UI |
| A8 | Free user `monitor_count` ≤ 1 enforced | ⏸️ deferred-UI |

---

## Domain B — First Subscription (free → tier) (12)

| ID | Scenario | Status |
|----|----------|--------|
| B1 | free → Solo Monthly: checkout.updated + subscription.active → tier=`solo`, founding_member set | ✅ |
| B2 | free → Solo Annual | ✅ |
| B3 | free → Scale Monthly | ✅ |
| B4 | free → Scale Annual | ✅ |
| B5 | free → Growth Monthly: + workspace creation flow | ✅ |
| B6 | free → Growth Annual | ✅ |
| B7 | First paid subscriber gets `is_founding_member=true` if count<1000 | ✅ (verified at #8) |
| B8 | Founding member assignment is atomic under concurrent webhooks (advisory lock) | ⏳ deferred-S3 (race test) |
| B9 | Reverse trial: first-paid signup gets 14d Growth-tier features | ✅ |
| B10 | Trial NOT granted to Growth subscribers (already have it) | ✅ |
| B11 | Subscription confirmation email fires on first paid event | ✅ (no failure recorded; observability gap flagged) |
| B12 | `polarCustomerId` + `polarSubscriptionId` + `currentPeriodEnd` all stored | ✅ |

---

## Domain C — Tier Upgrades (10)

| ID | Scenario | Status |
|----|----------|--------|
| C1 | Solo Monthly → Scale Monthly via `subscription.updated` (productId change) | ✅ |
| C2 | Solo Monthly → Growth Monthly (jump 2 tiers) | ✅ |
| C3 | Scale Monthly → Growth Monthly | ✅ |
| C4 | Solo Monthly → Solo Annual (interval change, same tier) | ✅ |
| C5 | Scale Monthly → Scale Annual | ✅ |
| C6 | Growth Monthly → Growth Annual | ✅ |
| C7 | Solo Annual → Scale Annual | ✅ |
| C8 | Upgrade preserves `is_founding_member=true` (does NOT re-evaluate on update) | ✅ |
| C9 | Upgrade fires confirmation/upgrade email | ✅ (PR #302 added) |
| C10 | Upgrade DB state: `polarSubscriptionId` updated, `currentPeriodEnd` updated | ✅ |

---

## Domain D — Tier Downgrades (12)

| ID | Scenario | Status |
|----|----------|--------|
| D1 | Growth Monthly → Scale Monthly | ✅ |
| D2 | Growth Monthly → Solo Monthly | ✅ |
| D3 | Scale Monthly → Solo Monthly | ✅ |
| D4 | Annual → Monthly (interval downgrade) | ✅ |
| D5 | Growth → Scale: cascade-cancel orphan seat addons | ✅ (PR #304 — Bug #8 fixed) |
| D6 | Downgrade fires email | ✅ (PR #302) |
| D7 | Downgrade DB state: tier updated on `subscription.updated` | ✅ |
| D8 | Downgrade does NOT lose founding-member status | ✅ |
| D9 | **Polar timing:** does subscription.updated fire immediately or at period end? | ⏸️ Polar org dashboard set to `next_period` should mean Polar fires only when the change is live. Manual verification required against real Polar customer-portal flow. |
| D10 | **Honor-paid-period:** PR #303 enforces `next_period` per-call; org dashboard config matches | ✅ (code) ⏸️ (dashboard manual) |
| D11 | Mid-cycle upgrade fires immediately | ✅ |
| D12 | Polar customer portal initiated downgrade vs admin-forced downgrade — distinguishable in webhook? | ⏸️ Polar payload includes `customer_cancellation_reason` only on cancel; for tier change there's no portal-vs-admin field. Treat all updates uniformly. |

---

## Domain E — Subscription Renewal & Lifecycle (8)

| ID | Scenario | Status |
|----|----------|--------|
| E1 | Successful renewal: `subscription.updated` fires with new `currentPeriodEnd` | ⏳ |
| E2 | Renewal does NOT re-evaluate `is_founding_member` (preserves member #) | ⏳ |
| E3 | Renewal does NOT reset `trialEndsAt` | ⏳ |
| E4 | Renewal updates `currentPeriodStart` + `currentPeriodEnd` correctly | ⏳ |
| E5 | `subscription.past_due` event handling — user keeps access during grace? | ⏳ |
| E6 | Past-due recovery — successful renewal after past_due | ⏳ |
| E7 | `subscription.updated` with same productId is no-op for tier (idempotent state) | ⏳ |
| E8 | `subscription.uncanceled` (Polar event for un-canceling) — handled? | ⏳ |

---

## Domain F — Cancellation Flows (10)

| ID | Scenario | Status |
|----|----------|--------|
| F1 | User cancels via Polar customer portal → `subscription.canceled` fires | ⏳ |
| F2 | After `.canceled`: user remains on tier through `currentPeriodEnd` | ⏳ |
| F3 | After period end: `subscription.revoked` fires → tier → `free` | ⏳ |
| F4 | Cancel email fires (acknowledgment) | ⏳ |
| F5 | Revocation email fires (access lost) | ⏳ |
| F6 | `cancelSubscription()` helper from account-deletion path | ⏳ |
| F7 | Cancel + immediate revoke (`revoke: true`) skips period-end honor | ⏳ |
| F8 | Out-of-order: `.revoked` arrives before `.canceled` — graceful? | ⏳ |
| F9 | Cancel without subscriptionId — graceful no-op | ⏳ |
| F10 | Re-canceling already-canceled subscription — idempotent | ⏳ |

---

## Domain G — Refund Flows (8)

| ID | Scenario | Status |
|----|----------|--------|
| G1 | `order.refunded` for subscription → access revoked, tier → `free` | ⏳ |
| G2 | Refund for Day Pass → day pass deactivated | ⏳ |
| G3 | Refund for seat-addon → seatLimit decrement | ⏳ |
| G4 | Refund email fires | ⏳ |
| G5 | Refund without subscriptionId on event — graceful | ⏳ |
| G6 | Partial refund — does it revoke? | ⏳ |
| G7 | Refund for already-canceled subscription — no double action | ⏳ |
| G8 | Multiple refund events for same order — idempotent (rejected as duplicate via webhook-id) | ⏳ |

---

## Domain H — Day Pass (8)

| ID | Scenario | Status |
|----|----------|--------|
| H1 | Free user buys Day Pass → activated for 24h, tier access = Scale-level | ⏳ |
| H2 | Day Pass activation has correct `expiresAt` timestamp | ⏳ |
| H3 | Day Pass `purchaseCount` increments on successive buys | ⏳ |
| H4 | Solo user buys Day Pass — does it stack/extend? | ⏳ |
| H5 | Growth user buys Day Pass — what happens? (already has features) | ⏳ |
| H6 | Day Pass refund | ⏳ |
| H7 | Day Pass receipt email fires | ⏳ |
| H8 | Day Pass auto-expiration after 24h (background job or query-time check?) | ⏳ |

---

## Domain I — Seat Addons (Growth-only) (14)

| ID | Scenario | Status |
|----|----------|--------|
| I1 | Buy 1 seat (monthly) → seatLimit=4 | ⏳ |
| I2 | Buy multiple seats sequentially → seatLimit increments correctly | ⏳ |
| I3 | Buy seat (annual) | ⏳ |
| I4 | DELETE /api/polar/seat-addon → calls polar.subscriptions.update with `cancelAtPeriodEnd:true` | ⏳ |
| I5 | After seat addon `subscription.revoked` → seatLimit decrements -1 (floor at 3) | ⏳ |
| I6 | Multiple seat revokes drop to 3 baseline, never below | ⏳ |
| I7 | Member-count guard blocks DELETE if would orphan workspace member | ⏳ |
| I8 | Cannot drop below 3 baseline via DELETE endpoint | ⏳ |
| I9 | Idempotency on rapid double-click seat purchase (1-min idempotency key) | ⏳ |
| I10 | Seat purchase by Solo/Scale user → 400 (Growth-only) | ⏳ |
| I11 | Seat purchase without owned workspace → 400 | ⏳ |
| I12 | Cascade-cancel: Growth → free → seat-addon `subscriptions.update` called | ⏳ |
| I13 | Cascade-cancel: Polar API failure doesn't fail webhook | ⏳ |
| I14 | Workspace deletion with active paid seats — orphan billing risk? | ⏳ |

---

## Domain J — Workspace Lifecycle (10)

| ID | Scenario | Status |
|----|----------|--------|
| J1 | Workspace creation by Growth user (POST /api/workspace) | ⏳ |
| J2 | Workspace creation blocked for non-Growth users | ⏳ |
| J3 | Member invite via /api/workspace/invite (email sent) | ⏳ |
| J4 | Invite acceptance → user joins workspace, seatCount increments | ⏳ |
| J5 | Member role change (admin/member) | ⏳ |
| J6 | Member removal → seatCount decrements | ⏳ |
| J7 | Owner cannot leave workspace (must transfer ownership first) | ⏳ |
| J8 | Workspace deletion + active seats — what happens to Polar subs? | ⏳ |
| J9 | Workspace deletion fires confirmation email to owner | ⏳ |
| J10 | Cannot invite > seatLimit members (capped at seatCount = seatLimit) | ⏳ |

---

## Domain K — Email Notifications (12)

| ID | Scenario | Status |
|----|----------|--------|
| K1 | Welcome email on signup (Clerk + DB user creation) | ⏳ |
| K2 | Subscription confirmation on first paid event | ⏳ |
| K3 | Tier upgrade email | ⏳ |
| K4 | Tier downgrade email | ⏳ |
| K5 | Cancellation acknowledgment | ⏳ |
| K6 | Revocation/access-lost email | ⏳ |
| K7 | Refund email | ⏳ |
| K8 | Day Pass receipt | ⏳ |
| K9 | Seat addon receipt | ⏳ |
| K10 | Workspace invite email | ⏳ |
| K11 | GDPR deletion confirmation | ⏳ |
| K12 | Email send failure does NOT block webhook (Promise.allSettled or .catch) | ⏳ |

---

## Domain L — GDPR / Account Deletion (8)

| ID | Scenario | Status |
|----|----------|--------|
| L1 | User requests deletion via dashboard | ⏳ |
| L2 | Active Polar subscriptions get cancelled (`cancelSubscription` called) | ⏳ |
| L3 | Active seat-addons get cancelled | ⏳ |
| L4 | User row + monitors + workspaces cascade-delete | ⏳ |
| L5 | `activity_logs` entry created with action='account_deleted' | ⏳ |
| L6 | Deletion confirmation email sent | ⏳ |
| L7 | Hard delete after 30-day grace period (verify via retention cron) | ⏳ |
| L8 | Re-signup after deletion uses NEW user ID (no orphan-data linking) | ⏳ |

---

## Domain M — Webhook Security (10)

| ID | Scenario | Status |
|----|----------|--------|
| M1 | Bad signature → 400 "Invalid webhook signature" | ⏳ |
| M2 | Replay attack with valid signature → 200 + duplicate=true (idempotency) | ⏳ |
| M3 | Idempotency uses webhook-id header (Standard Webhooks spec) | ⏳ |
| M4 | Idempotency falls back to type+body hash if header missing | ⏳ |
| M5 | Body tampered with same signature → rejected (signature includes body) | ⏳ |
| M6 | Timing-safe comparison prevents timing attack on signature | ⏳ |
| M7 | Missing signature header → 400 | ⏳ |
| M8 | Missing webhook secret env var → 500 | ⏳ |
| M9 | SQL injection attempt in metadata fields → escaped (Drizzle parameterizes) | ⏳ |
| M10 | XSS attempt in metadata stored as raw string (no eval) | ⏳ |

---

## Domain N — Webhook Reliability (8)

| ID | Scenario | Status |
|----|----------|--------|
| N1 | Idempotency works for Polar's natural retries | ⏳ |
| N2 | Drizzle/Neon transaction works on neon-serverless WebSocket driver | ⏳ |
| N3 | DB transaction rollback on partial failure | ⏳ |
| N4 | Polar API call failures don't block webhook ack | ⏳ |
| N5 | Email send failures don't block | ⏳ |
| N6 | PostHog event failures don't block | ⏳ |
| N7 | Out-of-order events handled gracefully | ⏳ |
| N8 | Customer ID with no matching user → log + no-op (no crash) | ⏳ |

---

## Domain O — UI / Dashboard (12)

| ID | Scenario | Status |
|----|----------|--------|
| O1 | Pricing page renders all 4 tiers with correct monthly/annual prices | ⏳ |
| O2 | Pricing page CTA → Polar checkout URL | ⏳ |
| O3 | Settings → billing reflects current tier | ⏳ |
| O4 | Settings → team shows seatCount/seatLimit | ⏳ |
| O5 | "Add seat" button visible only on Growth | ⏳ |
| O6 | "Remove seat" button visible only when seatLimit > 3 | ⏳ |
| O7 | Founding-member badge shows on user profile/badge UI | ⏳ |
| O8 | Trial banner shows during 14-day reverse trial | ⏳ |
| O9 | Tier-locked features show upgrade CTA | ⏳ |
| O10 | Customer portal link (Polar self-service) works | ⏳ |
| O11 | Account deletion confirmation modal | ⏳ |
| O12 | Day Pass active banner during 24h window | ⏳ |

---

## Domain P — Database State Consistency (10)

| ID | Scenario | Status |
|----|----------|--------|
| P1 | `polarCustomerId` stored on first checkout | ⏳ |
| P2 | `polarSubscriptionId` updated on subscription.active | ⏳ |
| P3 | `currentPeriodStart`/`End` timestamps match Polar's data | ⏳ |
| P4 | `seatLimit` updates atomic (`+1`/`GREATEST(-1, 3)`) | ⏳ |
| P5 | `webhookEvents` idempotency rows persist | ⏳ |
| P6 | `audit_logs` entries for sensitive actions | ⏳ |
| P7 | `is_founding_member` set once, not re-evaluated | ⏳ |
| P8 | `trialEndsAt` and `trialTier` set correctly | ⏳ |
| P9 | `polar_customer_id` is unique-indexed (no duplicate users) | ⏳ |
| P10 | Webhook event logs retained per retention policy | ⏳ |

---

## Domain Q — Edge Cases / Weird States (10)

| ID | Scenario | Status |
|----|----------|--------|
| Q1 | User signs up, never subscribes — stays on free indefinitely | ⏳ |
| Q2 | Subscription event for non-existent customer → log + no-op | ⏳ |
| Q3 | Concurrent webhooks for same eventId — idempotency wins | ⏳ |
| Q4 | Subscription with no productId → log + skip | ⏳ |
| Q5 | Day pass purchase with active subscription | ⏳ |
| Q6 | Seat purchase with workspaceId for workspace user doesn't own → 400 | ⏳ |
| Q7 | 999th vs 1000th vs 1001st founding member assignment (boundary) | ⏳ |
| Q8 | Reactivation: free user re-subscribes after prior cancel | ⏳ |
| Q9 | Polar test event from dashboard (non-real subscription) — no crash | ⏳ |
| Q10 | Webhook for resource type we don't handle (e.g. `customer.created`) → 200 no-op | ⏳ |

---

## Domain R — Trial / Promotional Flow (5)

| ID | Scenario | Status |
|----|----------|--------|
| R1 | First paid signup gets 14-day Growth trial (`trialEndsAt`, `trialTier='growth'`) | ⏳ |
| R2 | Trial expires → user reverts to actual paid tier | ⏳ |
| R3 | Trial does NOT extend on subscription renewal | ⏳ |
| R4 | Second paid event (renewal) does NOT re-grant trial | ⏳ |
| R5 | Growth subscriber does NOT get trial (already has features) | ⏳ |

---

## Domain S — Race Conditions & Concurrency (12)

| ID | Scenario | Status |
|----|----------|--------|
| S1 | Two parallel POST /api/polar/seat-addon (TOCTOU on seatLimit check) | ⏳ |
| S2 | Concurrent webhook delivery for same eventId — idempotency wins, only one processes | ⏳ |
| S3 | Founding-member assignment race — 1000 concurrent first-paid signups, exactly 1000 get founding number | ⏳ |
| S4 | Concurrent subscription.canceled + subscription.updated for same user | ⏳ |
| S5 | Workspace member invite + delete race (seatCount accuracy) | ⏳ |
| S6 | Account deletion mid-subscription (Polar cancel + DB delete race) | ⏳ |
| S7 | Refund + cancel webhook arriving simultaneously | ⏳ |
| S8 | DELETE seat-addon API double-click — only one Polar cancel fires | ⏳ |
| S9 | seatLimit decrement floor under concurrent revoke (GREATEST guard) | ⏳ |
| S10 | webhookEvents unique constraint protects against duplicate-key race | ⏳ |
| S11 | Workspace creation by 2 sessions — only one workspace per owner allowed | ⏳ |
| S12 | Subscription lookup by polarCustomerId race during checkout/subscription event ordering | ⏳ |

---

## Domain T — OWASP Top 10 Web (2021) (10)

| ID | Scenario | Status |
|----|----------|--------|
| T1 | A01 Broken Access Control: user A cannot access user B's billing data via /api/polar/* | ⏳ |
| T2 | A02 Cryptographic Failures: webhook secret stored encrypted, HMAC timing-safe, no plaintext secrets in logs | ⏳ |
| T3 | A03 Injection: SQL injection via webhook metadata.userId fields (Drizzle parameterizes) | ⏳ |
| T4 | A04 Insecure Design: rate-limit on seat purchase prevents financial DoS | ⏳ |
| T5 | A05 Security Misconfiguration: webhook endpoint not auth-protected by Clerk (correct — public+signed) | ⏳ |
| T6 | A06 Vulnerable Components: pnpm audit clean for prod deps | ⏳ |
| T7 | A07 Auth Failures: webhook with valid sig but wrong secret env → rejected | ⏳ |
| T8 | A08 Data Integrity: idempotency prevents replay, signature prevents tamper | ⏳ |
| T9 | A09 Logging & Monitoring: failed signatures + 5xx errors logged for forensics | ⏳ |
| T10 | A10 SSRF: webhook can't be tricked into outbound calls to internal hosts | ⏳ |

---

## Domain U — OWASP API Security Top 10 (2023) (10)

| ID | Scenario | Status |
|----|----------|--------|
| U1 | API1 BOLA: user A cannot DELETE user B's seat addon | ⏳ |
| U2 | API2 Broken Auth: webhook signature verifies before any DB write | ⏳ |
| U3 | API3 Object Property Auth: cannot bypass `metadata.userId` check by passing other users' IDs | ⏳ |
| U4 | API4 Resource Consumption: rate limit on seat-addon POST + DELETE | ⏳ |
| U5 | API5 Function-Level Auth: only workspace owner can buy/remove seats | ⏳ |
| U6 | API6 Sensitive Business Flow: seat-purchase + cancel both gated by tier check | ⏳ |
| U7 | API7 SSRF: outbound URLs validated (existing /lib/security/outbound-url.ts) | ⏳ |
| U8 | API8 Security Misconfiguration: webhook endpoint, CORS, env validation correct | ⏳ |
| U9 | API9 Inventory: webhook event types we DON'T handle return 200 (no info leak) | ⏳ |
| U10 | API10 Unsafe API Consumption: Polar SDK responses validated before DB write | ⏳ |

---

## Domain V — Polar-Specific Edge Cases (8)

| ID | Scenario | Status |
|----|----------|--------|
| V1 | Polar webhook with `subscription.uncanceled` (un-cancel before period end) | ⏳ |
| V2 | Polar webhook for `subscription.created` arriving AFTER `subscription.active` | ⏳ |
| V3 | Polar customer portal: user cancels via Polar UI (not Kaulby UI) | ⏳ |
| V4 | Polar customer portal: user reactivates within grace period | ⏳ |
| V5 | Polar admin force-revoke (e.g., chargeback) — does our handler differentiate? | ⏳ |
| V6 | Polar webhook timestamp drift — accept events with old timestamps? | ⏳ |
| V7 | Polar customer ID change (rare, but Polar can re-issue) | ⏳ |
| V8 | Polar dashboard "send test event" — should not crash anything | ⏳ |

---

## Total: 191 scenarios

Bugs found will be tracked inline. Final SITREP at the end.

---

## Bugs Found (live tracking)

| # | Domain.ID | Bug | Severity | PR | Status |
|---|-----------|-----|----------|-----|--------|
| 1 | K3 | Tier upgrade email — NOT sent. `subscription.updated` calls only `captureEvent` (PostHog), not `sendSubscriptionEmail`. User upgrades from Solo→Scale and gets no confirmation. | MEDIUM | TBD | found-by-recon |
| 2 | K4 | Tier downgrade email — NOT sent. Same handler as K3. | MEDIUM | TBD | found-by-recon |
| 3 | K5 | Cancellation email — NOT sent. `subscription.canceled` only calls `upsertContact` (HubSpot CRM sync), no user email. | MEDIUM | TBD | found-by-recon |
| 4 | K6 | Revocation/access-lost email — NOT sent. `subscription.revoked` only calls `upsertContact`. User loses access silently. | MEDIUM | TBD | found-by-recon |
| 5 | K7 | Refund email — NOT sent. `order.refunded` only calls `captureEvent`. User refunded silently. | MEDIUM | TBD | found-by-recon |
| 6 | K8 | Day Pass receipt email — NOT sent. checkout.updated day_pass branch fires PostHog event + activateDayPass but no email. | MEDIUM | TBD | found-by-recon |
| 7 | OBSERVABILITY | Transactional email sends (welcome / subscription / cancel / refund / etc.) NOT logged in `email_events` table. The table tracks DIGEST email opens/clicks only. Customer support cannot query "did user X receive their welcome email?" without checking Resend dashboard. Only failures are logged (in `email_delivery_failures`). Recommend: log all transactional sends to email_events with email_type+event_type='sent'. | LOW | TBD | found-by-test |
| 8 | D5 | **Orphan paid seat-addons on Growth → non-Growth tier downgrade.** PR #301 fixed cascade-cancel for Growth → free (subscription.revoked path). But Growth → Scale (subscription.updated, tier downgrade) does NOT cascade-cancel seat addons. User keeps paying $20/mo per seat for capacity their now-Scale-tier workspace can't use. Same bug class, different code path. Need to add cascade-cancel to subscription.updated when newPlan != "growth" AND oldPlan == "growth". | MEDIUM | TBD | found-by-test |

---

## Run Log

_(populated as scenarios execute)_
