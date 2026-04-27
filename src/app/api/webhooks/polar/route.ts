import type { PlanKey } from "@/lib/plans";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db, pooledDb, users } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getPlanFromProductId, getPolarClient, isTeamSeatProduct, PolarPlanKey } from "@/lib/polar";
import { workspaces } from "@/lib/db/schema";

// PERF: Webhook processing may take longer than default 10s — FIX-016
export const maxDuration = 60;
import {
  upsertContact,
  sendSubscriptionEmail,
  sendSubscriptionUpgradedEmail,
  sendSubscriptionDowngradedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionRevokedEmail,
  sendRefundEmail,
  sendDayPassReceiptEmail,
} from "@/lib/email";
import { captureEvent } from "@/lib/posthog";
import { track } from "@/lib/analytics";
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
// Now an identity function since internal naming matches Polar's "growth" key
function mapPlanToSubscriptionStatus(plan: PolarPlanKey): PlanKey {
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
    logger.error("POLAR_WEBHOOK_SECRET not configured");
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
    logger.error("Polar webhook signature verification failed");
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  let event: PolarWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    logger.error("Failed to parse webhook body");
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    // SECURITY (SEC-INTEG-008): Idempotency guard - skip duplicate webhook events.
    //
    // CRITICAL: Polar webhook envelope is { type, timestamp, data } with NO
    // top-level event ID. data.id is the RESOURCE id (subscription/checkout/
    // order). Using bare data.id meant subscription.created and
    // subscription.canceled for the same subscription would collide and the
    // second event would be rejected as a duplicate, freezing the state
    // machine on the first event ever received.
    //
    // Fix: prefer the Standard Webhooks 'webhook-id' header (Polar sends this
    // per the spec - unique per delivery, stable across retries). Fall back
    // to hash of (type + body), which scopes idempotency to a specific
    // event-on-resource transition.
    const webhookId =
      request.headers.get("webhook-id") ||
      request.headers.get("polar-webhook-id") ||
      request.headers.get("x-webhook-id");
    const eventId = webhookId
      || createHmac("sha256", "polar-webhook")
           .update(`${event.type}:${body}`)
           .digest("hex")
           .slice(0, 64);
    try {
      await db.insert(webhookEvents).values({
        eventId,
        eventType: event.type,
        provider: "polar",
      });
    } catch (dupError: unknown) {
      // Unique constraint violation = duplicate event - return 200 to stop retries.
      // Drizzle/Neon wrap pg errors; check both the message and the pg error code
      // (23505 = unique_violation) so the duplicate guard works across drivers.
      // Confirmed via sandbox e2e: raw pg → 'unique' substring; Neon serverless
      // wrap → 'duplicate key' substring + cause.code='23505'.
      const errMsg = dupError instanceof Error ? dupError.message : String(dupError);
      const pgCode = (dupError as { code?: string; cause?: { code?: string } })?.code
        ?? (dupError as { cause?: { code?: string } })?.cause?.code;
      if (
        errMsg.includes("unique") ||
        errMsg.includes("duplicate key") ||
        pgCode === "23505"
      ) {
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
          logger.error("No userId in checkout metadata");
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

          // Task 1.4: typed revenue event — day pass grants pro-tier access,
          // so we attribute it to the pro tier with a day_pass interval so
          // LTV/conversion dashboards can distinguish one-time vs recurring.
          track("payment.succeeded", {
            userId,
            tier: "solo",
            interval: "day_pass",
          });

          logger.info(`Day pass activated for user ${userId} via Polar webhook`);

          // K8: Day Pass receipt email - non-blocking
          const dayPassUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { email: true, name: true },
          });
          if (dayPassUser?.email) {
            sendDayPassReceiptEmail({
              email: dayPassUser.email,
              name: dayPassUser.name || undefined,
              expiresAt: dayPassResult.expiresAt,
            }).catch((err) =>
              logger.error("Day Pass receipt email failed", { userId, error: err instanceof Error ? err.message : String(err) }),
            );
          }
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
          logger.error(`No user found for Polar customer ${customerId}`);
          break;
        }

        // FIX #11 (stale subscription.active): If the user is already on a higher
        // tier with a DIFFERENT subscription_id, this event is most likely a
        // late/replayed event from an older subscription that's since been
        // superseded by an upgrade. Apply only when (a) user is on free, OR
        // (b) the incoming sub_id matches the user's current sub_id (renewal
        // refresh), OR (c) the new tier rank is >= current tier rank (upgrade).
        // Otherwise: stale event, ignore the body, log it.
        const TIER_RANK_ACTIVE: Record<string, number> = { free: 0, solo: 1, scale: 2, growth: 3 };
        const currentRank = TIER_RANK_ACTIVE[user.subscriptionStatus ?? "free"] ?? 0;
        const incomingRank = TIER_RANK_ACTIVE[subscriptionStatus] ?? 0;
        const isStaleDowngrade =
          user.polarSubscriptionId &&
          user.polarSubscriptionId !== subscriptionId &&
          incomingRank < currentRank;
        if (isStaleDowngrade) {
          logger.warn("Ignoring stale subscription.active event for older sub", {
            userId: user.id,
            currentSubId: user.polarSubscriptionId,
            incomingSubId: subscriptionId,
            currentTier: user.subscriptionStatus,
            incomingTier: subscriptionStatus,
          });
          break;
        }

        // Reverse trial: every new paid signup gets 14 days of Growth-tier
        // features regardless of which tier they bought. Only granted on the
        // FIRST paid subscription (skip if user already had a trial OR is
        // already on Growth — they wouldn't benefit).
        const isFirstPaidSubscription = !user.trialEndsAt && user.subscriptionStatus === "free";
        const grantsTrial = isFirstPaidSubscription && plan !== "growth" && plan !== "free";
        const trialEndsAt = grantsTrial
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          : undefined;
        const trialTier = grantsTrial ? ("growth" as const) : undefined;

        // Atomically assign founding member number using UPDATE with subquery
        let isFoundingMember = false;
        let foundingMemberNumber: number | null = null;

        if (plan === "solo" || plan === "growth") {
          // Security (SEC-11): Use advisory lock to prevent race condition on founding member assignment.
          // Without the lock, two concurrent webhooks could both read the same COUNT and assign
          // the same foundingMemberNumber.
          // CRITICAL: db (neon-http) doesn't support transactions — only single
          // statements over HTTP. Use pooledDb (neon-serverless WebSocket) for
          // anything wrapped in db.transaction(). Skipping this caused every
          // Solo/Growth subscription.active webhook to 500 silently in prod.
          const result = await pooledDb.transaction(async (tx) => {
            // Advisory lock scoped to this transaction — released automatically on commit
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw("hashtext('founding-member')")})`);

            return tx
              .update(users)
              .set({
                polarSubscriptionId: subscriptionId,
                subscriptionStatus: subscriptionStatus,
                currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : undefined,
                currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
                ...(grantsTrial && trialEndsAt && trialTier
                  ? { trialEndsAt, trialTier }
                  : {}),
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
          // Non-founding-member eligible plans (e.g., scale)
          await db
            .update(users)
            .set({
              polarSubscriptionId: subscriptionId,
              subscriptionStatus: subscriptionStatus,
              currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : undefined,
              currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
              ...(grantsTrial && trialEndsAt && trialTier
                ? { trialEndsAt, trialTier }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));
        }

        // SECURITY (SEC-INTEG-013): Non-blocking side effects — don't let email failure cause 500
        Promise.all([
          upsertContact({ email: user.email, userId: user.id, subscriptionStatus: subscriptionStatus }),
          sendSubscriptionEmail({ email: user.email, name: user.name || undefined, plan: plan === "growth" ? "Team" : plan.charAt(0).toUpperCase() + plan.slice(1) })
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

        // Task 1.4: typed revenue event — only paid tiers. Interval defaults
        // to monthly; Polar product IDs don't reliably tell us annual vs
        // monthly here, so annual detection is left to Task 1.4b once we wire
        // product metadata. Skipping on "free" keeps the funnel clean.
        if (subscriptionStatus === "solo" || subscriptionStatus === "growth") {
          track("payment.succeeded", {
            userId: user.id,
            tier: subscriptionStatus,
            interval: "monthly",
          });
        }
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

        // Security (SEC-12): Check subscription status - don't grant paid tier if payment failed.
        // Polar sends status: "active", "past_due", "unpaid", "incomplete", "canceled"
        const DEGRADED_STATUSES = ["past_due", "unpaid", "incomplete"];
        const effectiveStatus = DEGRADED_STATUSES.includes(status)
          ? "free" as const  // Downgrade to free on payment failure
          : mapPlanToSubscriptionStatus(plan);

        // Capture previous status BEFORE the update so we can detect
        // upgrade vs downgrade and fire the right K3/K4 email.
        const userBefore = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, customerId),
          columns: { id: true, email: true, name: true, subscriptionStatus: true },
        });

        await db
          .update(users)
          .set({
            subscriptionStatus: effectiveStatus,
            currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : undefined,
            currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.polarCustomerId, customerId));

        // K3/K4: tier change emails. Tier rank: free<solo<scale<growth.
        // Only fire if the tier actually changed (not on renewal with same plan).
        if (userBefore) {
          const TIER_RANK: Record<string, number> = { free: 0, solo: 1, scale: 2, growth: 3 };
          const oldRank = TIER_RANK[userBefore.subscriptionStatus ?? "free"] ?? 0;
          const newRank = TIER_RANK[effectiveStatus] ?? 0;
          if (oldRank !== newRank && userBefore.email) {
            const fromPlanName = (userBefore.subscriptionStatus ?? "free");
            const toPlanName = effectiveStatus;
            const fromCap = fromPlanName.charAt(0).toUpperCase() + fromPlanName.slice(1);
            const toCap = toPlanName.charAt(0).toUpperCase() + toPlanName.slice(1);
            const sendFn = newRank > oldRank
              ? sendSubscriptionUpgradedEmail
              : sendSubscriptionDowngradedEmail;
            sendFn({
              email: userBefore.email,
              name: userBefore.name || undefined,
              fromPlan: fromCap,
              toPlan: toCap,
            }).catch((err) =>
              logger.error("Tier change email failed", {
                userId: userBefore.id,
                direction: newRank > oldRank ? "upgrade" : "downgrade",
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }

          captureEvent({
            distinctId: userBefore.id,
            event: "subscription_updated",
            properties: {
              provider: "polar",
              plan: effectiveStatus,
              polarStatus: status,
              wasDegraded: DEGRADED_STATUSES.includes(status),
              previousPlan: userBefore.subscriptionStatus,
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
          // SECURITY (SEC-INTEG-013): Non-blocking side effects - don't let email failure cause 500
          Promise.all([
            upsertContact({ email: canceledUser.email, userId: canceledUser.id, subscriptionStatus: canceledUser.subscriptionStatus ?? "free" }),
            // K5: Cancellation acknowledgment email - confirms cancel + tells user when access ends
            sendSubscriptionCanceledEmail({
              email: canceledUser.email,
              name: canceledUser.name || undefined,
              plan: (canceledUser.subscriptionStatus ?? "free").charAt(0).toUpperCase() + (canceledUser.subscriptionStatus ?? "free").slice(1),
              periodEnd: canceledPeriodEnd,
            }),
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
        const revokedProductId = eventData.productId as string | undefined;

        // Seat-addon revocation (Approach B): the user's billing period ended
        // for a seat-addon they previously canceled. Decrement seatLimit on
        // their workspace; do NOT downgrade their main tier.
        if (revokedProductId && isTeamSeatProduct(revokedProductId)) {
          const ownerUser = await db.query.users.findFirst({
            where: eq(users.polarCustomerId, revokedCustomerId),
            columns: { id: true },
          });
          if (ownerUser) {
            // GREATEST guard prevents seatLimit dropping below the 3 baseline
            // included with Growth, even if multiple revoke events race.
            await db
              .update(workspaces)
              .set({
                seatLimit: sql`GREATEST(${workspaces.seatLimit} - 1, 3)`,
              })
              .where(eq(workspaces.ownerId, ownerUser.id));

            captureEvent({
              distinctId: ownerUser.id,
              event: "team_seat_revoked",
              properties: { provider: "polar", productId: revokedProductId },
            });
            logger.info(`Team seat revoked at period end`, { userId: ownerUser.id });
          }
          break;
        }

        // Capture tier BEFORE the downgrade so the revoke email shows
        // what plan they had (not the now-free state).
        const userBeforeRevoke = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, revokedCustomerId),
          columns: { id: true, email: true, name: true, subscriptionStatus: true },
        });

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
          const previousPlan = userBeforeRevoke?.subscriptionStatus ?? "Subscription";
          const previousPlanCap = previousPlan.charAt(0).toUpperCase() + previousPlan.slice(1);
          Promise.all([
            upsertContact({ email: revokedUser.email, userId: revokedUser.id, subscriptionStatus: "free" }),
            // K6: Access-lost / period-ended email
            sendSubscriptionRevokedEmail({
              email: revokedUser.email,
              name: revokedUser.name || undefined,
              plan: previousPlanCap,
            }),
          ]).catch((err) => logger.error("Revocation side effects failed", { error: err }));

          captureEvent({
            distinctId: revokedUser.id,
            event: "subscription_revoked",
            properties: { provider: "polar" },
          });

          // Cascade-cancel any active seat-addon subscriptions. Without this,
          // a Growth user who downgrades keeps paying $20/mo per extra seat
          // for capacity their workspace can no longer use - silent billing
          // for nothing. Set cancelAtPeriodEnd so they keep the seats through
          // the rest of their seat billing period (Approach B), then the
          // existing seat-revoked handler decrements seatLimit naturally.
          //
          // Wrapped in its own try/catch: a Polar API failure here must not
          // fail the webhook (Polar would retry the whole revoke event,
          // re-running the user downgrade we just did).
          try {
            const polar = await getPolarClient();
            if (polar && revokedCustomerId) {
              const list = await polar.subscriptions.list({
                customerId: [revokedCustomerId],
                active: true,
                limit: 100,
              });
              const subs = list?.result?.items ?? [];
              const seatAddons = subs.filter((s) => isTeamSeatProduct(s.productId));
              for (const sub of seatAddons) {
                await polar.subscriptions.update({
                  id: sub.id,
                  subscriptionUpdate: { cancelAtPeriodEnd: true },
                });
              }
              if (seatAddons.length > 0) {
                captureEvent({
                  distinctId: revokedUser.id,
                  event: "seat_addons_cascade_canceled",
                  properties: { provider: "polar", count: seatAddons.length },
                });
                logger.info(`Cascade-canceled ${seatAddons.length} seat addon(s) after main subscription revoke`, {
                  userId: revokedUser.id,
                });
              }
            }
          } catch (err) {
            logger.error("Cascade seat-addon cancel failed (main revoke still committed)", {
              userId: revokedUser.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        break;
      }

      case "order.refunded": {
        // Handle refund - similar to subscription.revoked
        const customerId = eventData.customerId as string;
        const subscriptionId = eventData.subscriptionId as string | undefined;

        // Capture tier BEFORE the downgrade so the refund email shows
        // what plan they had refunded (not the now-free state).
        const userBeforeRefund = await db.query.users.findFirst({
          where: eq(users.polarCustomerId, customerId),
          columns: { id: true, email: true, name: true, subscriptionStatus: true, polarSubscriptionId: true },
        });

        // FIX #9 (seat-addon refund clobbers main tier): order.refunded for a
        // seat addon arrives with a subscriptionId that does NOT match the
        // user's main polarSubscriptionId. Only reset the user's tier when the
        // refund is for the MAIN subscription. Otherwise (seat addon, day pass,
        // or other side-purchase refund) leave the main tier alone.
        const isMainSubscriptionRefund =
          !!subscriptionId &&
          !!userBeforeRefund?.polarSubscriptionId &&
          subscriptionId === userBeforeRefund.polarSubscriptionId;

        if (isMainSubscriptionRefund) {
          await db
            .update(users)
            .set({
              polarSubscriptionId: null,
              subscriptionStatus: "free",
              updatedAt: new Date(),
            })
            .where(eq(users.polarCustomerId, customerId));
        } else if (subscriptionId) {
          // Side-purchase refund (seat addon, day pass, etc.) — log and skip
          // the main-tier reset. The seat-limit decrement (if applicable) is
          // handled by the subsequent subscription.revoked event.
          logger.info("order.refunded for non-main subscription — main tier preserved", {
            customerId,
            refundedSubId: subscriptionId,
            currentMainSubId: userBeforeRefund?.polarSubscriptionId,
          });
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

          // K7: Refund confirmation email - non-blocking
          // Only fire the "your tier was refunded" email when we actually
          // refunded the main subscription (FIX #9). For side-purchase refunds
          // (seat addons, day passes) we skip — the user still has their tier
          // and the misleading email would confuse them.
          if (isMainSubscriptionRefund) {
            const refundedPlan = userBeforeRefund?.subscriptionStatus ?? "Subscription";
            const refundedPlanCap = refundedPlan.charAt(0).toUpperCase() + refundedPlan.slice(1);
            if (user.email) {
              sendRefundEmail({
                email: user.email,
                name: user.name || undefined,
                plan: refundedPlanCap,
              }).catch((err) =>
                logger.error("Refund email failed", { userId: user.id, error: err instanceof Error ? err.message : String(err) }),
              );
            }
          }
        }
        break;
      }

      default:
        logger.info(`Unhandled Polar event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Polar webhook handler error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
