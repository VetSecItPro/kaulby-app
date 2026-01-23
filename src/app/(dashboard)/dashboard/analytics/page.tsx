import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export default async function AnalyticsPage() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Get user's subscription status for feature gating
  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { subscriptionStatus: true },
      })
    : null;

  // In dev mode without a user, default to enterprise for full feature testing
  const subscriptionStatus = user?.subscriptionStatus || (isLocalDev() ? "enterprise" : "free");

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
