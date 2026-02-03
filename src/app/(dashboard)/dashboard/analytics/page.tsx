// PERF: Dynamic import analytics charts to reduce 249kB bundle — FIX-200
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import dynamic from "next/dynamic";
import { db, users } from "@/lib/db";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic import for heavy recharts bundle - only loads when needed
const AnalyticsCharts = dynamic(
  () => import("@/components/dashboard/analytics-charts").then(mod => mod.AnalyticsCharts),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    ),
    ssr: false, // Recharts doesn't work well with SSR
  }
);

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
