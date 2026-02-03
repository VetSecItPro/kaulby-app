// TODO: FIX-319 (CRITICAL) - Form validation errors should use aria-live regions for screen reader announcement
// All form components across the dashboard should implement:
// - <div role="alert" aria-live="polite" aria-atomic="true">{errorMessage}</div>
// - This applies to monitor creation, settings forms, team invitations, etc.
// - See: https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA19

import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Eye } from "lucide-react";
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
} from "@/lib/server-cache";

export default async function DashboardPage() {
  const userId = await getEffectiveUserId();
  const isDev = isLocalDev();

  if (!userId && !isDev) {
    redirect("/sign-in");
  }

  // Run cached queries in parallel for better performance
  // In dev mode, default to enterprise (Team) for full feature testing
  const [userPlan, userMonitors] = userId
    ? await Promise.all([
        getUserPlan(userId),
        getCachedMonitorIds(userId),
      ])
    : [isDev ? "enterprise" as const : "free" as const, []];

  const hasMonitors = userMonitors.length > 0;

  // Check if user has any results (cached)
  const monitorIdList = userMonitors.map(m => m.id);
  const resultsCount = hasMonitors && userId
    ? await getCachedResultsCount(userId, monitorIdList, 30)
    : 0;
  const hasResults = resultsCount > 0;

  const showGettingStarted = !hasMonitors || !hasResults;

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
        <Link href="/dashboard/monitors/new" data-tour="create-monitor">
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
