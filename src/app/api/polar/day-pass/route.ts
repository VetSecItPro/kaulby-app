import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPolarClient, DAY_PASS_PRODUCT_ID } from "@/lib/polar";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * POST /api/polar/day-pass
 * Create a Polar checkout session for Day Pass purchase ($10 one-time)
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

    // Check if product ID is configured
    if (!DAY_PASS_PRODUCT_ID || DAY_PASS_PRODUCT_ID === "") {
      return NextResponse.json(
        { error: "Day Pass not yet configured. Please check back soon!" },
        { status: 503 }
      );
    }

    // Get user's email - id is the Clerk user ID
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create Polar checkout session for one-time payment
    const checkout = await polar.checkouts.custom.create({
      productId: DAY_PASS_PRODUCT_ID,
      customerEmail: user.email,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?day_pass=success&provider=polar`,
      metadata: {
        userId,
        type: "day_pass",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Polar day pass checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
