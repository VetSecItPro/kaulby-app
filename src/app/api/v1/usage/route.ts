import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { monitors, results, usage, users } from "@/lib/db/schema";
import { eq, count, and, gte } from "drizzle-orm";

/**
 * GET /api/v1/usage - Get usage statistics for the authenticated user
 *
 * Returns:
 *   - monitors: count of active monitors
 *   - results: count of results this month
 *   - ai_calls: count of AI analysis calls this month
 *   - plan: current subscription plan
 *   - limits: plan limits
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (userId) => {
    try {
      // Get user info
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          subscriptionStatus: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      // Get monitor count
      const [monitorResult] = await db
        .select({ count: count() })
        .from(monitors)
        .where(and(
          eq(monitors.userId, userId),
          eq(monitors.isActive, true)
        ));

      // Get results count for this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [resultsResult] = await db
        .select({ count: count() })
        .from(results)
        .innerJoin(monitors, eq(results.monitorId, monitors.id))
        .where(and(
          eq(monitors.userId, userId),
          gte(results.createdAt, startOfMonth)
        ));

      // Get usage record for this billing period
      const usageRecord = await db.query.usage.findFirst({
        where: and(
          eq(usage.userId, userId),
          gte(usage.periodStart, user.currentPeriodStart || startOfMonth)
        ),
      });

      // Plan limits
      const planLimits = {
        free: { monitors: 1, keywords: 3, resultsVisible: 3, refreshHours: 24 },
        pro: { monitors: 10, keywords: 20, resultsVisible: -1, refreshHours: 4 },
        enterprise: { monitors: 30, keywords: 35, resultsVisible: -1, refreshHours: 2 },
      };

      const currentPlan = user.subscriptionStatus || "free";
      const limits = planLimits[currentPlan as keyof typeof planLimits];

      return NextResponse.json({
        usage: {
          monitors: {
            count: monitorResult?.count || 0,
            limit: limits.monitors,
          },
          results: {
            countThisMonth: resultsResult?.count || 0,
          },
          aiCalls: {
            countThisMonth: usageRecord?.aiCallsCount || 0,
          },
        },
        plan: {
          name: currentPlan,
          limits,
          periodStart: user.currentPeriodStart,
          periodEnd: user.currentPeriodEnd,
        },
      });
    } catch (error) {
      console.error("API v1 usage error:", error);
      return NextResponse.json(
        { error: "Failed to fetch usage" },
        { status: 500 }
      );
    }
  });
}
