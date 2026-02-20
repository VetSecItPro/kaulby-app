// PERF: Dynamic import creation wizard — FIX-202
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ResponsiveMonitors } from "@/components/dashboard/responsive-monitors";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import { getUserPlan, getRefreshDelay } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { getCachedMonitors } from "@/lib/server-cache";

function MonitorsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="animate-pulse h-8 w-48 bg-muted rounded" />
        <div className="animate-pulse h-10 w-40 bg-muted rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse h-48 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}

async function MonitorsContent() {
  const effectiveUserId = await getEffectiveUserId();

  if (!effectiveUserId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Fetch monitors (cached) and refresh info in parallel
  const [userMonitors, userPlan, refreshInfo] = effectiveUserId
    ? await Promise.all([
        getCachedMonitors(effectiveUserId),
        getUserPlan(effectiveUserId),
        getRefreshDelay(effectiveUserId),
      ])
    : [[], "enterprise" as const, null];

  const planLimits = getPlanLimits(userPlan);

  return (
    <ResponsiveMonitors
      monitors={userMonitors}
      refreshInfo={{
        plan: userPlan,
        refreshDelayHours: planLimits.refreshDelayHours,
        nextRefreshAt: refreshInfo?.nextRefreshAt || null,
      }}
    />
  );
}

export default async function MonitorsPage() {
  return (
    <Suspense fallback={<MonitorsPageSkeleton />}>
      <MonitorsContent />
    </Suspense>
  );
}
