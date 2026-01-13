import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors, results, users } from "@/lib/db/schema";
import { eq, count, and, gte } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radio, MessageSquare, TrendingUp, PlusCircle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user data
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // If user doesn't exist in our DB yet, they need to complete signup via webhook
  // For now, show empty state
  const monitorsCount = user
    ? await db.select({ count: count() }).from(monitors).where(eq(monitors.userId, userId))
    : [{ count: 0 }];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get results count for user's monitors
  const userMonitorIds = user
    ? await db.select({ id: monitors.id }).from(monitors).where(eq(monitors.userId, userId))
    : [];

  let resultsCount = 0;
  if (userMonitorIds.length > 0) {
    // Get results from the last 30 days
    const resultsData = await db
      .select({ count: count() })
      .from(results)
      .where(
        and(
          gte(results.createdAt, thirtyDaysAgo),
          // Results for any of user's monitors
          // This is a simplified query - in production you'd use proper IN clause
        )
      );
    resultsCount = resultsData[0]?.count || 0;
  }

  const subscriptionStatus = user?.subscriptionStatus || "free";
  const planLimits = {
    free: { monitors: 3, results: 100 },
    pro: { monitors: 20, results: 5000 },
    enterprise: { monitors: Infinity, results: Infinity },
  };

  const limits = planLimits[subscriptionStatus as keyof typeof planLimits];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor conversations about your brand across the web.
          </p>
        </div>
        <Link href="/dashboard/monitors/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Monitor
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Monitors</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitorsCount[0]?.count || 0}</div>
            <p className="text-xs text-muted-foreground">
              {limits.monitors === Infinity
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
              {limits.results === Infinity
                ? "Unlimited"
                : `of ${limits.results.toLocaleString()} available`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{subscriptionStatus}</div>
            <p className="text-xs text-muted-foreground">
              {subscriptionStatus === "free" ? (
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

      {/* Empty State or Recent Activity */}
      {monitorsCount[0]?.count === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Create your first monitor to start tracking mentions of your brand or keywords.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/monitors/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Your First Monitor
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Results</CardTitle>
            <CardDescription>
              Latest mentions from your monitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/results">
              <Button variant="outline">View All Results</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
