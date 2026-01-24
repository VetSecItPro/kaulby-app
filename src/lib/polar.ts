// Polar SDK - dynamically imported to prevent build errors when not installed
// Install with: npm install @polar-sh/sdk
type PolarClient = {
  checkouts: {
    custom: {
      create: (params: {
        productId: string;
        customerEmail: string;
        successUrl: string;
        metadata?: Record<string, string>;
      }) => Promise<{ id: string; url: string }>;
    };
  };
  customerSessions: {
    create: (params: { customerId: string }) => Promise<{ customerPortalUrl: string }>;
  };
  subscriptions: {
    update: (params: {
      id: string;
      subscriptionUpdate: {
        revoke?: boolean;
        cancelAtPeriodEnd?: boolean;
      };
    }) => Promise<{ id: string; status: string }>;
  };
};

// Polar client - initialized lazily to avoid import errors
let _polarClient: PolarClient | null = null;

export async function getPolarClient(): Promise<PolarClient | null> {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return null;
  }

  if (_polarClient) {
    return _polarClient;
  }

  try {
    // Dynamic import using string variable to avoid TypeScript module resolution at build time
    // This allows the code to work even when @polar-sh/sdk is not installed
    const moduleName = "@polar-sh/sdk";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = await (Function("moduleName", "return import(moduleName)")(moduleName) as Promise<any>);
    const Polar = sdk.Polar;
    _polarClient = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
    }) as unknown as PolarClient;
    return _polarClient;
  } catch {
    console.warn("@polar-sh/sdk not installed. Run: npm install @polar-sh/sdk");
    return null;
  }
}

// Legacy export for backwards compatibility (will be null until SDK is installed)
export const polar: PolarClient | null = null;

// Platform types (shared with plans.ts) - 16 total platforms
export type Platform =
  | "reddit" | "hackernews" | "producthunt" | "devto"
  | "googlereviews" | "trustpilot" | "appstore" | "playstore"
  | "quora" | "youtube" | "g2" | "yelp" | "amazonreviews"
  | "indiehackers" | "github" | "hashnode";

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

// Plan definition interface for Polar
export interface PolarPlanDefinition {
  name: string;
  description: string;
  price: number; // Monthly price
  annualPrice: number; // Annual price (total for year)
  productId: string | null; // Monthly product ID
  annualProductId: string | null; // Annual product ID
  trialDays: number; // Free trial days (0 for free tier)
  features: string[];
  limits: PlanLimits;
}

