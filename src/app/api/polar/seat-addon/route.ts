import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getPolarClient, getTeamSeatProductId } from "@/lib/polar";
import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
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

    if (!dbUser || dbUser.subscriptionStatus !== "team") {
      return NextResponse.json(
        { error: "Extra seats are only available on the Team plan" },
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

    const checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?seat_added=true`,
      metadata: {
        userId,
        workspaceId: workspace.id,
        type: "team_seat",
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    const errDetail = (error as { statusCode?: number; detail?: unknown })?.statusCode;
    console.error("Polar seat addon checkout error:", { message: errMsg, statusCode: errDetail, error });
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: errMsg },
      { status: 500 }
    );
  }
}
