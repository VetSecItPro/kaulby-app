// Platform types - 16 total active platforms
// Core 9 (Pro tier): reddit, hackernews, indiehackers, producthunt, googlereviews, youtube, github, trustpilot, x
// Additional 7 (Team tier): devto, hashnode, appstore, playstore, g2, yelp, amazonreviews
// Deferred (not user-selectable, historical display only): quora — see
// .mdmp/apify-platform-cost-audit-2026-04-21.md. Reactivation planned as Team-tier-only
// once a custom Crawlee actor replaces the sunsetting jupri/quora-scraper (Oct 2026).
export type Platform =
  | "reddit" | "hackernews" | "producthunt" | "devto"
  | "googlereviews" | "trustpilot" | "appstore" | "playstore"
  | "youtube" | "g2" | "yelp" | "amazonreviews"
  | "indiehackers" | "github" | "hashnode" | "x";

// Platform groupings for tier access
const PRO_PLATFORMS: Platform[] = [
  "reddit", "hackernews", "indiehackers", "producthunt",
  "googlereviews", "youtube", "github", "trustpilot", "x"
];

export const ALL_PLATFORMS: Platform[] = [
  ...PRO_PLATFORMS,
  "devto", "hashnode", "appstore", "playstore",
  "g2", "yelp", "amazonreviews"
];

// Digest frequency types
export type DigestFrequency = "weekly" | "daily" | "monthly" | "twice_daily";

