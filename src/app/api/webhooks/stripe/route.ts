import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import { db, users } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { upsertContact, sendSubscriptionEmail, sendPaymentFailedEmail } from "@/lib/email";
import { captureEvent } from "@/lib/posthog";
import Stripe from "stripe";

// Maximum number of founding members who lock in price forever
const FOUNDING_MEMBER_LIMIT = 1000;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const plan = getPlanFromPriceId(priceId || "");

          // Check founding member eligibility (only for paid plans)
          let isFoundingMember = false;
          let foundingMemberNumber: number | null = null;

          if (plan === "pro" || plan === "enterprise") {
            // Count existing founding members
            const countResult = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(users)
              .where(eq(users.isFoundingMember, true));

            const currentCount = countResult[0]?.count || 0;

            if (currentCount < FOUNDING_MEMBER_LIMIT) {
              isFoundingMember = true;
              foundingMemberNumber = currentCount + 1;
            }
          }

          // Update user in database
          await db
            .update(users)
            .set({
              stripeCustomerId: customerId,
              subscriptionId: subscriptionId,
              subscriptionStatus: plan,
              // Founding member fields
              isFoundingMember,
              foundingMemberNumber,
              foundingMemberPriceId: isFoundingMember ? priceId : null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

          // Get user for email
          const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
          });

          if (user) {
            // Update contact info
            await upsertContact({
              email: user.email,
              userId: user.id,
              subscriptionStatus: plan,
            });

            // Send confirmation email
            await sendSubscriptionEmail({
              email: user.email,
              name: user.name || undefined,
              plan: plan.charAt(0).toUpperCase() + plan.slice(1),
            });

            // Track in PostHog
            captureEvent({
              distinctId: userId,
              event: "subscription_created",
              properties: {
                plan,
                priceId,
                subscriptionId,
                isFoundingMember,
                foundingMemberNumber,
              },
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId || "");

        const status = subscription.status === "active" ? plan : "free";

        await db
          .update(users)
          .set({
            subscriptionStatus: status,
            updatedAt: new Date(),
          })
          .where(eq(users.stripeCustomerId, customerId));

        // Get user for tracking
        const user = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, customerId),
        });

        if (user) {
          captureEvent({
            distinctId: user.id,
            event: "subscription_updated",
            properties: {
              plan: status,
              stripeStatus: subscription.status,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await db
          .update(users)
          .set({
            subscriptionId: null,
            subscriptionStatus: "free",
            updatedAt: new Date(),
          })
          .where(eq(users.stripeCustomerId, customerId));

        // Get user for tracking
        const user = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, customerId),
        });

        if (user) {
          await upsertContact({
            email: user.email,
            userId: user.id,
            subscriptionStatus: "free",
          });

          captureEvent({
            distinctId: user.id,
            event: "subscription_canceled",
            properties: {},
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Get user for email
        const user = await db.query.users.findFirst({
          where: eq(users.stripeCustomerId, customerId),
        });

        if (user) {
          await sendPaymentFailedEmail({
            email: user.email,
            name: user.name || undefined,
          });

          captureEvent({
            distinctId: user.id,
            event: "payment_failed",
            properties: {
              invoiceId: invoice.id,
            },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
