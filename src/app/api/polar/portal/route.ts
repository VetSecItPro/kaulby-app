import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPolarClient } from "@/lib/polar";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/polar/portal
 * Create a Polar customer portal session URL for managing subscriptions
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

    // Get user's Polar customer ID
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { polarCustomerId: true },
    });

    if (!user?.polarCustomerId) {
      return NextResponse.json(
        { error: "No Polar customer found. Please subscribe first." },
        { status: 400 }
      );
    }

    // Create Polar customer session
    const session = await polar.customerSessions.create({
      customerId: user.polarCustomerId,
    });

    return NextResponse.json({
      url: session.customerPortalUrl,
    });
  } catch (error) {
    console.error("Polar portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
