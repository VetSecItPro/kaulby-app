// PERF: Lazy-load filters to reduce 224kB bundle — FIX-201
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, desc, inArray, count, and } from "drizzle-orm";
import { ResponsiveResults } from "@/components/dashboard/responsive-results";
import { getUserPlan, getRefreshDelay } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

interface ResultsPageProps {
  searchParams: Promise<{ page?: string }>;
}

const RESULTS_PER_PAGE = 50;

function ResultsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="animate-pulse h-8 w-48 bg-muted rounded" />
        <div className="animate-pulse h-10 w-32 bg-muted rounded" />
      </div>
      <div className="animate-pulse h-12 bg-muted rounded-lg" />
      <div className="grid gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse h-32 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}

async function ResultsContent({ searchParams }: ResultsPageProps) {
  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    // In dev mode with no users in DB, show empty state
    return (
      <ResponsiveResults
        results={[]}
        totalCount={0}
        page={1}
        totalPages={0}
        hasMonitors={false}
        planInfo={{
          plan: "enterprise",
          visibleLimit: -1,
          isLimited: false,
          hiddenCount: 0,
          hasUnlimitedAi: true,
          refreshDelayHours: 0,
          nextRefreshAt: null,
        }}
      />
    );
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * RESULTS_PER_PAGE;

  // Run initial queries in parallel for better performance
  const [userPlan, refreshInfo, userMonitors] = await Promise.all([
    getUserPlan(userId),
    getRefreshDelay(userId),
    db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
    }),
  ]);

  const planLimits = getPlanLimits(userPlan);
  const monitorIds = userMonitors.map((m) => m.id);

  // Run results and count queries in parallel
  const [userResults, totalCountResult] = monitorIds.length > 0
    ? await Promise.all([
        db.query.results.findMany({
          where: inArray(results.monitorId, monitorIds),
          orderBy: [desc(results.createdAt)],
          limit: RESULTS_PER_PAGE,
          offset,
          with: {
            monitor: {
              columns: { name: true, keywords: true },
            },
          },
        }),
        db
          .select({ count: count() })
          .from(results)
          .where(
            and(
              inArray(results.monitorId, monitorIds),
              eq(results.isHidden, false)
            )
          ),
      ])
    : [[], [{ count: 0 }]];

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

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  return (
    <Suspense fallback={<ResultsPageSkeleton />}>
      <ResultsContent searchParams={searchParams} />
    </Suspense>
  );
}