// Plan limits interface
export interface PlanLimits {
  monitors: number; // -1 for unlimited
  keywordsPerMonitor: number;
  sourcesPerMonitor: number;
  resultsHistoryDays: number; // -1 for unlimited
  resultsVisible: number; // -1 for unlimited, how many results user can see
  refreshDelayHours: number; // Free: 24hr, Pro: 4hr, Team: 2hr
  platforms: Platform[];
  digestFrequencies: DigestFrequency[];
  aiFeatures: {
    sentiment: boolean;
    painPointCategories: boolean;
    askFeature: boolean;
    unlimitedAiAnalysis: boolean; // false = only first result gets AI analysis
    comprehensiveAnalysis: boolean; // Team tier: Claude Sonnet 4 comprehensive analysis
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
  annualPrice: number; // Annual price (total for year)
  priceId: string | null; // Monthly price ID
  annualPriceId: string | null; // Annual price ID
  trialDays: number; // Free trial days (0 for free tier)
  features: string[];
  limits: PlanLimits;
}

// Product IDs for subscription plans (Polar.sh)
// Starter (COA 4 W3.2): bridges the $29→$99 cliff. More monitors/keywords than Pro,
// adds review-listing platforms (G2, Yelp, Amazon), but stays on Flash model (not
// Sonnet). Team stays the differentiator: comprehensive analysis + DevTo/Hashnode/
// AppStore/PlayStore + team seats.
export const PLANS: Record<"free" | "starter" | "pro" | "team", PlanDefinition> = {
  free: {
    name: "Free",
    description: "Try Kaulby with limited features",
    price: 0,
    annualPrice: 0,
    priceId: null,
    annualPriceId: null,
    trialDays: 0,
    features: [
      "1 monitor",
      "3 keywords",
      "See last 3 results",
      "Reddit only",
      "3-day history",
      "24-hour refresh delay",
      "AI analysis on first result",
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
        unlimitedAiAnalysis: false, // Only first result
        comprehensiveAnalysis: false, // Free tier: no comprehensive analysis
      },
      alerts: {
        email: false,
        slack: false,
        webhooks: false,
      },
      exports: {
        csv: false,
        api: false,
      },
    },
  },
  starter: {
    name: "Starter",
    description: "For solo operators scaling past the basics",
    price: 49,
    annualPrice: 470, // 20% off monthly ($49 × 12 = $588, 20% discount = $470.40 → $470)
    priceId: process.env.POLAR_STARTER_MONTHLY_PRODUCT_ID || "",
    annualPriceId: process.env.POLAR_STARTER_ANNUAL_PRODUCT_ID || "",
    trialDays: 14,
    features: [
      "20 monitors",
      "12 platforms (Pro + G2, Yelp, Amazon)",
      "15 keywords per monitor",
      "Unlimited results",
      "90-day history",
      "3-hour refresh cycle",
      "Full AI analysis (Flash)",
      "Daily email digests",
      "CSV export",
    ],
    limits: {
      monitors: 20,
      keywordsPerMonitor: 15,
      sourcesPerMonitor: 10,
      resultsHistoryDays: 90,
      resultsVisible: -1,
      refreshDelayHours: 3,
      // 12 platforms: Pro's 9 + G2/Yelp/Amazon review listings.
      // Dev.to, Hashnode, AppStore, PlayStore stay Team-only differentiators.
      platforms: [
        "reddit", "hackernews", "indiehackers", "producthunt",
        "googlereviews", "youtube", "github", "trustpilot", "x",
        "g2", "yelp", "amazonreviews",
      ],
      digestFrequencies: ["daily"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: false, // Flash model, same as Pro today
      },
      alerts: {
        email: true,
        slack: true,
        webhooks: false,
      },
      exports: {
        csv: true,
        api: false,
      },
    },
  },
  pro: {
    name: "Pro",
    description: "For power users and professionals",
    price: 29,
    annualPrice: 290, // 2 months free ($29 x 10)
    priceId: process.env.POLAR_PRO_MONTHLY_PRODUCT_ID || "",
    annualPriceId: process.env.POLAR_PRO_ANNUAL_PRODUCT_ID || "",
    trialDays: 14,
    features: [
      "10 monitors",
      "9 platforms (Reddit, HN, IH, PH, Google, YouTube, GitHub, Trustpilot, X)",
      "10 keywords per monitor",
      "Unlimited results",
      "90-day history",
      "4-hour refresh cycle",
      "Full AI analysis",
      "Daily email digests",
      "CSV export",
    ],
    limits: {
      monitors: 10,
      keywordsPerMonitor: 10, // Reduced from 20 (still 2-3x more than competitors)
      sourcesPerMonitor: 10,
      resultsHistoryDays: 90,
      resultsVisible: -1, // unlimited
      refreshDelayHours: 4, // 4-hour refresh cycle (6x faster than free)
      platforms: ["reddit", "hackernews", "indiehackers", "producthunt", "googlereviews", "youtube", "github", "trustpilot", "x"],
      digestFrequencies: ["daily"], // Pro only gets daily digest
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true, // Pro users get Ask Q&A (rate-limited via token budget)
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: false, // Pro tier: uses Gemini 2.5 Flash (3 separate calls)
      },
      alerts: {
        email: true,
        slack: true,
        webhooks: false,
      },
      exports: {
        csv: true,
        api: false,
      },
    },
  },
  team: {
    name: "Team",
    description: "For growing teams and agencies",
    price: 99,
    annualPrice: 990, // 2 months free ($99 x 10)
    priceId: process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID || "",
    annualPriceId: process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID || "",
    trialDays: 14,
    features: [
      "Everything in Pro",
      "30 monitors",
      "All 16 platforms",
      "20 keywords per monitor",
      "1-year history",
      "2-hour refresh cycle",
      "Comprehensive AI analysis",
      "Twice-daily email digests",
      "Webhooks",
      "3 team seats (+$20/user)",
      "Priority support",
      "API access",
    ],
    limits: {
      monitors: 30,
      keywordsPerMonitor: 20, // Reduced from 35 (still 4x more than competitors)
      sourcesPerMonitor: 25,
      resultsHistoryDays: 365,
      resultsVisible: -1, // unlimited
      refreshDelayHours: 2, // 2-hour refresh
      platforms: ["reddit", "hackernews", "indiehackers", "producthunt", "googlereviews", "youtube", "github", "trustpilot", "x", "devto", "hashnode", "appstore", "playstore", "g2", "yelp", "amazonreviews"],
      digestFrequencies: ["daily", "weekly", "monthly", "twice_daily"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: true, // Team tier: Gemini comprehensive analysis
      },
      alerts: {
        email: true,
        slack: true,
        webhooks: true,
      },
      exports: {
        csv: true,
        api: true,
      },
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Get plan limits for a subscription status
export function getPlanLimits(plan: PlanKey): PlanLimits {
  return PLANS[plan].limits;
}
