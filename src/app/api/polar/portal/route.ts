import { getEffectiveUserId } from "@/lib/dev-auth";
import { NextResponse } from "next/server";
import { getPolarClient } from "@/lib/polar";
import { findUserWithFallback } from "@/lib/auth-utils";

import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
export const dynamic = "force-dynamic";

/**
 * POST /api/polar/portal
 * Create a Polar customer portal session URL for managing subscriptions
 */
export async function POST() {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    }

    const polar = await getPolarClient();
    if (!polar) {
      return NextResponse.json(
        { error: "Polar not configured. Install @polar-sh/sdk and set POLAR_ACCESS_TOKEN." },
        { status: 503 }
      );
    }

    // Get user's Polar customer ID (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user?.polarCustomerId) {
      // No Polar customer ID - redirect to Polar dashboard for manual management
      // This can happen if the webhook hasn't processed yet or there's a sync issue
      logger.warn("[polar-portal] No polarCustomerId for user:", { detail: userId });
      return NextResponse.json(
        {
          error: "No subscription found. Please contact support if you believe this is an error.",
          fallbackUrl: "https://polar.sh/settings"
        },
        { status: 400 }
      );
    }

    // Create Polar customer session
    // Portal session creation - no debug logging in production
    const session = await polar.customerSessions.create({
      customerId: user.polarCustomerId,
    });

    return NextResponse.json({
      url: session.customerPortalUrl,
    });
  } catch (error) {
    logger.error("Polar portal error:", { error: error instanceof Error ? error.message : String(error) });
    // SECURITY: Sanitized error logging - FIX-001
    if (error instanceof Error) {
      logger.error("Portal session creation failed:", { error_message: error.message });
    }
    // SECURITY: Never expose internal error details to client
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
