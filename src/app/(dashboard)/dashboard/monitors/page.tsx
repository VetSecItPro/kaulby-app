import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ResponsiveMonitors } from "@/components/dashboard/responsive-monitors";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import { getUserPlan, getRefreshDelay } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";

export default async function MonitorsPage() {
  const effectiveUserId = await getEffectiveUserId();

  if (!effectiveUserId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Fetch monitors and refresh info in parallel
  const [userMonitors, userPlan, refreshInfo] = effectiveUserId
    ? await Promise.all([
        db.query.monitors.findMany({
          where: eq(monitors.userId, effectiveUserId),
          orderBy: [desc(monitors.createdAt)],
        }),
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
