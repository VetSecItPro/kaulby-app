import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getPolarClient, getTeamSeatProductId, isTeamSeatProduct } from "@/lib/polar";
import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
export const dynamic = "force-dynamic";

/**
 * POST /api/polar/seat-addon
 * Create a Polar checkout session for purchasing an extra team seat ($20/mo or $200/yr)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const polar = await getPolarClient();
    if (!polar) {
      return NextResponse.json(
        { error: "Polar not configured" },
        { status: 503 }
      );
    }

    // Verify user is on Team plan
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true },
    });

    if (!dbUser || dbUser.subscriptionStatus !== "growth") {
      return NextResponse.json(
        { error: "Extra seats are only available on the Growth plan" },
        { status: 400 }
      );
    }

    // Verify user owns a workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.ownerId, userId),
      columns: { id: true, seatLimit: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "No workspace found. Create a workspace first." },
        { status: 400 }
      );
    }

    const { billingInterval = "monthly" } = await parseJsonBody(request);

    if (billingInterval !== "monthly" && billingInterval !== "annual") {
      return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    }

    const productId = getTeamSeatProductId(billingInterval);

    if (!productId) {
      return NextResponse.json(
        { error: "Seat add-on product not configured" },
        { status: 503 }
      );
    }

    const customerEmail = user.emailAddresses[0]?.emailAddress;

    if (!customerEmail) {
      return NextResponse.json({ error: "No email address found" }, { status: 400 });
    }

    // Idempotency: prevent double-click double-charge. Same workspace + same
    // minute = same idempotency key, so two parallel checkout creates collapse
    // into one. After 60s a fresh key allows a legitimate new purchase.
    const idempotencyKey = `seat-addon:${workspace.id}:${Math.floor(Date.now() / 60000)}`;

    const checkout = await polar.checkouts.create(
      {
        products: [productId],
        customerEmail,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?seat_added=true`,
        metadata: {
          userId,
          workspaceId: workspace.id,
          type: "team_seat",
        },
      },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    const errDetail = (error as { statusCode?: number; detail?: unknown })?.statusCode;
    logger.error("Polar seat addon checkout error:", { message: errMsg, statusCode: errDetail, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: errMsg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/polar/seat-addon
 *
 * Cancel the user's most-recent seat-addon subscription. Polar will keep the
 * subscription active until the end of the current billing period and then
 * emit `subscription.revoked` — the webhook handler decrements seatLimit at
 * that point (Approach B: honor what they paid for).
 *
 * Member-count guard: blocks cancellation if removing one seat would put
 * seatCount above the new seatLimit. The user must remove a workspace member
 * first. (Polar can't enforce this; we have to.)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const polar = await getPolarClient();
    if (!polar) {
      return NextResponse.json({ error: "Polar not configured" }, { status: 503 });
    }

    // Find the user's workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.ownerId, userId),
      columns: { id: true, seatLimit: true, seatCount: true },
    });
    if (!workspace) {
      return NextResponse.json({ error: "No workspace found" }, { status: 400 });
    }

    // Member-count guard: post-cancel seatLimit would be (current - 1). If
    // seatCount exceeds that, the user must remove a member first.
    if (workspace.seatLimit <= 3) {
      return NextResponse.json(
        { error: "Cannot remove a seat below the 3 included with Growth tier. Downgrade your plan instead." },
        { status: 400 },
      );
    }
    if (workspace.seatCount > workspace.seatLimit - 1) {
      return NextResponse.json(
        {
          error: `You have ${workspace.seatCount} workspace members but only ${workspace.seatLimit - 1} seats would remain after removal. Remove a member first.`,
        },
        { status: 400 },
      );
    }

    // Find the user's Polar customer + most-recent seat-addon subscription
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { polarCustomerId: true },
    });
    if (!dbUser?.polarCustomerId) {
      return NextResponse.json({ error: "No Polar customer found" }, { status: 400 });
    }

    // Polar SDK: list customer subscriptions filtered to active state. The list
    // returns a paged async iterator; we materialize the first page since
    // a customer with >100 seat-addons is unrealistic (and would warrant a
    // different cleanup tool).
    type SubLite = { id: string; productId: string; createdAt: string | Date };
    const result = await polar.subscriptions.list({
      customerId: [dbUser.polarCustomerId],
      active: true,
      limit: 100,
    });
    const subs: SubLite[] = (result?.result?.items as SubLite[] | undefined) ?? [];

    const seatAddons = subs
      .filter((s) => isTeamSeatProduct(s.productId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (seatAddons.length === 0) {
      return NextResponse.json(
        { error: "No active seat-addon subscriptions to cancel" },
        { status: 400 },
      );
    }

    const target = seatAddons[0];

    // Polar's subscription cancel: schedules revocation at period end. The
    // user keeps the seat through the rest of the billing cycle (Approach B),
    // and `subscription.revoked` fires on the webhook when the period ends.
    // KAULBY_PRORATION_BEHAVIOR enforces our no-proration / no-refund policy
    // even if the Polar org dashboard default is set differently.
    const { KAULBY_PRORATION_BEHAVIOR: prorationBehavior } = await import("@/lib/polar");
    await polar.subscriptions.update({
      id: target.id,
      subscriptionUpdate: { cancelAtPeriodEnd: true, prorationBehavior },
    });

    logger.info(`Seat-addon cancellation scheduled`, {
      userId,
      workspaceId: workspace.id,
      subscriptionId: target.id,
    });

    return NextResponse.json({
      success: true,
      message: "Seat will be removed at the end of the current billing period.",
      subscriptionId: target.id,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Polar seat addon cancel error:", { message: errMsg });
    return NextResponse.json(
      { error: "Failed to cancel seat addon", detail: errMsg },
      { status: 500 },
    );
  }
}
