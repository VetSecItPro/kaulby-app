import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getPolarClient, DAY_PASS_PRODUCT_ID } from "@/lib/polar";

import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
export const dynamic = "force-dynamic";

/**
 * POST /api/polar/day-pass
 * Create a Polar checkout session for Day Pass purchase ($10 one-time)
 */
export async function POST() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
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

    // Check if product ID is configured
    if (!DAY_PASS_PRODUCT_ID || DAY_PASS_PRODUCT_ID === "") {
      return NextResponse.json(
        { error: "Day Pass not yet configured. Please check back soon!" },
        { status: 503 }
      );
    }

    const customerEmail = user.emailAddresses[0]?.emailAddress;

    if (!customerEmail) {
      return NextResponse.json({ error: "No email address found" }, { status: 400 });
    }

    // Create Polar checkout session for one-time payment
    const checkout = await polar.checkouts.create({
      products: [DAY_PASS_PRODUCT_ID],
      customerEmail,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?day_pass=success&provider=polar`,
      metadata: {
        userId,
        type: "day_pass",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errDetail = (error as { statusCode?: number; detail?: unknown })?.statusCode;
    logger.error("Polar day pass checkout error:", { message: errMsg, statusCode: errDetail, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: errMsg },
      { status: 500 }
    );
  }
}
