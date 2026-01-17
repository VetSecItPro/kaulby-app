import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

// Lazy initialization to avoid build-time errors when env vars are missing
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(key, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * POST /api/stripe/day-pass
 * Create a Stripe checkout session for Day Pass purchase ($10 one-time)
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if price ID is configured
    const dayPassPriceId = process.env.STRIPE_DAY_PASS_PRICE_ID;
    if (!dayPassPriceId || dayPassPriceId.includes("PLACEHOLDER")) {
      return NextResponse.json(
        { error: "Day Pass not yet configured. Please check back soon!" },
        { status: 503 }
      );
    }

    // Get Stripe client (lazy initialization)
    const stripe = getStripe();

    // Get user's email for Stripe
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;

      // Save customer ID
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: dayPassPriceId,
          quantity: 1,
        },
      ],
      mode: "payment", // One-time payment, not subscription
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?day_pass=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?day_pass=cancelled`,
      metadata: {
        userId,
        type: "day_pass",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Day pass checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

