import { logger } from "@/lib/logger";
import { PLANS, type PlanKey, type BillingInterval } from "@/lib/plans";
export type { BillingInterval } from "@/lib/plans";

// Polar SDK - dynamically imported to prevent build errors when not installed
// Install with: pnpm add @polar-sh/sdk
type PolarRequestOptions = {
  headers?: Record<string, string>;
};

type PolarClient = {
  checkouts: {
    create: (
      params: {
        products: string[];
        customerEmail?: string;
        successUrl?: string;
        metadata?: Record<string, string>;
      },
      options?: PolarRequestOptions,
    ) => Promise<{ id: string; url: string }>;
  };
  customerSessions: {
    create: (params: { customerId: string; returnUrl?: string | null }) => Promise<{ customerPortalUrl: string }>;
  };
  subscriptions: {
    list: (params: {
      customerId?: string[];
      active?: boolean;
      limit?: number;
    }) => Promise<{ result?: { items?: Array<{ id: string; productId: string; createdAt: string | Date }> } }>;
    update: (params: {
      id: string;
      subscriptionUpdate: {
        revoke?: boolean;
        cancelAtPeriodEnd?: boolean;
        productId?: string;
        // Polar enum: "invoice" | "prorate" | "next_period" | "reset"
        // Kaulby policy is "next_period" (no proration, change applies at next bill).
        prorationBehavior?: "invoice" | "prorate" | "next_period" | "reset";
      };
    }) => Promise<{ id: string; status: string }>;
    revoke: (params: { id: string }) => Promise<{ id: string; status: string }>;
  };
};

/**
 * Kaulby billing policy: NO proration, NO mid-cycle refunds.
 *
 * All subscription changes (tier downgrades, seat-addon cancellations,
 * subscription cancellations) take effect at the END of the current billing
 * period. The customer keeps what they paid for through the period, then the
 * change applies on the next renewal.
 *
 * Pass this constant as `prorationBehavior` on every subscriptions.update call
 * so we override Polar's org-level default (which may be "prorate"). If the
 * Polar dashboard org setting also matches, customer-portal-initiated changes
 * follow the same policy. If they don't match, the per-API-call value wins
 * for changes initiated through our code.
 *
 * To configure the Polar dashboard:
 *   sandbox.polar.sh → org settings → Subscription proration: "next_period"
 *   polar.sh         → org settings → Subscription proration: "next_period"
 */
export const KAULBY_PRORATION_BEHAVIOR = "next_period" as const;

// Polar client - initialized lazily to avoid import errors
let _polarClient: PolarClient | null = null;

/**
 * POLAR_ENV controls which Polar backend the SDK talks to:
 *   "sandbox"    → https://sandbox-api.polar.sh (test cards, no real money)
 *   "production" → https://api.polar.sh         (default, real money)
 *
 * Sandbox and production are completely separate accounts at Polar — the
 * access token, org, products, and webhooks all differ. Set POLAR_ENV=sandbox
 * (in .env.sandbox or Vercel preview env) along with sandbox values for
 * POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, and POLAR_*_PRODUCT_ID to test
 * the full checkout/webhook lifecycle without real charges.
 */
export function getPolarServer(): "production" | "sandbox" {
  return process.env.POLAR_ENV === "sandbox" ? "sandbox" : "production";
}

export async function getPolarClient(): Promise<PolarClient | null> {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return null;
  }

  if (_polarClient) {
    return _polarClient;
  }

  try {
    // SECURITY: Standard dynamic import replaces Function() eval — FIX-004
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = await import("@polar-sh/sdk") as any;
    const Polar = sdk.Polar;
    _polarClient = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: getPolarServer(),
    }) as unknown as PolarClient;
    return _polarClient;
  } catch {
    logger.warn("@polar-sh/sdk not installed. Run: pnpm add @polar-sh/sdk");
    return null;
  }
}

// PolarPlanKey is an alias of PlanKey. Kept as a separate export for callsites
// that mean specifically "this plan key came from / is going to Polar."
export type PolarPlanKey = PlanKey;

