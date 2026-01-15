import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe, PLANS, PlanKey } from "@/lib/stripe";

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

    const { plan } = await request.json();

    if (!plan || !(plan in PLANS) || plan === "free") {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    const selectedPlan = PLANS[plan as PlanKey];

    if (!selectedPlan.priceId) {
      return NextResponse.json(
        { error: "Price ID not configured for this plan" },
        { status: 400 }
      );
    }

    // Create embedded checkout session
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      customer_email: user.emailAddresses[0]?.emailAddress,
      client_reference_id: userId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId,
        plan,
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
