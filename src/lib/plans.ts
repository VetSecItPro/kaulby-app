// Platform types - 16 total active platforms
// Solo-tier platforms: 8 (reddit, hackernews, indiehackers, producthunt, googlereviews, youtube, github, trustpilot)
// Scale adds 3 review-listing platforms: g2, yelp, amazonreviews (11 total)
// Growth gets all 16: adds devto, hashnode, appstore, playstore, AND x (see cost note below)
// Deferred (not user-selectable): quora — see .mdmp/apify-platform-cost-audit-2026-04-21.md
//
// X (Twitter) via xAI: MOVED TO GROWTH-ONLY 2026-04-23. xAI x_search tool
// runs ~$0.01-$0.05 per scan — at Solo-tier $39/mo with 6-hour refresh, X
// monitoring alone could consume >15% of tier margin. Kept as Growth-only
// until (a) we measure actual cost in prod or (b) ship an Apify-based
// cheaper alternative. See session notes 2026-04-23.
export type Platform =
  | "reddit" | "hackernews" | "producthunt" | "devto"
  | "googlereviews" | "trustpilot" | "appstore" | "playstore"
  | "youtube" | "g2" | "yelp" | "amazonreviews"
  | "indiehackers" | "github" | "hashnode" | "x";

const SOLO_PLATFORMS: Platform[] = [
  "reddit", "hackernews", "indiehackers", "producthunt",
  "googlereviews", "youtube", "github", "trustpilot",
];

const SCALE_PLATFORMS: Platform[] = [
  ...SOLO_PLATFORMS,
  "g2", "yelp", "amazonreviews",
];

export const ALL_PLATFORMS: Platform[] = [
  ...SCALE_PLATFORMS,
  "devto", "hashnode", "appstore", "playstore", "x",
];

// Digest frequency types
export type DigestFrequency = "weekly" | "daily" | "monthly" | "twice_daily";

// Plan limits interface.
// KEYWORDS: intentionally uncapped on paid tiers (-1 = unlimited). Keyword
// count doesn't drive infra cost — content matching happens locally after
// scan — and Awario offers unlimited keywords on every paid tier, so
// capping them was a false differentiator that lost us the comparison.
// Free keeps a 3-keyword cap as the entry gate.
export interface PlanLimits {
  monitors: number; // -1 for unlimited
  keywordsPerMonitor: number; // -1 for unlimited (all paid tiers)
  sourcesPerMonitor: number;
  resultsHistoryDays: number; // -1 for unlimited
  resultsVisible: number; // -1 for unlimited, how many results user can see
  refreshDelayHours: number; // Free: 24hr, Solo: 6hr, Scale: 4hr, Growth: 2hr
  platforms: Platform[];
  digestFrequencies: DigestFrequency[];
  aiFeatures: {
    sentiment: boolean;
    painPointCategories: boolean;
    askFeature: boolean;
    unlimitedAiAnalysis: boolean; // false = only first result gets AI analysis
    comprehensiveAnalysis: boolean; // Growth tier: multi-section AI analyst report
  };
  alerts: {
    email: boolean;
    slack: boolean;
    webhooks: boolean;
  };
  exports: {
    csv: boolean;
    api: boolean;
  };
}

// Billing interval type
export type BillingInterval = "monthly" | "annual";

// Plan definition interface
interface PlanDefinition {
  name: string;
  description: string;
  price: number; // Monthly price
  annualPrice: number; // Annual price (total for year) — 20% off list for paid tiers
  priceId: string | null; // Monthly price ID
  annualPriceId: string | null; // Annual price ID
  trialDays: number; // Free trial days (0 for free tier)
  features: string[];
  limits: PlanLimits;
}

