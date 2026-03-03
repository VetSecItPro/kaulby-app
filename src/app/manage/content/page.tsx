import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { count, sql, gte, avg, desc } from "drizzle-orm";
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
import { ArrowLeft, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlatformDisplayName, getPlatformBarColor, getSentimentBarColor } from "@/lib/platform-utils";

export const dynamic = "force-dynamic";

async function getContentData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    leadOverall,
    leadByPlatform,
    categoryDist,
    topLeads,
    platformDist,
    sentimentDist,
  ] = await Promise.all([
    // Overall lead quality stats
    db
      .select({
        avgScore: avg(results.leadScore),
        highQuality: sql<number>`COUNT(*) FILTER (WHERE ${results.leadScore} >= 70)`,
        totalScored: sql<number>`COUNT(*) FILTER (WHERE ${results.leadScore} IS NOT NULL)`,
      })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo)),

    // Lead quality by platform
    db
      .select({
        platform: results.platform,
        avgScore: avg(results.leadScore),
        highQuality: sql<number>`COUNT(*) FILTER (WHERE ${results.leadScore} >= 70)`,
        totalScored: sql<number>`COUNT(*) FILTER (WHERE ${results.leadScore} IS NOT NULL)`,
      })
      .from(results)
      .where(
        sql`${results.createdAt} >= ${thirtyDaysAgo} AND ${results.leadScore} IS NOT NULL`
      )
      .groupBy(results.platform),

    // Category distribution
    db
      .select({
        category: results.conversationCategory,
        count: count(),
        avgLeadScore: avg(results.leadScore),
        avgEngagement: avg(results.engagementScore),
      })
      .from(results)
      .where(
        sql`${results.createdAt} >= ${thirtyDaysAgo} AND ${results.conversationCategory} IS NOT NULL`
      )
      .groupBy(results.conversationCategory),

    // Top 10 leads
    db
      .select({
        id: results.id,
        title: results.title,
        platform: results.platform,
        leadScore: results.leadScore,
        conversationCategory: results.conversationCategory,
        engagementScore: results.engagementScore,
        createdAt: results.createdAt,
        sourceUrl: results.sourceUrl,
      })
      .from(results)
      .where(
        sql`${results.createdAt} >= ${thirtyDaysAgo} AND ${results.leadScore} IS NOT NULL`
      )
      .orderBy(desc(results.leadScore))
      .limit(10),

    // Platform distribution (moved from main dashboard)
    db
      .select({
        platform: results.platform,
        count: count(),
      })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo))
      .groupBy(results.platform),

    // Sentiment distribution (moved from main dashboard)
    db
      .select({
        sentiment: results.sentiment,
        count: count(),
      })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo))
      .groupBy(results.sentiment),
  ]);

  const overall = leadOverall[0] || { avgScore: 0, highQuality: 0, totalScored: 0 };

  return {
    overall: {
      avgScore: Math.round(Number(overall.avgScore) || 0),
      highQuality: Number(overall.highQuality),
      totalScored: Number(overall.totalScored),
    },
    byPlatform: leadByPlatform
      .map((p) => ({
        platform: p.platform,
        avgScore: Math.round(Number(p.avgScore) || 0),
        highQuality: Number(p.highQuality),
        totalScored: Number(p.totalScored),
      }))
      .sort((a, b) => b.avgScore - a.avgScore),
    categories: categoryDist
      .map((c) => ({
        category: c.category || "unknown",
        count: c.count,
        avgLeadScore: Math.round(Number(c.avgLeadScore) || 0),
        avgEngagement: Math.round(Number(c.avgEngagement) || 0),
      }))
      .sort((a, b) => b.count - a.count),
    topLeads: topLeads.map((l) => ({
      id: l.id,
      title: l.title,
      platform: l.platform,
      leadScore: l.leadScore || 0,
      category: l.conversationCategory || "—",
      engagement: l.engagementScore || 0,
      createdAt: l.createdAt,
      sourceUrl: l.sourceUrl,
    })),
    platformDist,
    sentimentDist,
  };
}

const categoryColors: Record<string, string> = {
  pain_point: "bg-red-500",
  solution_request: "bg-blue-500",
  advice_request: "bg-amber-500",
  money_talk: "bg-green-500",
  hot_discussion: "bg-purple-500",
};

