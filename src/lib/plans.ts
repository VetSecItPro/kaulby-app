// Platform types
export type Platform = "reddit" | "hackernews" | "producthunt" | "devto" | "googlereviews" | "trustpilot" | "appstore" | "playstore" | "quora";

// Digest frequency types
export type DigestFrequency = "weekly" | "daily" | "realtime";

// Plan limits interface
export interface PlanLimits {
  monitors: number; // -1 for unlimited
  keywordsPerMonitor: number;
  sourcesPerMonitor: number;
  resultsHistoryDays: number; // -1 for unlimited
  resultsVisible: number; // -1 for unlimited, how many results user can see
  refreshDelayHours: number; // 0 for real-time, 24 for daily delay
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
export interface PlanDefinition {
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
      "All 9 platforms",
      "20 keywords per monitor",
      "Unlimited results",
      "90-day history",
      "4-hour refresh cycle",
      "Full AI analysis",
      "Daily email digests",
      "CSV export",
    ],
    limits: {
      monitors: 10,
      keywordsPerMonitor: 20,
      sourcesPerMonitor: 10,
      resultsHistoryDays: 90,
      resultsVisible: -1, // unlimited
      refreshDelayHours: 4, // 4-hour refresh cycle (6x faster than free)
      platforms: ["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora"],
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
      "35 keywords per monitor",
      "1-year history",
      "2-hour refresh cycle",
      "Full AI analysis",
      "Real-time email alerts",
      "Webhooks",
      "5 team seats (+$15/user)",
      "Priority support",
      "API access (coming soon)",
    ],
    limits: {
      monitors: 30, // 30 monitors (was unlimited)
      keywordsPerMonitor: 35, // reduced from 50 to 35
      sourcesPerMonitor: 25,
      resultsHistoryDays: 365,
      resultsVisible: -1, // unlimited
      refreshDelayHours: 2, // 2-hour refresh (was real-time)
      platforms: ["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora"],
      digestFrequencies: ["daily", "weekly", "realtime"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: true, // Team tier: Claude Sonnet 4 comprehensive analysis
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

// Map Polar product ID to plan key (handles both monthly and annual)
export function getPlanFromPriceId(priceId: string): PlanKey {
  if (priceId === PLANS.pro.priceId || priceId === PLANS.pro.annualPriceId) return "pro";
  if (priceId === PLANS.enterprise.priceId || priceId === PLANS.enterprise.annualPriceId) return "enterprise";
  return "free";
}

// Get plan limits for a subscription status
export function getPlanLimits(plan: PlanKey): PlanLimits {
  return PLANS[plan].limits;
}

// Get the appropriate price ID based on plan and billing interval
export function getPriceId(plan: PlanKey, interval: BillingInterval): string | null {
  const planDef = PLANS[plan];
  if (!planDef) return null;
  return interval === "annual" ? planDef.annualPriceId : planDef.priceId;
}

// Get trial days for a plan
export function getTrialDays(plan: PlanKey): number {
  return PLANS[plan]?.trialDays || 0;
}

// Calculate savings for annual billing
export function getAnnualSavings(plan: PlanKey): { amount: number; percentage: number; monthsFree: number } {
  const planDef = PLANS[plan];
  if (!planDef || planDef.price === 0) {
    return { amount: 0, percentage: 0, monthsFree: 0 };
  }
  const monthlyTotal = planDef.price * 12;
  const annualTotal = planDef.annualPrice;
  const savings = monthlyTotal - annualTotal;
  const percentage = Math.round((savings / monthlyTotal) * 100);
  const monthsFree = Math.round(savings / planDef.price);
  return { amount: savings, percentage, monthsFree };
}
