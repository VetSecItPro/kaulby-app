import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true },
    });

    return NextResponse.json({
      plan: user?.subscriptionStatus || "free",
    });
  } catch (error) {
    logger.error("Error fetching subscription:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}
