import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { NewMonitorForm } from "./new-monitor-form";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export const metadata: Metadata = { title: "Create Monitor | Kaulby" };

export default async function NewMonitorPage() {
  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    // In dev mode with no user, use team defaults
    const limits = getPlanLimits("team");
    return <NewMonitorForm limits={limits} userPlan="team" />;
  }

  // Fetch user's plan and limits
  const userPlan = await getUserPlan(userId);
  const limits = getPlanLimits(userPlan);

  return <NewMonitorForm limits={limits} userPlan={userPlan} />;
}
