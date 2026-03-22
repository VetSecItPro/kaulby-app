import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Dashboard | Kaulby" };
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Eye, Sparkles } from "lucide-react";
import Link from "next/link";
import { QuickStartGuide } from "@/components/dashboard/onboarding";
import { SampleResultsPreview } from "@/components/dashboard/sample-results";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { getUserPlan } from "@/lib/limits";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import {
  getCachedMonitorIds,
  getCachedResultsCount,
  getCachedMonitors,
} from "@/lib/server-cache";

export default async function DashboardPage() {
  const userId = await getEffectiveUserId();
  const isDev = isLocalDev();

  if (!userId && !isDev) {
    redirect("/sign-in");
  }

  // Run cached queries in parallel for better performance
  // In dev mode, default to team for full feature testing
  const [userPlan, userMonitors] = userId
    ? await Promise.all([
        getUserPlan(userId),
        getCachedMonitorIds(userId),
      ])
    : [isDev ? "team" as const : "free" as const, []];

  const hasMonitors = userMonitors.length > 0;

  // Check if user has any results (cached)
  const monitorIdList = userMonitors.map(m => m.id);
  const resultsCount = hasMonitors && userId
    ? await getCachedResultsCount(userId, monitorIdList, 30)
    : 0;
  const hasResults = resultsCount > 0;

  const showGettingStarted = !hasMonitors || !hasResults;

  // Get first monitor details for the empty state message
  const PLATFORM_LABELS: Record<string, string> = {
    reddit: "Reddit", hackernews: "Hacker News", producthunt: "Product Hunt",
    googlereviews: "Google Reviews", trustpilot: "Trustpilot", appstore: "App Store",
    playstore: "Play Store", quora: "Quora", youtube: "YouTube", g2: "G2",
    yelp: "Yelp", amazonreviews: "Amazon Reviews", indiehackers: "Indie Hackers",
    github: "GitHub", devto: "Dev.to", hashnode: "Hashnode", x: "X",
  };
  let firstMonitorName = "";
  let firstMonitorPlatforms = "";
  if (hasMonitors && !hasResults && userId) {
    const allMonitors = await getCachedMonitors(userId);
    if (allMonitors.length > 0) {
      firstMonitorName = allMonitors[0].name;
      const platformNames = allMonitors[0].platforms
        .map(p => PLATFORM_LABELS[p] || p)
        .slice(0, 3);
      const remaining = allMonitors[0].platforms.length - platformNames.length;
      firstMonitorPlatforms = remaining > 0
        ? `${platformNames.join(", ")} +${remaining} more`
        : platformNames.join(", ");
    }
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

      {/* Upgrade Banner - shown for free users who have monitors */}
      {hasMonitors && (
        <UpgradeBanner plan={userPlan} variant="full" context="dashboard" />
      )}

      {/* Getting Started Guide - shown prominently for new users */}
      {showGettingStarted && (
        <QuickStartGuide hasMonitors={hasMonitors} hasResults={hasResults} />
      )}

      {/* Dashboard Actionable Cards */}
      {hasMonitors && (
        <DashboardInsights />
      )}

      {/* Empty state when user has monitors but no results yet */}
      {hasMonitors && !hasResults && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Eye className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">
              {firstMonitorName
                ? `Your monitor "${firstMonitorName}" is scanning ${firstMonitorPlatforms}`
                : "Scanning for mentions..."}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              First results typically appear within 2 hours. We&apos;ll analyze sentiment, detect pain points, and score buying intent automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No monitors empty state */}
      {!hasMonitors && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-primary/10 p-3 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Discover what people are saying about you</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Create your first monitor to start discovering pain points, competitor gaps, and buying signals. It takes 30 seconds.
            </p>
            <Link href="/dashboard/monitors/new">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Create Your First Monitor
              </Button>
            </Link>
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
