import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db, users } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getPlanFromProductId, PolarPlanKey } from "@/lib/polar";
import { workspaces } from "@/lib/db/schema";

// PERF: Webhook processing may take longer than default 10s — FIX-016
export const maxDuration = 60;
import { upsertContact, sendSubscriptionEmail } from "@/lib/email";
import { captureEvent } from "@/lib/posthog";
import { activateDayPass } from "@/lib/day-pass";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Maximum number of founding members who lock in price forever
const FOUNDING_MEMBER_LIMIT = 1000;

// Polar webhook event types
interface PolarWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

// Map PolarPlanKey to subscription status for database
// Now an identity function since internal naming matches Polar's "team" key
function mapPlanToSubscriptionStatus(plan: PolarPlanKey): "free" | "pro" | "team" {
  return plan;
}

// Verify Polar webhook signature using HMAC-SHA256
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    // Use timing-safe comparison
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/polar
 * Handle Polar webhook events
 *
 * IMPORTANT: Before using this handler, ensure you have:
 * 1. Added polarCustomerId and polarSubscriptionId columns to users table
 * 2. Run: pnpm db:push
 * 3. Set POLAR_WEBHOOK_SECRET in .env.local
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("POLAR_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get signature from headers
  // Polar may use different header names - check their docs
  const signature =
    request.headers.get("x-polar-signature") ||
    request.headers.get("polar-signature") ||
    request.headers.get("x-webhook-signature");

  if (!verifyWebhookSignature(body, signature, webhookSecret)) {
    console.error("Polar webhook signature verification failed");
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  let event: PolarWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    console.error("Failed to parse webhook body");
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    // SECURITY (SEC-INTEG-008): Idempotency guard — skip duplicate webhook events
    const eventId = (event.data?.id as string) || createHmac("sha256", "polar-webhook").update(JSON.stringify(event)).digest("hex").slice(0, 32);
    try {
      await db.insert(webhookEvents).values({
        eventId,
        eventType: event.type,
        provider: "polar",
      });
    } catch (dupError: unknown) {
      // Unique constraint violation = duplicate event — return 200 to stop retries
      if (dupError instanceof Error && dupError.message?.includes("unique")) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw dupError;
    }

    const eventData = event.data;

    switch (event.type) {
      case "checkout.updated": {
        // Checkout completed - process subscription or one-time payment
        const status = eventData.status as string;

        if (status !== "succeeded") {
          // Only process successful checkouts
          break;
        }

        const metadata = eventData.metadata as Record<string, string> | undefined;
        const userId = metadata?.userId;
        const customerId = eventData.customerId as string;
        const productId = eventData.productId as string;

        if (!userId) {
          console.error("No userId in checkout metadata");
          break;
        }

        // Handle Day Pass one-time purchase
        if (metadata?.type === "day_pass") {
          const dayPassResult = await activateDayPass(userId);

          // Track in PostHog
          captureEvent({
            distinctId: userId,
            event: "day_pass_purchased",
            properties: {
              provider: "polar",
              checkoutId: eventData.id as string,
              expiresAt: dayPassResult.expiresAt.toISOString(),
              purchaseCount: dayPassResult.purchaseCount,
            },
          });

          logger.info(`Day pass activated for user ${userId} via Polar webhook`);
          break;
        }

        // Handle Team Seat add-on purchase
        if (metadata?.type === "team_seat") {
          const workspaceId = metadata.workspaceId;
          if (workspaceId) {
            // Increment seat limit by 1 atomically
            await db
              .update(workspaces)
              .set({
                seatLimit: sql`${workspaces.seatLimit} + 1`,
              })
              .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)));

            captureEvent({
              distinctId: userId,
              event: "team_seat_purchased",
              properties: {
                provider: "polar",
                workspaceId,
                checkoutId: eventData.id as string,
              },
            });

            logger.info(`Team seat added for workspace ${workspaceId} by user ${userId}`);
          }
          break;
        }

        // Regular subscription checkout - store the customer ID
        if (customerId) {
          await db
            .update(users)
            .set({
              polarCustomerId: customerId,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        }

        // Get plan from product ID
        const plan = getPlanFromProductId(productId);
        const subscriptionStatus = mapPlanToSubscriptionStatus(plan);

        // Track checkout completed
        captureEvent({
          distinctId: userId,
          event: "checkout_completed",
          properties: {
            provider: "polar",
            plan: subscriptionStatus,
            productId,
          },
        });
        break;
      }

      case "subscription.created":
      case "subscription.active": {
        // Subscription is active - update user's subscription status
        const customerId = eventData.customerId as string;
        const subscriptionId = eventData.id as string;
        const productId = eventData.productId as string;
        const currentPeriodStart = eventData.currentPeriodStart as string | undefined;
        const currentPeriodEnd = eventData.currentPeriodEnd as string | undefined;

        const plan = getPlanFromProductId(productId);
        const subscriptionStatus = mapPlanToSubscriptionStatus(plan);

        // Find user by Polar customer ID
        const user = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, customerId),
        });

        if (!user) {
          console.error(`No user found for Polar customer ${customerId}`);
          break;
        }

        // Atomically assign founding member number using UPDATE with subquery
        let isFoundingMember = false;
        let foundingMemberNumber: number | null = null;

        if (plan === "pro" || plan === "team") {
          // Security (SEC-11): Use advisory lock to prevent race condition on founding member assignment.
          // Without the lock, two concurrent webhooks could both read the same COUNT and assign
          // the same foundingMemberNumber.
          const result = await db.transaction(async (tx) => {
            // Advisory lock scoped to this transaction — released automatically on commit
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw("hashtext('founding-member')")})`);

            return tx
              .update(users)
              .set({
                polarSubscriptionId: subscriptionId,
                subscriptionStatus: subscriptionStatus,
                currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : undefined,
                currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
                isFoundingMember: sql`CASE
                  WHEN (SELECT COUNT(*) FROM ${users} WHERE ${users.isFoundingMember} = true) < ${FOUNDING_MEMBER_LIMIT}
                  THEN true
                  ELSE false
                END`,
                foundingMemberNumber: sql`CASE
                  WHEN (SELECT COUNT(*) FROM ${users} WHERE ${users.isFoundingMember} = true) < ${FOUNDING_MEMBER_LIMIT}
                  THEN (SELECT COUNT(*) FROM ${users} WHERE ${users.isFoundingMember} = true) + 1
                  ELSE NULL
                END`,
                foundingMemberPriceId: sql`CASE
                  WHEN (SELECT COUNT(*) FROM ${users} WHERE ${users.isFoundingMember} = true) < ${FOUNDING_MEMBER_LIMIT}
                  THEN ${productId}
                  ELSE NULL
                END`,
                updatedAt: new Date(),
              })
              .where(eq(users.id, user.id))
              .returning({
                isFoundingMember: users.isFoundingMember,
                foundingMemberNumber: users.foundingMemberNumber,
              });
          });

          if (result[0]) {
            isFoundingMember = result[0].isFoundingMember || false;
            foundingMemberNumber = result[0].foundingMemberNumber;
          }
        } else {
          // Non-founding-member eligible plans
          await db
            .update(users)
            .set({
              polarSubscriptionId: subscriptionId,
              subscriptionStatus: subscriptionStatus,
              currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : undefined,
              currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
        }

        // SECURITY (SEC-INTEG-013): Non-blocking side effects — don't let email failure cause 500
        Promise.all([
          upsertContact({ email: user.email, userId: user.id, subscriptionStatus: subscriptionStatus }),
          sendSubscriptionEmail({ email: user.email, name: user.name || undefined, plan: plan === "team" ? "Team" : plan.charAt(0).toUpperCase() + plan.slice(1) })
            .catch(async (err) => {
              logger.error("Subscription email failed", { error: err, userId: user.id });
              const { pooledDb } = await import("@/lib/db");
              const { emailDeliveryFailures } = await import("@/lib/db/schema");
              await pooledDb.insert(emailDeliveryFailures).values({
                userId: user.id,
                emailType: "subscription",
                recipient: user.email,
                subject: "Subscription confirmation",
                errorMessage: err instanceof Error ? err.message : String(err),
                retryCount: 0,
                maxRetries: 0,
              }).catch(() => {}); // don't let DB error mask webhook response
            }),
        ]).catch((err) => logger.error("Subscription side effects failed", { error: err }));

        // Track in PostHog
        captureEvent({
          distinctId: user.id,
          event: "subscription_created",
          properties: {
            provider: "polar",
            plan: subscriptionStatus,
            productId,
            subscriptionId,
            isFoundingMember,
            foundingMemberNumber,
          },
        });
        break;
      }

      case "subscription.updated": {
        // Subscription was updated (e.g., plan change, payment failure)
        const customerId = eventData.customerId as string;
        const productId = eventData.productId as string;
        const currentPeriodStart = eventData.currentPeriodStart as string | undefined;
        const currentPeriodEnd = eventData.currentPeriodEnd as string | undefined;
        const status = eventData.status as string;

        const plan = getPlanFromProductId(productId);

        // Security (SEC-12): Check subscription status — don't grant paid tier if payment failed.
        // Polar sends status: "active", "past_due", "unpaid", "incomplete", "canceled"
        const DEGRADED_STATUSES = ["past_due", "unpaid", "incomplete"];
        const effectiveStatus = DEGRADED_STATUSES.includes(status)
          ? "free" as const  // Downgrade to free on payment failure
          : mapPlanToSubscriptionStatus(plan);

        await db
          .update(users)
          .set({
            subscriptionStatus: effectiveStatus,
            currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : undefined,
            currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.polarCustomerId, customerId));

        // Get user for tracking
        const user = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, customerId),
        });

        if (user) {
          captureEvent({
            distinctId: user.id,
            event: "subscription_updated",
            properties: {
              provider: "polar",
              plan: effectiveStatus,
              polarStatus: status,
              wasDegraded: DEGRADED_STATUSES.includes(status),
            },
          });
        }
        break;
      }

      case "subscription.canceled": {
        // SECURITY (SEC-LOGIC-007): Honor remaining billing period on voluntary cancellation
        // The user paid for the full period — don't strip access immediately
        const canceledCustomerId = eventData.customerId as string;
        const canceledPeriodEnd = eventData.currentPeriodEnd as string | undefined;

        await db
          .update(users)
          .set({
            // Keep current tier until period end; Polar will send subscription.revoked when it actually expires
            currentPeriodEnd: canceledPeriodEnd ? new Date(canceledPeriodEnd) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.polarCustomerId, canceledCustomerId));

        const canceledUser = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, canceledCustomerId),
        });

        if (canceledUser) {
          // SECURITY (SEC-INTEG-013): Non-blocking side effects — don't let email failure cause 500
          Promise.all([
            upsertContact({ email: canceledUser.email, userId: canceledUser.id, subscriptionStatus: canceledUser.subscriptionStatus ?? "free" }),
          ]).catch((err) => logger.error("Cancellation side effects failed", { error: err }));

          captureEvent({
            distinctId: canceledUser.id,
            event: "subscription_canceled",
            properties: { provider: "polar", periodEnd: canceledPeriodEnd },
          });
        }
        break;
      }

      case "subscription.revoked": {
        // Subscription actually expired or was revoked — now downgrade to free
        const revokedCustomerId = eventData.customerId as string;

        await db
          .update(users)
          .set({
            polarSubscriptionId: null,
            subscriptionStatus: "free",
            updatedAt: new Date(),
          })
          .where(eq(users.polarCustomerId, revokedCustomerId));

        const revokedUser = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, revokedCustomerId),
        });

        if (revokedUser) {
          // SECURITY (SEC-INTEG-013): Non-blocking side effects
          Promise.all([
            upsertContact({ email: revokedUser.email, userId: revokedUser.id, subscriptionStatus: "free" }),
          ]).catch((err) => logger.error("Revocation side effects failed", { error: err }));

          captureEvent({
            distinctId: revokedUser.id,
            event: "subscription_revoked",
            properties: { provider: "polar" },
          });
        }
        break;
      }

      case "order.refunded": {
        // Handle refund - similar to subscription.revoked
        const customerId = eventData.customerId as string;
        const subscriptionId = eventData.subscriptionId as string | undefined;

        // If this is a subscription refund, cancel the subscription
        if (subscriptionId) {
          await db
            .update(users)
            .set({
              polarSubscriptionId: null,
              subscriptionStatus: "free",
              updatedAt: new Date(),
            })
            .where(eq(users.polarCustomerId, customerId));
        }

        const user = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, customerId),
        });

        if (user) {
          captureEvent({
            distinctId: user.id,
            event: "order_refunded",
            properties: {
              provider: "polar",
              orderId: eventData.id as string,
            },
          });
        }
        break;
      }

      default:
        logger.info(`Unhandled Polar event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Polar webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