const categoryLabels: Record<string, string> = {
  pain_point: "Pain Point",
  solution_request: "Solution Request",
  advice_request: "Advice Request",
  money_talk: "Money Talk",
  hot_discussion: "Hot Discussion",
};

export default async function ContentPage() {
  const data = await getContentData();

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
            <h1 className="text-3xl font-bold tracking-tight">Content Intelligence</h1>
            <p className="text-muted-foreground">Lead quality, categories, and content distribution</p>
          </div>
        </div>
        <Badge variant="outline">Last 30 days</Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall.avgScore}</div>
            <p className="text-xs text-muted-foreground">Out of 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Quality Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.overall.highQuality.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Score 70+</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scored</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall.totalScored.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Results with lead scores</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Quality by Platform */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lead Quality by Platform</CardTitle>
          <CardDescription>Average lead scores and high-quality lead counts per platform</CardDescription>
        </CardHeader>
        <CardContent>
          {data.byPlatform.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right">High-Quality %</TableHead>
                  <TableHead className="text-right">Total Scored</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byPlatform.map((p) => (
                  <TableRow key={p.platform}>
                    <TableCell className="font-medium">{getPlatformDisplayName(p.platform)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${p.avgScore}%` }}
                          />
                        </div>
                        {p.avgScore}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.totalScored > 0 ? ((p.highQuality / p.totalScored) * 100).toFixed(1) : "0.0"}%
                    </TableCell>
                    <TableCell className="text-right">{p.totalScored.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No scored results yet</div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversation Categories</CardTitle>
          <CardDescription>Distribution of conversation types with quality metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {data.categories.length > 0 ? (
            <div className="space-y-4">
              {(() => {
                const totalCat = data.categories.reduce((s, c) => s + c.count, 0);
                return data.categories.map((c) => {
                  const pctVal = totalCat > 0 ? (c.count / totalCat) * 100 : 0;
                  return (
                    <div key={c.category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${categoryColors[c.category] || "bg-muted-foreground"}`} />
                          <span className="font-medium">{categoryLabels[c.category] || c.category}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {c.count.toLocaleString()} ({pctVal.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full ${categoryColors[c.category] || "bg-muted-foreground"}`}
                          style={{ width: `${pctVal}%` }}
                        />
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Avg Lead Score: {c.avgLeadScore}</span>
                        <span>Avg Engagement: {c.avgEngagement}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">No categorized results yet</div>
          )}
        </CardContent>
      </Card>

      {/* Top Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Leads</CardTitle>
          <CardDescription>Highest-scoring results in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topLeads.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topLeads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="max-w-[300px]">
                      <a
                        href={l.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline truncate block"
                      >
                        {l.title}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getPlatformDisplayName(l.platform)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={l.leadScore >= 70 ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}>
                        {l.leadScore}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{String(l.category).replace(/_/g, " ")}</span>
                    </TableCell>
                    <TableCell className="text-right">{l.engagement}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {l.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No scored results yet</div>
          )}
        </CardContent>
      </Card>

      {/* Platform & Sentiment Distribution (moved from main dashboard) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Results by Platform</CardTitle>
            <CardDescription>Distribution of results across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.platformDist.length > 0 ? (
                (() => {
                  const total = data.platformDist.reduce((sum, x) => sum + x.count, 0);
                  return data.platformDist.map((p) => {
                    const percentage = total > 0 ? (p.count / total) * 100 : 0;
                    return (
                      <div key={p.platform} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{getPlatformDisplayName(p.platform)}</span>
                          <span className="text-muted-foreground">
                            {p.count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full ${getPlatformBarColor(p.platform)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="text-center text-muted-foreground py-4">No results yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sentiment Analysis</CardTitle>
            <CardDescription>Breakdown of result sentiments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.sentimentDist.filter((s) => s.sentiment).length > 0 ? (
                (() => {
                  const filtered = data.sentimentDist.filter((s) => s.sentiment);
                  const total = filtered.reduce((sum, x) => sum + x.count, 0);
                  return filtered.map((s) => {
                    const percentage = total > 0 ? (s.count / total) * 100 : 0;
                    return (
                      <div key={s.sentiment} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{s.sentiment}</span>
                          <span className="text-muted-foreground">
                            {s.count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full ${getSentimentBarColor(s.sentiment)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="text-center text-muted-foreground py-4">No sentiment data yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
