import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import Link from "next/link";
import { getPlatformDisplayName } from "@/lib/platform-utils";
import { getUserPlan, getRefreshDelay } from "@/lib/limits";
import { getPlanLimits } from "@/lib/plans";
import { HiddenResultsBanner, RefreshDelayBanner, BlurredAiAnalysis } from "@/components/dashboard/upgrade-prompt";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

interface MonitorPageProps {
  params: { id: string };
  searchParams: { page?: string };
}

const RESULTS_PER_PAGE = 20;

export default async function MonitorDetailPage({ params, searchParams }: MonitorPageProps) {
  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    notFound();
  }

  const monitor = await db.query.monitors.findFirst({
    where: and(eq(monitors.id, params.id), eq(monitors.userId, userId)),
  });

  if (!monitor) {
    notFound();
  }

  const page = parseInt(searchParams.page || "1", 10);
  const offset = (page - 1) * RESULTS_PER_PAGE;

  // Get user's plan and limits in parallel
  const [userPlan, refreshInfo] = await Promise.all([
    getUserPlan(userId),
    getRefreshDelay(userId),
  ]);
  const planLimits = getPlanLimits(userPlan);

  // Get results for this monitor with pagination
  const [monitorResults, totalCountResult] = await Promise.all([
    db.query.results.findMany({
      where: eq(results.monitorId, monitor.id),
      orderBy: [desc(results.createdAt)],
      limit: RESULTS_PER_PAGE,
      offset,
    }),
    db
      .select({ count: count() })
      .from(results)
      .where(and(eq(results.monitorId, monitor.id), eq(results.isHidden, false))),
  ]);

  const totalCount = totalCountResult[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / RESULTS_PER_PAGE);

  // Calculate visibility limits for tier enforcement
  const visibleLimit = planLimits.resultsVisible;
  const isLimited = visibleLimit !== -1;
  const visibleResults = isLimited ? monitorResults.slice(0, visibleLimit) : monitorResults;
  const hiddenCount = isLimited ? Math.max(0, totalCount - visibleLimit) : 0;
  const hasUnlimitedAi = planLimits.aiFeatures.unlimitedAiAnalysis;

  const sentimentIcons = {
    positive: <ThumbsUp className="h-4 w-4 text-green-500" />,
    negative: <ThumbsDown className="h-4 w-4 text-red-500" />,
    neutral: <Minus className="h-4 w-4 text-gray-500" />,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/monitors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{monitor.name}</h1>
              <Badge variant={monitor.isActive ? "default" : "secondary"}>
                {monitor.isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Tracking: {monitor.keywords.join(", ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/monitors/${monitor.id}/edit`}>
            <Button className="bg-teal-500 text-black hover:bg-teal-600">
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {monitor.platforms.map((platform) => (
                <Badge key={platform} className="bg-teal-500/10 text-teal-500 border-teal-500/20">
                  {getPlatformDisplayName(platform)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {monitor.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Delay Banner */}
      {planLimits.refreshDelayHours > 0 && (
        <RefreshDelayBanner
          delayHours={planLimits.refreshDelayHours}
          nextRefreshAt={refreshInfo?.nextRefreshAt || null}
          subscriptionStatus={userPlan}
        />
      )}

      {/* Results List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Results</h2>

        {visibleResults.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No results yet</CardTitle>
              <CardDescription>
                This monitor is active and scanning. Results will appear here when mentions are found.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4">
              {visibleResults.map((result, index) => {
                // For free tier, only show full AI analysis on first result
                const showAiAnalysis = hasUnlimitedAi || index === 0;

                return (
                  <Card key={result.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-teal-500/10 text-teal-500 border-teal-500/20">
                              {getPlatformDisplayName(result.platform)}
                            </Badge>
                            {showAiAnalysis && result.sentiment && sentimentIcons[result.sentiment]}
                            {showAiAnalysis && result.painPointCategory && (
                              <Badge variant="secondary" className="text-xs">
                                {result.painPointCategory.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base line-clamp-2">
                            {result.title}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {result.author && `by ${result.author} • `}
                            {result.postedAt && new Date(result.postedAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <a
                          href={result.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" className="gap-1 bg-teal-500 text-black hover:bg-teal-600">
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </a>
                      </div>
                    </CardHeader>
                    {(result.content || result.aiSummary) && (
                      <CardContent className="pt-0">
                        {showAiAnalysis ? (
                          result.aiSummary ? (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground font-medium">AI Summary:</p>
                              <p className="text-sm">{result.aiSummary}</p>
                            </div>
                          ) : result.content ? (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {result.content}
                            </p>
                          ) : null
                        ) : (
                          <BlurredAiAnalysis
                            aiSummary={result.aiSummary || undefined}
                            sentiment={result.sentiment || undefined}
                            painPointCategory={result.painPointCategory || undefined}
                          />
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Hidden Results Banner */}
            {hiddenCount > 0 && (
              <HiddenResultsBanner
                hiddenCount={hiddenCount}
                totalCount={totalCount}
              />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                {page > 1 && (
                  <Link href={`/dashboard/monitors/${monitor.id}?page=${page - 1}`}>
                    <Button variant="outline">Previous</Button>
                  </Link>
                )}
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link href={`/dashboard/monitors/${monitor.id}?page=${page + 1}`}>
                    <Button variant="outline">Next</Button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
