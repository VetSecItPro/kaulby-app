import { Suspense } from "react";
import { redirect } from "next/navigation";
import { InsightsView } from "@/components/dashboard/insights-view";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

async function InsightsContent() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground">
          Discover pain points, get actionable recommendations, and track trending topics across your monitors.
        </p>
      </div>

      <InsightsView />
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse p-6">Loading...</div>}>
      <InsightsContent />
    </Suspense>
  );
}
