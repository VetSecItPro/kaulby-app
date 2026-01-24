import { db } from "@/lib/db";
import { aiLogs } from "@/lib/db/schema";
import { count, sum, desc, sql, gte, and } from "drizzle-orm";
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
import { ArrowLeft, Activity, Server, Clock, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getDetailedSystemHealth() {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Detailed AI call stats
  const [
    hourlyStats,
    modelStats,
    latencyDistribution,
    errorAnalysis,
    peakHours,
    dailyTrend,
  ] = await Promise.all([
    // Hourly breakdown for last 24h
    db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${aiLogs.createdAt})`,
        totalCalls: count(),
        totalCost: sum(aiLogs.costUsd),
        avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, twentyFourHoursAgo))
      .groupBy(sql`EXTRACT(HOUR FROM ${aiLogs.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${aiLogs.createdAt})`),

    // Model breakdown
    db
      .select({
        model: aiLogs.model,
        totalCalls: count(),
        totalCost: sum(aiLogs.costUsd),
        totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
        avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
        minLatency: sql<number>`MIN(${aiLogs.latencyMs})`,
        maxLatency: sql<number>`MAX(${aiLogs.latencyMs})`,
        avgCost: sql<number>`AVG(${aiLogs.costUsd})`,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, twentyFourHoursAgo))
      .groupBy(aiLogs.model)
      .orderBy(desc(sum(aiLogs.costUsd))),

    // Latency distribution
    db
      .select({
        bucket: sql<string>`
          CASE
            WHEN ${aiLogs.latencyMs} < 500 THEN '< 500ms'
            WHEN ${aiLogs.latencyMs} < 1000 THEN '500ms - 1s'
            WHEN ${aiLogs.latencyMs} < 2000 THEN '1s - 2s'
            WHEN ${aiLogs.latencyMs} < 5000 THEN '2s - 5s'
            ELSE '> 5s'
          END
        `,
        count: count(),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, twentyFourHoursAgo))
      .groupBy(sql`
        CASE
          WHEN ${aiLogs.latencyMs} < 500 THEN '< 500ms'
          WHEN ${aiLogs.latencyMs} < 1000 THEN '500ms - 1s'
          WHEN ${aiLogs.latencyMs} < 2000 THEN '1s - 2s'
          WHEN ${aiLogs.latencyMs} < 5000 THEN '2s - 5s'
          ELSE '> 5s'
        END
      `),

    // Error analysis (high latency = potential errors)
    db
      .select({
        count: count(),
      })
      .from(aiLogs)
      .where(
        and(
          gte(aiLogs.createdAt, twentyFourHoursAgo),
          sql`${aiLogs.latencyMs} > 10000 OR ${aiLogs.latencyMs} IS NULL`
        )
      ),

    // Peak hours
    db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${aiLogs.createdAt})`,
        callCount: count(),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, sevenDaysAgo))
      .groupBy(sql`EXTRACT(HOUR FROM ${aiLogs.createdAt})`)
      .orderBy(desc(count()))
      .limit(5),

    // Daily trend (last 7 days)
    db
      .select({
        date: sql<string>`DATE(${aiLogs.createdAt})`,
        totalCalls: count(),
        totalCost: sum(aiLogs.costUsd),
        avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${aiLogs.createdAt})`)
      .orderBy(desc(sql`DATE(${aiLogs.createdAt})`)),
  ]);

  // Summary stats
  const [totalStats] = await db
    .select({
      totalCalls: count(),
      totalCost: sum(aiLogs.costUsd),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
      avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, twentyFourHoursAgo));

  return {
    summary: {
      totalCalls24h: Number(totalStats?.totalCalls) || 0,
      totalCost24h: Number(totalStats?.totalCost) || 0,
      totalTokens24h: Number(totalStats?.totalTokens) || 0,
      avgLatency24h: Number(totalStats?.avgLatency) || 0,
      errorCount24h: errorAnalysis[0]?.count || 0,
    },
    hourlyStats: hourlyStats.map((h) => ({
      hour: h.hour,
      calls: Number(h.totalCalls) || 0,
      cost: Number(h.totalCost) || 0,
      avgLatency: Number(h.avgLatency) || 0,
    })),
    modelStats: modelStats.map((m) => ({
      model: m.model,
      calls: Number(m.totalCalls) || 0,
      cost: Number(m.totalCost) || 0,
      tokens: Number(m.totalTokens) || 0,
      avgLatency: Number(m.avgLatency) || 0,
      minLatency: Number(m.minLatency) || 0,
      maxLatency: Number(m.maxLatency) || 0,
      avgCost: Number(m.avgCost) || 0,
    })),
    latencyDistribution: latencyDistribution.map((l) => ({
      bucket: l.bucket,
      count: Number(l.count) || 0,
    })),
    peakHours: peakHours.map((p) => ({
      hour: p.hour,
      calls: Number(p.callCount) || 0,
    })),
    dailyTrend: dailyTrend.map((d) => ({
      date: d.date,
      calls: Number(d.totalCalls) || 0,
      cost: Number(d.totalCost) || 0,
      avgLatency: Number(d.avgLatency) || 0,
    })),
  };
}

function formatCurrency(value: number, decimals = 4) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default async function SystemHealthPage() {
  const data = await getDetailedSystemHealth();

  const errorRate = data.summary.totalCalls24h > 0
    ? (data.summary.errorCount24h / data.summary.totalCalls24h) * 100
    : 0;

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
            <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
            <p className="text-muted-foreground">AI infrastructure performance and reliability</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={errorRate < 1 ? "border-green-500 text-green-500" : "border-red-500 text-red-500"}
        >
          {errorRate < 1 ? "All Systems Operational" : "Issues Detected"}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.summary.totalCalls24h)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.summary.totalTokens24h)} tokens
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Cost (24h)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {formatCurrency(data.summary.totalCost24h, 2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(data.summary.totalCalls24h > 0 ? data.summary.totalCost24h / data.summary.totalCalls24h : 0, 4)} avg/call
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.avgLatency24h > 2000 ? "text-amber-500" : "text-green-500"}`}>
              {formatLatency(data.summary.avgLatency24h)}
            </div>
            <p className="text-xs text-muted-foreground">Per API call</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${errorRate > 5 ? "text-red-500" : errorRate > 1 ? "text-amber-500" : "text-green-500"}`}>
              {errorRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {data.summary.errorCount24h} errors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost/Token</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary.totalTokens24h > 0 ? (data.summary.totalCost24h / data.summary.totalTokens24h) * 1000000 : 0, 2)}
            </div>
            <p className="text-xs text-muted-foreground">Per 1M tokens</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Model - CRITICAL for understanding expense */}
      <Card className="border-amber-500/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Cost by Model (Last 24h)
          </CardTitle>
          <CardDescription>This is where your money goes - model selection drives costs</CardDescription>
        </CardHeader>
        <CardContent>
          {data.modelStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Avg Cost/Call</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.modelStats.map((model) => {
                  const percentOfTotal = data.summary.totalCost24h > 0
                    ? (model.cost / data.summary.totalCost24h) * 100
                    : 0;
                  const isExpensive = model.avgCost > 0.01; // More than 1 cent per call is expensive
                  return (
                    <TableRow key={model.model} className={isExpensive ? "bg-amber-500/10" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {model.model}
                          </code>
                          {isExpensive && (
                            <Badge variant="destructive" className="text-xs">EXPENSIVE</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(model.calls)}</TableCell>
                      <TableCell className="text-right">{formatNumber(model.tokens)}</TableCell>
                      <TableCell className={`text-right font-medium ${isExpensive ? "text-red-500" : ""}`}>
                        {formatCurrency(model.avgCost)}
                      </TableCell>
                      <TableCell className="text-right">{formatLatency(model.avgLatency)}</TableCell>
                      <TableCell className="text-right font-medium text-amber-500">
                        {formatCurrency(model.cost, 2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full">
                            <div
                              className={`h-2 rounded-full ${isExpensive ? "bg-red-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs w-12">{percentOfTotal.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No API calls in the last 24 hours</div>
          )}
        </CardContent>
      </Card>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily AI Usage (Last 7 Days)</CardTitle>
          <CardDescription>Track spending trends over time</CardDescription>
        </CardHeader>
        <CardContent>
          {data.dailyTrend.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Cost/Call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dailyTrend.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell>{day.date}</TableCell>
                    <TableCell className="text-right">{formatNumber(day.calls)}</TableCell>
                    <TableCell className="text-right">{formatLatency(day.avgLatency)}</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">
                      {formatCurrency(day.cost, 2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(day.calls > 0 ? day.cost / day.calls : 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No data</div>
          )}
        </CardContent>
      </Card>

      {/* Latency Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latency Distribution</CardTitle>
            <CardDescription>Response time buckets (last 24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.latencyDistribution.map((bucket) => {
                const total = data.latencyDistribution.reduce((sum, b) => sum + b.count, 0);
                const percentage = total > 0 ? (bucket.count / total) * 100 : 0;
                return (
                  <div key={bucket.bucket} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{bucket.bucket}</span>
                      <span className="text-muted-foreground">
                        {bucket.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${
                          bucket.bucket.includes("> 5s") ? "bg-red-500" :
                          bucket.bucket.includes("2s") ? "bg-amber-500" :
                          "bg-green-500"
                        }`}
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
            <CardTitle className="text-lg">Peak Hours</CardTitle>
            <CardDescription>Busiest times for AI calls (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.peakHours.map((peak, index) => {
                const maxCalls = data.peakHours[0]?.calls || 1;
                const percentage = (peak.calls / maxCalls) * 100;
                return (
                  <div key={peak.hour} className="flex items-center gap-4">
                    <span className="text-muted-foreground w-8">#{index + 1}</span>
                    <span className="font-medium w-20">{peak.hour}:00</span>
                    <div className="flex-1 h-2 bg-muted rounded-full">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-20 text-right">
                      {formatNumber(peak.calls)} calls
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
