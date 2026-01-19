import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { EditMonitorForm } from "./edit-monitor-form";

interface EditMonitorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMonitorPage({ params }: EditMonitorPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
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
