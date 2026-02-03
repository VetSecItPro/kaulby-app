// PERF: Dynamic import creation wizard — FIX-202
import { redirect } from "next/navigation";
import { ResponsiveMonitors } from "@/components/dashboard/responsive-monitors";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import { getUserPlan, getRefreshDelay } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { getCachedMonitors } from "@/lib/server-cache";

export default async function MonitorsPage() {
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
