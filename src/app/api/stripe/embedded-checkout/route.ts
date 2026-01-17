import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, PLANS, PlanKey, getPriceId, getTrialDays, BillingInterval } from "@/lib/stripe";

// POST /api/stripe/embedded-checkout - Create embedded checkout session
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

    const { plan, billingInterval = "monthly" } = await request.json();

    if (!plan || !(plan in PLANS) || plan === "free") {
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

    const priceId = getPriceId(plan as PlanKey, billingInterval as BillingInterval);
    const trialDays = getTrialDays(plan as PlanKey);

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not configured for this plan" },
        { status: 400 }
      );
    }

    // Create embedded checkout session with trial if applicable
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      customer_email: user.emailAddresses[0]?.emailAddress,
      client_reference_id: userId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Add trial period if plan has one
      ...(trialDays > 0 && {
        subscription_data: {
          trial_period_days: trialDays,
        },
      }),
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId,
        plan,
        billingInterval,
      },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
    });
  } catch (error) {
    console.error("Stripe embedded checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
