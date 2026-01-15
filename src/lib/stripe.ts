import Stripe from "stripe";

// Stripe client - initialized lazily to avoid build-time errors
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return stripeClient;
}

// For backwards compatibility
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    })
  : (null as unknown as Stripe);

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

// Plan definition interface
export interface PlanDefinition {
  name: string;
  description: string;
  price: number;
  priceId: string | null;
  features: string[];
  limits: PlanLimits;
}

// Price IDs for your subscription plans - update these with your actual Stripe price IDs
export const PLANS: Record<"free" | "pro" | "enterprise", PlanDefinition> = {
  free: {
    name: "Free",
    description: "Try Kaulby with limited features",
    price: 0,
    priceId: null,
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
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    features: [
      "10 monitors",
      "20 keywords per monitor",
      "Unlimited results",
      "8 platforms (Reddit, HN, PH, Google Reviews, Trustpilot, App Store, Play Store, Quora)",
      "90-day history",
      "2-hour refresh cycle",
      "Full AI analysis",
      "Pain point detection",
      "Slack alerts + Daily email digest",
      "CSV export",
    ],
    limits: {
      monitors: 10,
      keywordsPerMonitor: 20,
      sourcesPerMonitor: 10,
      resultsHistoryDays: 90,
      resultsVisible: -1, // unlimited
      refreshDelayHours: 2, // 2-hour refresh cycle
      platforms: ["reddit", "hackernews", "producthunt", "googlereviews", "trustpilot", "appstore", "playstore", "quora"],
      digestFrequencies: ["daily"], // Pro only gets daily digest
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: false,
        unlimitedAiAnalysis: true,
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
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    features: [
      "Unlimited monitors",
      "50 keywords per monitor",
      "Unlimited results",
      "All 9 platforms (includes Dev.to)",
      "1-year history",
      "Real-time monitoring",
      "Full AI + Ask feature",
      "Configurable alerts (immediate/daily/weekly)",
      "Webhooks + API access",
      "Up to 5 team seats (+$15/user)",
      "Priority support",
    ],
    limits: {
      monitors: -1, // unlimited
      keywordsPerMonitor: 50,
      sourcesPerMonitor: 25,
      resultsHistoryDays: 365,
      resultsVisible: -1, // unlimited
      refreshDelayHours: 0, // real-time
      platforms: ["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora"],
      digestFrequencies: ["daily", "weekly", "realtime"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
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

// Map Stripe price ID to plan key
export function getPlanFromPriceId(priceId: string): PlanKey {
  if (priceId === PLANS.pro.priceId) return "pro";
  if (priceId === PLANS.enterprise.priceId) return "enterprise";
  return "free";
}

// Get plan limits for a subscription status
export function getPlanLimits(plan: PlanKey): PlanLimits {
  return PLANS[plan].limits;
}

// Check if a platform is available for a plan
export function isPlatformAvailable(plan: PlanKey, platform: Platform): boolean {
  return PLANS[plan].limits.platforms.includes(platform);
}

// Check if a feature is available for a plan
export function isFeatureAvailable(
  plan: PlanKey,
  feature: "sentiment" | "painPointCategories" | "askFeature" | "slack" | "webhooks" | "csv" | "api"
): boolean {
  const limits = PLANS[plan].limits;

  switch (feature) {
    case "sentiment":
      return limits.aiFeatures.sentiment;
    case "painPointCategories":
      return limits.aiFeatures.painPointCategories;
    case "askFeature":
      return limits.aiFeatures.askFeature;
    case "slack":
      return limits.alerts.slack;
    case "webhooks":
      return limits.alerts.webhooks;
    case "csv":
      return limits.exports.csv;
    case "api":
      return limits.exports.api;
    default:
      return false;
  }
}
