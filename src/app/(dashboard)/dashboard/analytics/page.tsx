import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
// PERF-BUNDLE-001: Lazy-load recharts via client wrapper with ssr: false
import { LazyAnalyticsCharts } from "@/components/dashboard/analytics-charts-lazy";

function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="animate-pulse h-80 bg-muted rounded-lg" />
    </div>
  );
}

async function AnalyticsContent() {
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

      <LazyAnalyticsCharts subscriptionStatus={subscriptionStatus} />
    </div>
  );
}

export default async function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsPageSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
