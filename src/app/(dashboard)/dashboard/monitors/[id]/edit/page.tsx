import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { EditMonitorForm } from "./edit-monitor-form";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export const metadata: Metadata = { title: "Edit Monitor | Kaulby" };

interface EditMonitorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMonitorPage({ params }: EditMonitorPageProps) {
  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    // In dev mode with no user, use team defaults
    const resolvedParams = await params;
    const limits = getPlanLimits("team");
    return (
      <EditMonitorForm
        monitorId={resolvedParams.id}
        limits={limits}
        userPlan="team"
      />
    );
  }

  const resolvedParams = await params;

  // Fetch user's plan and limits
  const userPlan = await getUserPlan(userId);
  const limits = getPlanLimits(userPlan);

  return (
    <EditMonitorForm
      monitorId={resolvedParams.id}
      limits={limits}
      userPlan={userPlan}
    />
  );
}
