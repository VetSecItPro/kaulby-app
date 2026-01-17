import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { InsightsView } from "@/components/dashboard/insights-view";

export default async function InsightsPage() {
  const { userId } = await auth();

  if (!userId) {
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
