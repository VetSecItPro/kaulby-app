/**
 * Single source of truth for customer-facing tier copy used on the pricing
 * page. Both the page component (src/app/pricing/page.tsx) and the e2e specs
 * (e2e/billing.spec.ts, e2e/marketing.spec.ts) import from this file so a
 * copy change in one place updates both, and there's no drift between what
 * ships and what tests assert.
 *
 * Why this exists: PR #319 (2026-04-28) rewrote tier descriptions but left
 * the e2e assertions on the old strings. CI silently failed on 4 PRs in a
 * row before anyone noticed. See PR #333.
 *
 * Constraint: this file is plain TypeScript — no React, no Next.js, no
 * server-only imports — so it can be safely imported by both the React
 * component AND by Playwright test files (Playwright runs in Node and won't
 * resolve "use client" boundaries gracefully).
 */

export const TIER_DESCRIPTIONS = {
  solo: "Watch your brand and competitors across 9 platforms",
  scale: "Adds review sites where buyers research before they buy",
  growth: "Team workspace, API access, and analyst-grade reports",
} as const;

export const TIER_USE_CASES = {
  solo: "Solo founders, makers, independents",
  scale: "Growing brands, small agencies, review-heavy categories",
  growth: "Agencies, multi-brand teams, dev-tool companies",
} as const;

export const TIER_PRICES_MONTHLY = {
  solo: 39,
  scale: 79,
  growth: 149,
} as const;

export const TIER_PRICES_ANNUAL = {
  solo: 374, // ~20% off list, $31/mo equivalent
  scale: 758, // $63/mo equivalent
  growth: 1430, // $119/mo equivalent
} as const;

export type CustomerFacingTier = keyof typeof TIER_DESCRIPTIONS;

/** Day Pass copy is paired with the tiers but lives separately because it's
 *  a one-time purchase, not a recurring tier. */
export const DAY_PASS_COPY = {
  price: 15,
  duration: "24 hours",
  description: "Try Scale features for 24 hours",
  badge: "One-Time",
} as const;
