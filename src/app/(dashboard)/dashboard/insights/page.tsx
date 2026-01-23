import { redirect } from "next/navigation";
import { InsightsView } from "@/components/dashboard/insights-view";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export default async function InsightsPage() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground">
          Discover cross-platform trends and topic correlations in your monitored conversations.
        </p>
      </div>

      <InsightsView />
    </div>
  );
}
