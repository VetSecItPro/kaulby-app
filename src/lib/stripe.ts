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
export type Platform = "reddit" | "hackernews" | "producthunt" | "devto" | "twitter";

// Digest frequency types
export type DigestFrequency = "weekly" | "daily" | "realtime";

// Plan limits interface
export interface PlanLimits {
  monitors: number; // -1 for unlimited
  keywordsPerMonitor: number;
  sourcesPerMonitor: number;
  resultsHistoryDays: number; // -1 for unlimited
  platforms: Platform[];
  digestFrequencies: DigestFrequency[];
  aiFeatures: {
    sentiment: boolean;
    painPointCategories: boolean;
    askFeature: boolean;
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
    description: "Get started with basic monitoring",
    price: 0,
    priceId: null,
    features: [
      "1 monitor",
      "3 keywords per monitor",
      "2 sources per monitor",
      "Reddit only",
      "7-day history",
      "Weekly email digest",
      "Basic sentiment analysis",
    ],
    limits: {
      monitors: 1,
      keywordsPerMonitor: 3,
      sourcesPerMonitor: 2,
      resultsHistoryDays: 7,
      platforms: ["reddit"],
      digestFrequencies: ["weekly"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: false,
        askFeature: false,
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
    description: "For power users and growing teams",
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    features: [
      "10 monitors",
      "20 keywords per monitor",
      "10 sources per monitor",
      "Reddit + Hacker News",
      "90-day history",
      "Daily + Weekly digests",
      "Full AI analysis",
      "Pain point detection",
      "Email + Slack alerts",
      "CSV export",
    ],
    limits: {
      monitors: 10,
      keywordsPerMonitor: 20,
      sourcesPerMonitor: 10,
      resultsHistoryDays: 90,
      platforms: ["reddit", "hackernews"],
      digestFrequencies: ["daily", "weekly"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: false,
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
    name: "Enterprise",
    description: "For teams and agencies",
    price: 99,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    features: [
      "Unlimited monitors",
      "50 keywords per monitor",
      "25 sources per monitor",
      "All platforms",
      "1-year history",
      "Real-time alerts",
      "Full AI + Ask feature",
      "All alert channels",
      "Webhooks",
      "CSV + API access",
      "Priority support",
    ],
    limits: {
      monitors: -1, // unlimited
      keywordsPerMonitor: 50,
      sourcesPerMonitor: 25,
      resultsHistoryDays: 365,
      platforms: ["reddit", "hackernews", "producthunt", "devto", "twitter"],
      digestFrequencies: ["daily", "weekly", "realtime"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
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
