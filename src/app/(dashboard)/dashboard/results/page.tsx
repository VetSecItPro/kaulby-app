import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, desc, inArray, count, and } from "drizzle-orm";
import { ResponsiveResults } from "@/components/dashboard/responsive-results";
import { getUserPlan, getRefreshDelay } from "@/lib/limits";
import { getPlanLimits } from "@/lib/stripe";

interface ResultsPageProps {
  searchParams: Promise<{ page?: string }>;
}

const RESULTS_PER_PAGE = 50;

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const isDev = process.env.NODE_ENV === "development";

  let userId: string | null = null;

  if (!isDev) {
    const authResult = await auth();
    userId = authResult.userId;

    if (!userId) {
      redirect("/sign-in");
    }
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * RESULTS_PER_PAGE;

  // Get user's plan and limits
  const userPlan = userId ? await getUserPlan(userId) : "free";
  const planLimits = getPlanLimits(userPlan);
  const refreshInfo = userId ? await getRefreshDelay(userId) : null;

  // Get user's monitors (empty in dev mode without auth)
  const userMonitors = userId
    ? await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
      })
    : [];

  const monitorIds = userMonitors.map((m) => m.id);

  // Get results for user's monitors with pagination
  const userResults = monitorIds.length > 0
    ? await db.query.results.findMany({
        where: inArray(results.monitorId, monitorIds),
        orderBy: [desc(results.createdAt)],
        limit: RESULTS_PER_PAGE,
        offset,
        with: {
          monitor: {
            columns: { name: true },
          },
        },
      })
    : [];

  // Get total count for pagination
  const totalCountResult = monitorIds.length > 0
    ? await db
        .select({ count: count() })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            eq(results.isHidden, false)
          )
        )
    : [{ count: 0 }];

  const totalCount = totalCountResult[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / RESULTS_PER_PAGE);

  // Calculate visibility limits for free tier
  const visibleLimit = planLimits.resultsVisible;
  const isLimited = visibleLimit !== -1;
  const hiddenCount = isLimited ? Math.max(0, totalCount - visibleLimit) : 0;

  return (
    <ResponsiveResults
      results={userResults}
      totalCount={totalCount}
      page={page}
      totalPages={totalPages}
      hasMonitors={userMonitors.length > 0}
      planInfo={{
        plan: userPlan,
        visibleLimit,
        isLimited,
        hiddenCount,
        hasUnlimitedAi: planLimits.aiFeatures.unlimitedAiAnalysis,
        refreshDelayHours: planLimits.refreshDelayHours,
        nextRefreshAt: refreshInfo?.nextRefreshAt || null,
      }}
    />
  );
}
