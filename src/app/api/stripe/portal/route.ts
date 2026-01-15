import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/stripe/portal - Redirect to Stripe Customer Portal
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Get user's Stripe customer ID (users.id is the Clerk user ID)
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.stripeCustomerId) {
      // No Stripe customer - redirect to pricing
      return NextResponse.redirect(new URL("/pricing", request.url));
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
    });

    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error("Stripe portal error:", error);
    return NextResponse.redirect(new URL("/dashboard/settings?error=billing", request.nextUrl.origin));
  }
}
