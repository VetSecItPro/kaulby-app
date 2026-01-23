import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { NewMonitorForm } from "./new-monitor-form";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export default async function NewMonitorPage() {
  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    // In dev mode with no user, use enterprise defaults
    const limits = getPlanLimits("enterprise");
    return <NewMonitorForm limits={limits} userPlan="enterprise" />;
  }

  // Fetch user's plan and limits
  const userPlan = await getUserPlan(userId);
  const limits = getPlanLimits(userPlan);

  return <NewMonitorForm limits={limits} userPlan={userPlan} />;
}
