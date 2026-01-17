import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkDayPassStatus, getDayPassHistory } from "@/lib/day-pass";

/**
 * GET /api/user/day-pass
 * Get the current user's day pass status
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [status, history] = await Promise.all([
      checkDayPassStatus(userId),
      getDayPassHistory(userId),
    ]);

    return NextResponse.json({
      ...status,
      totalPurchases: history.totalPurchases,
      lastPurchasedAt: history.lastPurchasedAt,
    });
  } catch (error) {
    console.error("Failed to get day pass status:", error);
    return NextResponse.json(
      { error: "Failed to get day pass status" },
      { status: 500 }
    );
  }
}
