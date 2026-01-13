import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors, results, users } from "@/lib/db/schema";
import { eq, count, and, gte, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radio, MessageSquare, TrendingUp, PlusCircle, ArrowRight, Eye } from "lucide-react";
import Link from "next/link";
import { QuickStartGuide } from "@/components/dashboard/onboarding";
import { SampleResultsPreview } from "@/components/dashboard/sample-results";
import { getPlanLimits } from "@/lib/stripe";
import { getUserPlan } from "@/lib/limits";

export default async function DashboardPage() {
  const isDev = process.env.NODE_ENV === "development";

  let userId: string | null = null;

  if (!isDev) {
    const authResult = await auth();
    userId = authResult.userId;

    if (!userId) {
      redirect("/sign-in");
    }
  }

  // Get user data (or use mock data in dev)
  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
    : null;

  // If user doesn't exist in our DB yet, they need to complete signup via webhook
  // For now, show empty state
  const monitorsCount = user && userId
    ? await db.select({ count: count() }).from(monitors).where(eq(monitors.userId, userId))
    : [{ count: 0 }];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get user's monitor IDs
  const userMonitorIds = user && userId
    ? await db.select({ id: monitors.id }).from(monitors).where(eq(monitors.userId, userId))
    : [];

  // Get results count for user's monitors
  let resultsCount = 0;
  if (userMonitorIds.length > 0) {
    const monitorIdList = userMonitorIds.map(m => m.id);
    const resultsData = await db
      .select({ count: count() })
      .from(results)
      .where(
        and(
          gte(results.createdAt, thirtyDaysAgo),
          inArray(results.monitorId, monitorIdList)
        )
      );
    resultsCount = resultsData[0]?.count || 0;
  }

  const userPlan = userId ? await getUserPlan(userId) : "free";
  const limits = getPlanLimits(userPlan);

  const hasMonitors = (monitorsCount[0]?.count || 0) > 0;
  const hasResults = resultsCount > 0;
  const showGettingStarted = !hasMonitors || !hasResults;

  // Get recent results for quick preview
  let recentResults: { title: string; platform: string; createdAt: Date }[] = [];
  if (hasResults && userMonitorIds.length > 0) {
    const monitorIdList = userMonitorIds.map(m => m.id);
    recentResults = await db.query.results.findMany({
      where: inArray(results.monitorId, monitorIdList),
      orderBy: (results, { desc }) => [desc(results.createdAt)],
      limit: 3,
      columns: {
        title: true,
        platform: true,
        createdAt: true,
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Monitor conversations about your brand across the web.
          </p>
        </div>
        <Link href="/dashboard/monitors/new">
          <Button className="gap-2 w-full sm:w-auto">
            <PlusCircle className="h-4 w-4" />
            New Monitor
          </Button>
        </Link>
      </div>

      {/* Getting Started Guide - shown prominently for new users */}
      {showGettingStarted && (
        <QuickStartGuide hasMonitors={hasMonitors} hasResults={hasResults} />
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Monitors</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitorsCount[0]?.count || 0}</div>
            <p className="text-xs text-muted-foreground">
              {limits.monitors === -1
                ? "Unlimited"
                : `of ${limits.monitors} available`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Results This Month</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resultsCount}</div>
            <p className="text-xs text-muted-foreground">
              {limits.resultsVisible === -1
                ? "Unlimited visible"
                : `${limits.resultsVisible} visible (free tier)`}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{userPlan}</div>
            <p className="text-xs text-muted-foreground">
              {userPlan === "free" ? (
                <Link href="/dashboard/settings" className="text-primary hover:underline">
                  Upgrade for more
                </Link>
              ) : (
                "Active subscription"
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section - shown only when user has data */}
      {hasResults && recentResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Mentions</CardTitle>
                <CardDescription>Latest results from your monitors</CardDescription>
              </div>
              <Link href="/dashboard/results">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentResults.map((result, idx) => (
                <div key={idx} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{result.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{result.platform}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(result.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state when user has monitors but no results yet */}
      {hasMonitors && !hasResults && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Eye className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">Scanning for mentions...</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your monitors are active! Results will appear here as we find matching posts across platforms.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sample results preview for brand new users */}
      {!hasMonitors && (
        <SampleResultsPreview />
      )}
    </div>
  );
}
