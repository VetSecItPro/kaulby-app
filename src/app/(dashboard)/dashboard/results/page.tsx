import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import Link from "next/link";

export default async function ResultsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user's monitors
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
  });

  const monitorIds = userMonitors.map((m) => m.id);

  // Get results for user's monitors
  const userResults = monitorIds.length > 0
    ? await db.query.results.findMany({
        where: inArray(results.monitorId, monitorIds),
        orderBy: [desc(results.createdAt)],
        limit: 50,
        with: {
          monitor: true,
        },
      })
    : [];

  const sentimentIcons = {
    positive: <ThumbsUp className="h-4 w-4 text-green-500" />,
    negative: <ThumbsDown className="h-4 w-4 text-red-500" />,
    neutral: <Minus className="h-4 w-4 text-gray-500" />,
  };


  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Results</h1>
        <p className="text-muted-foreground">
          Mentions and discussions found by your monitors.
        </p>
      </div>

      {/* Results List */}
      {userResults.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No results yet</CardTitle>
            <CardDescription>
              {userMonitors.length === 0
                ? "Create a monitor to start tracking mentions."
                : "Your monitors haven't found any results yet. Check back soon!"}
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
      )}
    </div>
  );
}