// Re-export PLANS as POLAR_PLANS for historical callsites that imported the
// shape from this module. New code should import PLANS from @/lib/plans.
export const POLAR_PLANS = PLANS;

// Day Pass product ID for one-time purchase (Scale-level access for 24 hours, $15)
export const DAY_PASS_PRODUCT_ID = process.env.POLAR_DAY_PASS_PRODUCT_ID || "";

// Team seat add-on (for Growth tier — $20/mo per additional seat)
export function getTeamSeatProductId(interval: BillingInterval): string | null {
  return interval === "annual"
    ? process.env.POLAR_GROWTH_SEAT_ANNUAL_PRODUCT_ID || null
    : process.env.POLAR_GROWTH_SEAT_MONTHLY_PRODUCT_ID || null;
}

export function isTeamSeatProduct(productId: string): boolean {
  return productId === process.env.POLAR_GROWTH_SEAT_MONTHLY_PRODUCT_ID ||
         productId === process.env.POLAR_GROWTH_SEAT_ANNUAL_PRODUCT_ID;
}

// Map Polar product ID to plan key (handles both monthly and annual).
// IMPORTANT: Read env vars at runtime to avoid module load order issues.
export function getPlanFromProductId(productId: string): PolarPlanKey {
  if (!productId) return "free";

  const soloMonthly = process.env.POLAR_SOLO_MONTHLY_PRODUCT_ID;
  const soloAnnual = process.env.POLAR_SOLO_ANNUAL_PRODUCT_ID;
  const scaleMonthly = process.env.POLAR_SCALE_MONTHLY_PRODUCT_ID;
  const scaleAnnual = process.env.POLAR_SCALE_ANNUAL_PRODUCT_ID;
  const growthMonthly = process.env.POLAR_GROWTH_MONTHLY_PRODUCT_ID;
  const growthAnnual = process.env.POLAR_GROWTH_ANNUAL_PRODUCT_ID;

  if (productId === soloMonthly || productId === soloAnnual) return "solo";
  if (productId === scaleMonthly || productId === scaleAnnual) return "scale";
  if (productId === growthMonthly || productId === growthAnnual) return "growth";

  // SECURITY (SEC-LOGIC-001): Log unknown product IDs — silent fallback masks misconfiguration
  logger.warn("Unknown Polar product ID — falling back to free tier", {
    productId,
    configuredIds: { soloMonthly, soloAnnual, scaleMonthly, scaleAnnual, growthMonthly, growthAnnual },
  });
  return "free";
}

// Get the appropriate product ID based on plan and billing interval.
// IMPORTANT: Read env vars at runtime to avoid module load order issues.
export function getProductId(plan: PolarPlanKey, interval: BillingInterval): string | null {
  if (plan === "free") return null;

  if (plan === "solo") {
    return interval === "annual"
      ? process.env.POLAR_SOLO_ANNUAL_PRODUCT_ID || null
      : process.env.POLAR_SOLO_MONTHLY_PRODUCT_ID || null;
  }

  if (plan === "scale") {
    return interval === "annual"
      ? process.env.POLAR_SCALE_ANNUAL_PRODUCT_ID || null
      : process.env.POLAR_SCALE_MONTHLY_PRODUCT_ID || null;
  }

  if (plan === "growth") {
    return interval === "annual"
      ? process.env.POLAR_GROWTH_ANNUAL_PRODUCT_ID || null
      : process.env.POLAR_GROWTH_MONTHLY_PRODUCT_ID || null;
  }

  return null;
}

// Cancel/revoke a subscription (for account deletion)
export async function cancelSubscription(
  subscriptionId: string,
  options: { immediate?: boolean } = {}
): Promise<boolean> {
  const client = await getPolarClient();
  if (!client) {
    logger.error("Polar client not initialized");
    return false;
  }

  try {
    await client.subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: options.immediate
        ? { revoke: true }
        : { cancelAtPeriodEnd: true, prorationBehavior: KAULBY_PRORATION_BEHAVIOR },
    });
    return true;
  } catch (error) {
    logger.error("Failed to cancel Polar subscription", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
