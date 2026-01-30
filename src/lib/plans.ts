// Platform types - 16 total platforms
// Core 8 (Pro tier): reddit, hackernews, indiehackers, producthunt, googlereviews, youtube, github, trustpilot
// Additional 8 (Team tier): devto, hashnode, appstore, playstore, quora, g2, yelp, amazonreviews
export type Platform =
  | "reddit" | "hackernews" | "producthunt" | "devto"
  | "googlereviews" | "trustpilot" | "appstore" | "playstore"
  | "quora" | "youtube" | "g2" | "yelp" | "amazonreviews"
  | "indiehackers" | "github" | "hashnode";

// Platform groupings for tier access
const PRO_PLATFORMS: Platform[] = [
  "reddit", "hackernews", "indiehackers", "producthunt",
  "googlereviews", "youtube", "github", "trustpilot"
];

export const ALL_PLATFORMS: Platform[] = [
  ...PRO_PLATFORMS,
  "devto", "hashnode", "appstore", "playstore",
  "quora", "g2", "yelp", "amazonreviews"
];

// Digest frequency types
export type DigestFrequency = "weekly" | "daily" | "monthly" | "realtime";

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
export const PLANS: Record<"free" | "pro" | "enterprise", PlanDefinition> = {
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
      "8 platforms (Reddit, HN, IH, PH, Google, YouTube, GitHub, Trustpilot)",
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
      platforms: ["reddit", "hackernews", "indiehackers", "producthunt", "googlereviews", "youtube", "github", "trustpilot"],
      digestFrequencies: ["daily"], // Pro only gets daily digest
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: false,
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
  enterprise: {
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
      "Real-time email alerts",
      "Webhooks",
      "5 team seats (+$15/user)",
      "Priority support",
      "API access (coming soon)",
    ],
    limits: {
      monitors: 30,
      keywordsPerMonitor: 20, // Reduced from 35 (still 4x more than competitors)
      sourcesPerMonitor: 25,
      resultsHistoryDays: 365,
      resultsVisible: -1, // unlimited
      refreshDelayHours: 2, // 2-hour refresh
      platforms: ["reddit", "hackernews", "indiehackers", "producthunt", "googlereviews", "youtube", "github", "trustpilot", "devto", "hashnode", "appstore", "playstore", "quora", "g2", "yelp", "amazonreviews"],
      digestFrequencies: ["daily", "weekly", "monthly", "realtime"],
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
