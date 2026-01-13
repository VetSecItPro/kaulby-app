import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, desc, inArray, count } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import Link from "next/link";

interface ResultsPageProps {
  searchParams: { page?: string };
}

const RESULTS_PER_PAGE = 20;

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const page = parseInt(searchParams.page || "1", 10);
  const offset = (page - 1) * RESULTS_PER_PAGE;

  // Get user's monitors
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
  });

  const monitorIds = userMonitors.map((m) => m.id);

  // Get results for user's monitors with pagination
  const userResults = monitorIds.length > 0
    ? await db.query.results.findMany({
        where: inArray(results.monitorId, monitorIds),
        orderBy: [desc(results.createdAt)],
        limit: RESULTS_PER_PAGE,
        offset,
        with: {
          monitor: true,
        },
      })
    : [];

  // Get total count for pagination
  const totalCountResult = monitorIds.length > 0
    ? await db
        .select({ count: count() })
        .from(results)
        .where(inArray(results.monitorId, monitorIds))
    : [{ count: 0 }];

  const totalCount = totalCountResult[0]?.count || 0;
  const totalPages = Math.ceil(totalCount / RESULTS_PER_PAGE);

  const sentimentIcons = {
    positive: <ThumbsUp className="h-4 w-4 text-green-500" />,
    negative: <ThumbsDown className="h-4 w-4 text-red-500" />,
    neutral: <Minus className="h-4 w-4 text-gray-500" />,
  };

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
      {userResults.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No results yet</CardTitle>
            <CardDescription>
              {userMonitors.length === 0
                ? "Create a monitor to start tracking mentions."
                : "Your monitors have not found any results yet. Check back soon!"}
            </CardDescription>
          </CardHeader>
          {userMonitors.length === 0 && (
            <CardContent>
              <Link href="/dashboard/monitors/new">
                <Button>Create Monitor</Button>
              </Link>
            </CardContent>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {userResults.map((result) => (
              <Card key={result.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="capitalize"
                        >
                          {result.platform}
                        </Badge>
                        {result.sentiment && sentimentIcons[result.sentiment]}
                        {result.painPointCategory && (
                          <Badge variant="secondary" className="text-xs">
                            {result.painPointCategory.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base line-clamp-2">
                        {result.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        From monitor: {result.monitor?.name || "Unknown"}
                        {result.author && ` • by ${result.author}`}
                        {result.postedAt && ` • ${new Date(result.postedAt).toLocaleDateString()}`}
                      </CardDescription>
                    </div>
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-1">
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                    </a>
                  </div>
                </CardHeader>
                {(result.content || result.aiSummary) && (
                  <CardContent className="pt-0">
                    {result.aiSummary ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">AI Summary:</p>
                        <p className="text-sm">{result.aiSummary}</p>
                      </div>
                    ) : result.content ? (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {result.content}
                      </p>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

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
