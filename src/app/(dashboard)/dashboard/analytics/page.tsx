import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";

export default async function AnalyticsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Track mention trends, sentiment patterns, and platform performance over time.
        </p>
      </div>

      <AnalyticsCharts />
    </div>
  );
}
