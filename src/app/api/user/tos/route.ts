import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    await db
      .update(users)
      .set({ tosAcceptedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ accepted: true });
  } catch (error) {
    logger.error("Error accepting ToS:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to accept terms" }, { status: 500 });
  }
}
