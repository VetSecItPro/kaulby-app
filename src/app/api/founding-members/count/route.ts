/**
 * GET /api/founding-members/count
 *
 * Public endpoint returning how many Founding Member slots have been
 * claimed vs. the 1000-slot cap. Used by the pricing + sign-up pages to
 * render a live "X/1000 spots remaining" banner that disappears at 1000.
 *
 * No auth - the count is marketing copy, not sensitive.
 *
 * Cached at the edge for 60 seconds: the count only changes on a paid
 * signup (low QPS) and slight staleness on the banner is fine. Prevents
 * DB hammering from anonymous pricing-page traffic.
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const FOUNDING_MEMBER_LIMIT = 1000;

export async function GET() {
  try {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(sql`${users.isFoundingMember} = true`);

    const claimed = row?.count ?? 0;
    const remaining = Math.max(0, FOUNDING_MEMBER_LIMIT - claimed);
    const exhausted = claimed >= FOUNDING_MEMBER_LIMIT;

    return NextResponse.json(
      {
        claimed,
        remaining,
        total: FOUNDING_MEMBER_LIMIT,
        exhausted,
      },
      {
        headers: {
          // Edge + browser cache for 60s. Revalidate within 60s of any new claim.
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    logger.error("Error fetching founding-members count:", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail open - return a "plausible" default so the banner doesn't
    // block page render on a DB hiccup. Shows the banner as still-available.
    return NextResponse.json(
      { claimed: 0, remaining: FOUNDING_MEMBER_LIMIT, total: FOUNDING_MEMBER_LIMIT, exhausted: false },
      { status: 200 }
    );
  }
}
