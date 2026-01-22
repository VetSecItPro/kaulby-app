import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";

export default async function AnalyticsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user's subscription status for feature gating
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true },
  });

  const subscriptionStatus = user?.subscriptionStatus || "free";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Track mention trends, sentiment patterns, and platform performance over time.
        </p>
      </div>

      <AnalyticsCharts subscriptionStatus={subscriptionStatus} />
    </div>
  );
}