// Polar Product IDs - set these in your .env.local after creating products in Polar Dashboard
export const POLAR_PLANS: Record<"free" | "pro" | "team", PolarPlanDefinition> = {
  free: {
    name: "Free",
    description: "Try Kaulby with limited features",
    price: 0,
    annualPrice: 0,
    productId: null,
    annualProductId: null,
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
        unlimitedAiAnalysis: false,
        comprehensiveAnalysis: false,
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
    productId: process.env.POLAR_PRO_MONTHLY_PRODUCT_ID || "",
    annualProductId: process.env.POLAR_PRO_ANNUAL_PRODUCT_ID || "",
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
      keywordsPerMonitor: 10,
      sourcesPerMonitor: 10,
      resultsHistoryDays: 90,
      resultsVisible: -1,
      refreshDelayHours: 4,
      platforms: ["reddit", "hackernews", "indiehackers", "producthunt", "googlereviews", "youtube", "github", "trustpilot"],
      digestFrequencies: ["daily"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: false,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: false,
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
    productId: process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID || "",
    annualProductId: process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID || "",
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
      keywordsPerMonitor: 20,
      sourcesPerMonitor: 25,
      resultsHistoryDays: 365,
      resultsVisible: -1,
      refreshDelayHours: 2,
      platforms: ["reddit", "hackernews", "indiehackers", "producthunt", "googlereviews", "youtube", "github", "trustpilot", "devto", "hashnode", "appstore", "playstore", "quora", "g2", "yelp", "amazonreviews"],
      digestFrequencies: ["daily", "weekly", "realtime"],
      aiFeatures: {
        sentiment: true,
        painPointCategories: true,
        askFeature: true,
        unlimitedAiAnalysis: true,
        comprehensiveAnalysis: true,
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

export type PolarPlanKey = keyof typeof POLAR_PLANS;

// Day Pass product ID for one-time purchase
export const DAY_PASS_PRODUCT_ID = process.env.POLAR_DAY_PASS_PRODUCT_ID || "";

// Map Polar product ID to plan key (handles both monthly and annual)
// IMPORTANT: Read env vars at runtime to avoid module load order issues
export function getPlanFromProductId(productId: string): PolarPlanKey {
  if (!productId) return "free";

  // Read directly from env vars at runtime for reliability
  const proMonthly = process.env.POLAR_PRO_MONTHLY_PRODUCT_ID;
  const proAnnual = process.env.POLAR_PRO_ANNUAL_PRODUCT_ID;
  const teamMonthly = process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID;
  const teamAnnual = process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID;

  if (productId === proMonthly || productId === proAnnual) return "pro";
  if (productId === teamMonthly || productId === teamAnnual) return "team";
  return "free";
}

// Get plan limits for a subscription
export function getPolarPlanLimits(plan: PolarPlanKey): PlanLimits {
  return POLAR_PLANS[plan].limits;
}

// Get the appropriate product ID based on plan and billing interval
// IMPORTANT: Read env vars at runtime to avoid module load order issues
export function getProductId(plan: PolarPlanKey, interval: BillingInterval): string | null {
  if (plan === "free") return null;

  // Read directly from env vars at runtime for reliability
  if (plan === "pro") {
    return interval === "annual"
      ? process.env.POLAR_PRO_ANNUAL_PRODUCT_ID || null
      : process.env.POLAR_PRO_MONTHLY_PRODUCT_ID || null;
  }

  if (plan === "team") {
    return interval === "annual"
      ? process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID || null
      : process.env.POLAR_TEAM_MONTHLY_PRODUCT_ID || null;
  }

  return null;
}

// Get trial days for a plan
export function getPolarTrialDays(plan: PolarPlanKey): number {
  return POLAR_PLANS[plan]?.trialDays || 0;
}

// Calculate savings for annual billing
export function getPolarAnnualSavings(plan: PolarPlanKey): { amount: number; percentage: number; monthsFree: number } {
  const planDef = POLAR_PLANS[plan];
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

// Create a checkout session URL
export async function createCheckoutUrl(
  productId: string,
  customerEmail: string,
  successUrl: string,
  metadata?: Record<string, string>
): Promise<string | null> {
  if (!polar) {
    console.error("Polar client not initialized");
    return null;
  }

  try {
    const checkout = await polar.checkouts.custom.create({
      productId,
      customerEmail,
      successUrl,
      metadata,
    });

    return checkout.url;
  } catch (error) {
    console.error("Failed to create Polar checkout:", error);
    return null;
  }
}

// Create a customer portal URL for managing subscriptions
export async function createCustomerPortalUrl(customerId: string): Promise<string | null> {
  if (!polar) {
    console.error("Polar client not initialized");
    return null;
  }

  try {
    const session = await polar.customerSessions.create({
      customerId,
    });

    return session.customerPortalUrl;
  } catch (error) {
    console.error("Failed to create Polar customer portal session:", error);
    return null;
  }
}

// Cancel/revoke a subscription (for account deletion)
export async function cancelSubscription(
  subscriptionId: string,
  options: { immediate?: boolean } = {}
): Promise<boolean> {
  const client = await getPolarClient();
  if (!client) {
    console.error("Polar client not initialized");
    return false;
  }

  try {
    await client.subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: options.immediate
        ? { revoke: true }
        : { cancelAtPeriodEnd: true },
    });
    return true;
  } catch (error) {
    console.error("Failed to cancel Polar subscription:", error);
    return false;
  }
}
