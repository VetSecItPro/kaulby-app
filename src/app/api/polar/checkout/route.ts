import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getPolarClient, POLAR_PLANS, PolarPlanKey, getProductId, BillingInterval } from "@/lib/polar";

import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";

/**
 * POST /api/polar/checkout
 * Create a Polar checkout session and return the checkout URL for redirect
 *
 * Note: Polar uses redirect-based checkout, not embedded checkout like Stripe
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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

    const { plan, billingInterval = "monthly" } = await parseJsonBody(request);

    // Validate plan
    if (!plan || !(plan in POLAR_PLANS) || plan === "free") {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    // Validate billing interval
    if (billingInterval !== "monthly" && billingInterval !== "annual") {
      return NextResponse.json(
        { error: "Invalid billing interval" },
        { status: 400 }
      );
    }

    const productId = getProductId(plan as PolarPlanKey, billingInterval as BillingInterval);

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID not configured for this plan" },
        { status: 400 }
      );
    }

    const customerEmail = user.emailAddresses[0]?.emailAddress;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "No email address found" },
        { status: 400 }
      );
    }

    // Create Polar checkout session
    const checkout = await polar.checkouts.custom.create({
      productId,
      customerEmail,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&provider=polar`,
      metadata: {
        userId,
        plan,
        billingInterval,
      },
    });

    return NextResponse.json({
      url: checkout.url,
      checkoutId: checkout.id,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    console.error("Polar checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
