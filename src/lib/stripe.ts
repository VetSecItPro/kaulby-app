import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-05-28.basil",
  typescript: true,
});

// Price IDs for your subscription plans - update these with your actual Stripe price IDs
export const PLANS = {
  free: {
    name: "Free",
    description: "Get started with basic monitoring",
    price: 0,
    priceId: null,
    features: [
      "3 monitors",
      "2 platforms (Reddit, HN)",
      "100 results/month",
      "7-day history",
      "Daily email digest",
    ],
    limits: {
      monitors: 3,
      resultsPerMonth: 100,
      aiEnabled: false,
    },
  },
  pro: {
    name: "Pro",
    description: "For power users and small teams",
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    features: [
      "20 monitors",
      "All platforms",
      "5,000 results/month",
      "30-day history",
      "Real-time alerts",
      "Full AI features",
      "Pain point detection",
      "Sentiment analysis",
      "Priority support",
    ],
    limits: {
      monitors: 20,
      resultsPerMonth: 5000,
      aiEnabled: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    description: "For teams and agencies",
    price: 99,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    features: [
      "Unlimited monitors",
      "All platforms",
      "Unlimited results",
      "Unlimited history",
      "Full AI features",
      "Team collaboration",
      "API access",
      "Custom integrations",
      "Dedicated support",
    ],
    limits: {
      monitors: -1, // unlimited
      resultsPerMonth: -1, // unlimited
      aiEnabled: true,
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