// Plan catalog — Free / Solo / Scale / Growth.
// Prices set 2026-04-23 (pre-launch restructure). Rationale:
// - Solo $39 undercuts Awario Starter ($49) for acquisition.
// - Scale $79 is the "I outgrew Solo" step (+10 monitors, +3 platforms, faster refresh).
// - Growth $149 matches Awario Pro exactly, adds integrations (webhooks/API) + team seats
//   that can't be replicated by stacking Solos.
// Annual: 20% off across all tiers ($374 / $758 / $1,430).
export const PLANS: Record<"free" | "solo" | "scale" | "growth", PlanDefinition> = {
  free: {
    name: "Free",
    description: "Try Kaulby with a single monitor",
    price: 0,
    annualPrice: 0,
    priceId: null,
    annualPriceId: null,
    trialDays: 0,
    features: [
      "1 monitor",
      "3 keywords",
      "Reddit only",
      "24-hour refresh",
      "3-day history",
      "See last 3 results",
    ],
    limits: {
      monitors: 1,
      keywordsPerMonitor: 3,
      sourcesPerMonitor: 2,
      resultsHistoryDays: 3,
      resultsVisible: 3,
      refreshDelayHours: 24,
      platforms: ["reddit"],
      digestFrequencies: [],
      aiFeatures: {
        sentiment: true,
        painPointCategories: false,
        askFeature: false,
        unlimitedAiAnalysis: false,
        comprehensiveAnalysis: false,
      },
      alerts: { email: false, slack: false, webhooks: false },
      exports: { csv: false, api: false },
    },
  },
  solo: {
    name: "Solo",
    description: "For one operator watching their brand",
    price: 39,
    annualPrice: 374, // 20% off $468 list
    priceId: process.env.POLAR_SOLO_MONTHLY_PRODUCT_ID || "",
    annualPriceId: process.env.POLAR_SOLO_ANNUAL_PRODUCT_ID || "",
    trialDays: 14,
    features: [
      "10 monitors",
      "9 platforms (Reddit, HN, IH, PH, Google, YouTube, GitHub, Trustpilot, X)",
      "Unlimited keywords",
      "6-hour refresh (+ real-time Reddit)",
      "90-day history",
      "Full AI analysis + Ask Kaulby",
      "Daily email digest",
      "Email + Slack/Discord alerts",
      "CSV export",
    ],
    limits: {
      monitors: 10,
      keywordsPerMonitor: -1, // unlimited
      sourcesPerMonitor: 10,
      resultsHistoryDays: 90,
      resultsVisible: -1,
      refreshDelayHours: 6,
      platforms: SOLO_PLATFORMS,
      digestFrequencies: ["daily"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: false,
      },
      alerts: { email: true, slack: true, webhooks: false },
      exports: { csv: true, api: false },
    },
  },
  scale: {
    name: "Scale",
    description: "For the solo operator who outgrew Solo",
    price: 79,
    annualPrice: 758, // 20% off $948 list
    priceId: process.env.POLAR_SCALE_MONTHLY_PRODUCT_ID || "",
    annualPriceId: process.env.POLAR_SCALE_ANNUAL_PRODUCT_ID || "",
    trialDays: 14,
    features: [
      "20 monitors",
      "12 platforms (adds G2, Yelp, Amazon Reviews)",
      "Unlimited keywords",
      "4-hour refresh (+ real-time Reddit)",
      "90-day history",
      "Full AI analysis + Ask Kaulby",
      "Daily email digest",
      "Email + Slack/Discord alerts",
      "CSV export",
    ],
    limits: {
      monitors: 20,
      keywordsPerMonitor: -1,
      sourcesPerMonitor: 15,
      resultsHistoryDays: 90,
      resultsVisible: -1,
      refreshDelayHours: 4,
      platforms: SCALE_PLATFORMS,
      digestFrequencies: ["daily"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: false,
      },
      alerts: { email: true, slack: true, webhooks: false },
      exports: { csv: true, api: false },
    },
  },
  growth: {
    name: "Growth",
    description: "For teams and agencies operationalizing brand intelligence",
    price: 149,
    annualPrice: 1430, // 20% off $1788 list
    priceId: process.env.POLAR_GROWTH_MONTHLY_PRODUCT_ID || "",
    annualPriceId: process.env.POLAR_GROWTH_ANNUAL_PRODUCT_ID || "",
    trialDays: 14,
    features: [
      "30 monitors",
      "All 16 platforms (adds Dev.to, Hashnode, App Store, Play Store)",
      "Unlimited keywords",
      "2-hour refresh (+ real-time Reddit & GitHub)",
      "1-year history",
      "Comprehensive AI analyst reports",
      "Twice-daily email digest",
      "Custom webhooks + REST API access",
      "3 team seats (+$20/mo each extra)",
      "Shared workspace + role permissions",
    ],
    limits: {
      monitors: 30,
      keywordsPerMonitor: -1,
      sourcesPerMonitor: 25,
      resultsHistoryDays: 365,
      resultsVisible: -1,
      refreshDelayHours: 2,
      platforms: ALL_PLATFORMS,
      digestFrequencies: ["daily", "weekly", "monthly", "twice_daily"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: true,
      },
      alerts: { email: true, slack: true, webhooks: true },
      exports: { csv: true, api: true },
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Legacy enum values that existed in the DB's subscription_status enum before
// the 2026-04-23 rename. No rows use them (no subscribers at rename time),
// but drizzle's type inference still pulls them into column types. This
// helper narrows any legacy value back to the current tier ladder.
export function normalizePlanKey(
  value: PlanKey | "starter" | "pro" | "team" | null | undefined
): PlanKey {
  if (value === "pro") return "solo";
  if (value === "team") return "growth";
  if (value === "starter") return "scale";
  if (value === "free" || value === "solo" || value === "scale" || value === "growth") {
    return value;
  }
  return "free";
}

// Tier ordering for "max of two tiers" logic — used by reverse trial to grant
// the higher of paid-vs-trial tier during the trial window.
const TIER_RANK: Record<PlanKey, number> = {
  free: 0,
  solo: 1,
  scale: 2,
  growth: 3,
};

export function maxTier(a: PlanKey, b: PlanKey): PlanKey {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/**
 * Reverse trial: every new paid signup gets 14 days of Growth-tier features
 * regardless of what they paid for. After the trial window closes, they drop
 * to their actual paid tier.
 *
 * Returns the tier that should be USED for feature gating right now.
 * Caller passes the user's persisted subscriptionStatus and trial fields.
 */
export function getEffectiveTier(input: {
  subscriptionStatus: PlanKey | "starter" | "pro" | "team" | null | undefined;
  trialTier?: PlanKey | "starter" | "pro" | "team" | null;
  trialEndsAt?: Date | string | null;
}): PlanKey {
  const paid = normalizePlanKey(input.subscriptionStatus);

  if (!input.trialTier || !input.trialEndsAt) {
    return paid;
  }

  const ends = typeof input.trialEndsAt === "string" ? new Date(input.trialEndsAt) : input.trialEndsAt;
  if (!(ends instanceof Date) || Number.isNaN(ends.getTime()) || ends <= new Date()) {
    // Trial is over (or invalid date) — fall through to paid tier.
    return paid;
  }

  const trial = normalizePlanKey(input.trialTier);
  // Take whichever is higher — never downgrade a customer who upgraded mid-trial.
  return maxTier(paid, trial);
}

// Get plan limits for a subscription status
export function getPlanLimits(plan: PlanKey): PlanLimits {
  return PLANS[plan].limits;
}
