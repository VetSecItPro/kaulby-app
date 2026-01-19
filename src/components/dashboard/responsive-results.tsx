"use client";

import { useState } from "react";
import { MobileResults } from "@/components/mobile/mobile-results";
import { ResultsList } from "./results-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HiddenResultsBanner, RefreshDelayBanner } from "./upgrade-prompt";
import { EmptyState, ScanningState } from "./empty-states";
import { Download, Lock } from "lucide-react";
import Link from "next/link";
import type { PlanKey } from "@/lib/plans";

type ConversationCategory = "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion";

interface Result {
  id: string;
  platform: "reddit" | "hackernews" | "producthunt" | "devto" | "twitter" | "googlereviews" | "trustpilot" | "appstore" | "playstore" | "quora";
  sourceUrl: string;
  title: string;
  content: string | null;
  author: string | null;
  postedAt: Date | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  painPointCategory: string | null;
  conversationCategory: ConversationCategory | null;
  aiSummary: string | null;
  isViewed: boolean;
  isClicked: boolean;
  isSaved: boolean;
  isHidden: boolean;
  monitor: { name: string } | null;
}

interface PlanInfo {
  plan: PlanKey;
  visibleLimit: number;
  isLimited: boolean;
  hiddenCount: number;
  hasUnlimitedAi: boolean;
  refreshDelayHours: number;
  nextRefreshAt: Date | null;
}

interface ResponsiveResultsProps {
  results: Result[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMonitors: boolean;
  planInfo?: PlanInfo;
}

// CSS-based responsive - renders both layouts, CSS handles visibility
// This prevents hydration mismatch from JS device detection
export function ResponsiveResults({
  results,
  totalCount,
  page,
  totalPages,
  hasMonitors,
  planInfo,
}: ResponsiveResultsProps) {
  // Filter results based on visibility limit for free tier
  const visibleResults = planInfo?.isLimited
    ? results.slice(0, planInfo.visibleLimit)
    : results;

  return (
    <>
      {/* Mobile/Tablet view - hidden on lg and above */}
      <div className="lg:hidden">
        <MobileResultsView
          results={results}
          visibleResults={visibleResults}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          hasMonitors={hasMonitors}
          planInfo={planInfo}
        />
      </div>

      {/* Desktop view - hidden below lg */}
      <div className="hidden lg:block">
        <DesktopResultsView
          results={results}
          visibleResults={visibleResults}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          hasMonitors={hasMonitors}
          planInfo={planInfo}
        />
      </div>
    </>
  );
}

interface ViewProps {
  results: Result[];
  visibleResults: Result[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMonitors: boolean;
  planInfo?: PlanInfo;
}

function MobileResultsView({
  results,
  visibleResults,
  totalCount,
  page,
  totalPages,
  hasMonitors,
  planInfo,
}: ViewProps) {
  if (results.length === 0 && !hasMonitors) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="text-muted-foreground text-sm">Mentions found by your monitors</p>
        </div>
        <EmptyState
          type="monitors"
          title="No results yet"
          description="Create a monitor to start tracking mentions across the web."
        />
      </div>
    );
  }

  return (
    <MobileResults
      results={visibleResults}
      totalCount={totalCount}
      page={page}
      totalPages={totalPages}
      planInfo={planInfo}
    />
  );
}

function DesktopResultsView({
  results,
  visibleResults,
  totalCount,
  page,
  totalPages,
  hasMonitors,
  planInfo,
}: ViewProps) {
  const [isExporting, setIsExporting] = useState(false);
  const canExport = planInfo?.plan === "pro" || planInfo?.plan === "enterprise";

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/results/export");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kaulby-results-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            Mentions and discussions found by your monitors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <Badge variant="outline" className="text-sm">
              {totalCount} total results
            </Badge>
          )}
          {totalCount > 0 && (
            canExport ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="gap-2">
                <Lock className="h-4 w-4" />
                Export (Pro)
              </Button>
            )
          )}
        </div>
      </div>

      {/* Refresh Delay Banner */}
      {planInfo && planInfo.refreshDelayHours > 0 && (
        <RefreshDelayBanner
          delayHours={planInfo.refreshDelayHours}
          nextRefreshAt={planInfo.nextRefreshAt}
          subscriptionStatus={planInfo.plan}
        />
      )}

      {/* Results List */}
      {results.length === 0 && !hasMonitors ? (
        <EmptyState
          type="monitors"
          title="No results yet"
          description="Create a monitor to start tracking mentions across the web."
        />
      ) : results.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="p-0">
            <ScanningState />
          </CardContent>
        </Card>
      ) : (
        <>
          <ResultsList
            results={visibleResults}
            hasUnlimitedAi={planInfo?.hasUnlimitedAi ?? true}
          />

          {/* Hidden Results Banner (after visible results, before pagination) */}
          {planInfo && planInfo.hiddenCount > 0 && (
            <HiddenResultsBanner
              hiddenCount={planInfo.hiddenCount}
              totalCount={totalCount}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {page > 1 && (
                <Link href={`/dashboard/results?page=${page - 1}`}>
                  <Button variant="outline">Previous</Button>
                </Link>
              )}
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={`/dashboard/results?page=${page + 1}`}>
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
