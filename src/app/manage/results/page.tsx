import { db } from "@/lib/db";
import { results, monitors, users } from "@/lib/db/schema";
import { count, desc, sql, gte, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, MessageSquare, TrendingUp, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlatformDisplayName, getSentimentBarColor } from "@/lib/platform-utils";

export const dynamic = "force-dynamic";

async function getResultStats() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Summary stats
  const [total, last30d, last7d, last24h] = await Promise.all([
    db.select({ count: count() }).from(results),
    db.select({ count: count() }).from(results).where(gte(results.createdAt, thirtyDaysAgo)),
    db.select({ count: count() }).from(results).where(gte(results.createdAt, sevenDaysAgo)),
    db.select({ count: count() }).from(results).where(gte(results.createdAt, twentyFourHoursAgo)),
  ]);

  // By platform
  const byPlatform = await db
    .select({
      platform: results.platform,
      count: count(),
    })
    .from(results)
    .where(gte(results.createdAt, thirtyDaysAgo))
    .groupBy(results.platform)
    .orderBy(desc(count()));

  // By sentiment
  const bySentiment = await db
    .select({
      sentiment: results.sentiment,
      count: count(),
    })
    .from(results)
    .where(gte(results.createdAt, thirtyDaysAgo))
    .groupBy(results.sentiment);

  // By category
  const byCategory = await db
    .select({
      category: results.conversationCategory,
      count: count(),
    })
    .from(results)
    .where(gte(results.createdAt, thirtyDaysAgo))
    .groupBy(results.conversationCategory)
    .orderBy(desc(count()));

  // Daily trend
  const dailyTrend = await db
    .select({
      date: sql<string>`DATE(${results.createdAt})`,
      count: count(),
    })
    .from(results)
    .where(gte(results.createdAt, thirtyDaysAgo))
    .groupBy(sql`DATE(${results.createdAt})`)
    .orderBy(desc(sql`DATE(${results.createdAt})`))
    .limit(14);

  // Recent results with user info
  const recentResults = await db
    .select({
      id: results.id,
      title: results.title,
      platform: results.platform,
      sentiment: results.sentiment,
      conversationCategory: results.conversationCategory,
      createdAt: results.createdAt,
      monitorName: monitors.name,
      userEmail: users.email,
      userName: users.name,
    })
    .from(results)
    .leftJoin(monitors, eq(results.monitorId, monitors.id))
    .leftJoin(users, eq(monitors.userId, users.id))
    .orderBy(desc(results.createdAt))
    .limit(20);

  return {
    summary: {
      total: total[0]?.count || 0,
      last30d: last30d[0]?.count || 0,
      last7d: last7d[0]?.count || 0,
      last24h: last24h[0]?.count || 0,
    },
    byPlatform: byPlatform.map((p) => ({
      platform: p.platform,
      count: p.count,
    })),
    bySentiment: bySentiment.map((s) => ({
      sentiment: s.sentiment,
      count: s.count,
    })),
    byCategory: byCategory.map((c) => ({
      category: c.category,
      count: c.count,
    })),
    dailyTrend: dailyTrend.map((d) => ({
      date: d.date,
      count: d.count,
    })),
    recentResults: recentResults.map((r) => ({
      id: r.id,
      title: r.title,
      platform: r.platform,
      sentiment: r.sentiment,
      category: r.conversationCategory,
      createdAt: r.createdAt,
      monitorName: r.monitorName,
      userEmail: r.userEmail,
      userName: r.userName,
    })),
  };
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSentimentBadge(sentiment: string | null) {
  switch (sentiment) {
    case "positive":
      return <Badge className="bg-green-500/10 text-green-500">Positive</Badge>;
    case "negative":
      return <Badge className="bg-red-500/10 text-red-500">Negative</Badge>;
    case "neutral":
      return <Badge className="bg-gray-500/10 text-gray-500">Neutral</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

function getCategoryBadge(category: string | null) {
  const colors: Record<string, string> = {
    pain_point: "bg-red-500/10 text-red-500",
    solution_request: "bg-green-500/10 text-green-500",
    advice_request: "bg-blue-500/10 text-blue-500",
    money_talk: "bg-amber-500/10 text-amber-500",
    hot_discussion: "bg-purple-500/10 text-purple-500",
  };
  const color = colors[category || ""] || "bg-gray-500/10 text-gray-500";
  return (
    <Badge className={color}>
      {category?.replace("_", " ") || "Unknown"}
    </Badge>
  );
}

export default async function ResultsPage() {
  const data = await getResultStats();

  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Results</h1>
            <p className="text-muted-foreground">Platform-wide result analytics</p>
          </div>
        </div>
        <Badge variant="outline">{data.summary.total.toLocaleString()} Total</Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Results</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.last30d.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {((data.summary.last30d / data.summary.total) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.last7d.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {(data.summary.last7d / 7).toFixed(0)} per day avg
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.summary.last24h}</div>
            <p className="text-xs text-muted-foreground">New results today</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Platform</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.byPlatform.slice(0, 6).map((p) => {
                const percentage = (p.count / data.summary.last30d) * 100;
                return (
                  <div key={p.platform} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{getPlatformDisplayName(p.platform)}</span>
                      <span className="text-muted-foreground">{p.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Sentiment</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.bySentiment.filter((s) => s.sentiment).map((s) => {
                const percentage = (s.count / data.summary.last30d) * 100;
                return (
                  <div key={s.sentiment} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{s.sentiment}</span>
                      <span className="text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${getSentimentBarColor(s.sentiment)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Category</CardTitle>
            <CardDescription>Conversation type (30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.byCategory.filter((c) => c.category).slice(0, 5).map((c) => {
                const percentage = (c.count / data.summary.last30d) * 100;
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{c.category?.replace("_", " ")}</span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Results</CardTitle>
          <CardDescription>Latest captured results across all monitors</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentResults.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Monitor</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Found</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <p className="font-medium truncate max-w-[300px]" title={result.title}>
                        {result.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{result.userEmail}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getPlatformDisplayName(result.platform)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{result.monitorName}</TableCell>
                    <TableCell>{getSentimentBadge(result.sentiment)}</TableCell>
                    <TableCell>{getCategoryBadge(result.category)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDate(result.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No results found</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
