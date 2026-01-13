"use client";

import { useDevice } from "@/hooks/use-device";
import { MobileResults } from "@/components/mobile/mobile-results";
import { ResultsList } from "./results-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Result {
  id: string;
  platform: "reddit" | "hackernews" | "producthunt" | "devto" | "twitter";
  sourceUrl: string;
  title: string;
  content: string | null;
  author: string | null;
  postedAt: Date | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  painPointCategory: string | null;
  aiSummary: string | null;
  isViewed: boolean;
  isClicked: boolean;
  isSaved: boolean;
  isHidden: boolean;
  monitor: { name: string } | null;
}

interface ResponsiveResultsProps {
  results: Result[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMonitors: boolean;
}

export function ResponsiveResults({
  results,
  totalCount,
  page,
  totalPages,
  hasMonitors,
}: ResponsiveResultsProps) {
  const { isMobile, isTablet } = useDevice();

  if (isMobile || isTablet) {
    if (results.length === 0 && !hasMonitors) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Results</h1>
            <p className="text-muted-foreground text-sm">Mentions found by your monitors</p>
          </div>
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <h3 className="font-semibold mb-2">No results yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a monitor to start tracking
              </p>
              <Link href="/dashboard/monitors/new">
                <Button className="w-full">Create Monitor</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <MobileResults
        results={results}
        totalCount={totalCount}
        page={page}
        totalPages={totalPages}
      />
    );
  }

  // Desktop view
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            Mentions and discussions found by your monitors.
          </p>
        </div>
        {totalCount > 0 && (
          <Badge variant="outline" className="text-sm">
            {totalCount} total results
          </Badge>
        )}
      </div>

      {/* Results List */}
      {results.length === 0 && !hasMonitors ? (
        <Card>
          <CardHeader>
            <CardTitle>No results yet</CardTitle>
            <CardDescription>
              Create a monitor to start tracking mentions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/monitors/new">
              <Button>Create Monitor</Button>
            </Link>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No results yet</CardTitle>
            <CardDescription>
              Your monitors have not found any results yet. Check back soon!
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <ResultsList results={results} />

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
