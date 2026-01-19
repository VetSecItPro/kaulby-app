import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { NewMonitorForm } from "./new-monitor-form";

export default async function NewMonitorPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch user's plan and limits
  const userPlan = await getUserPlan(userId);
  const limits = getPlanLimits(userPlan);

  return <NewMonitorForm limits={limits} userPlan={userPlan} />;
}
