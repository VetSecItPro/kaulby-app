import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPolarClient } from "@/lib/polar";
import { findUserWithFallback } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/polar/portal
 * Create a Polar customer portal session URL for managing subscriptions
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      console.log("No polarCustomerId found for user:", userId);
      return NextResponse.json(
        {
          error: "No subscription found. Please contact support if you believe this is an error.",
          fallbackUrl: "https://polar.sh/settings"
        },
        { status: 400 }
      );
    }

    // Create Polar customer session
    console.log("Creating portal session for customer:", user.polarCustomerId);
    const session = await polar.customerSessions.create({
      customerId: user.polarCustomerId,
    });

    return NextResponse.json({
      url: session.customerPortalUrl,
    });
  } catch (error) {
    console.error("Polar portal error:", error);
    // SECURITY: Sanitized error logging — FIX-001
    if (error instanceof Error) {
      console.error("Portal session creation failed:", error.message);
    }
    // Check if it's a Polar API error with more details
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create portal session", details: errorMessage },
      { status: 500 }
    );
  }
}
