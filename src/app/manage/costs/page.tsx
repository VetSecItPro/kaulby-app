import { db } from "@/lib/db";
import { users, results, aiLogs, budgetAlerts, budgetAlertHistory, monitors } from "@/lib/db/schema";
import { count, sum, desc, sql, gte, eq, and } from "drizzle-orm";
import { BudgetAlerts } from "@/components/admin/budget-alerts";
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
import { ArrowLeft, DollarSign, Users, TrendingUp, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvExport } from "./csv-export";

export const dynamic = "force-dynamic";

async function getDetailedCostData(days: number = 30) {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);

  const previousPeriodStart = new Date();
  previousPeriodStart.setDate(previousPeriodStart.getDate() - days * 2);

  // Start of current calendar month for forecast
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Cost by plan - detailed
  const costByPlanQuery = await db
    .select({
      plan: users.subscriptionStatus,
      userCount: count(sql`DISTINCT ${aiLogs.userId}`),
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, periodStart))
    .groupBy(users.subscriptionStatus);

  // Previous period for comparison
  const previousCostByPlan = await db
    .select({
      plan: users.subscriptionStatus,
      totalCost: sum(aiLogs.costUsd),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(
      and(
        gte(aiLogs.createdAt, previousPeriodStart),
        sql`${aiLogs.createdAt} < ${periodStart}`
      )
    )
    .groupBy(users.subscriptionStatus);

  // Top 20 users by cost
  const topUsersByCostQuery = await db
    .select({
      userId: aiLogs.userId,
      email: users.email,
      name: users.name,
      plan: users.subscriptionStatus,
      totalCost: sum(aiLogs.costUsd),
      aiCalls: count(),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, periodStart))
    .groupBy(aiLogs.userId, users.email, users.name, users.subscriptionStatus)
    .orderBy(desc(sum(aiLogs.costUsd)))
    .limit(20);

  // Cost by model - detailed
  const costByModelQuery = await db
    .select({
      model: aiLogs.model,
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
      promptTokens: sum(aiLogs.promptTokens),
      completionTokens: sum(aiLogs.completionTokens),
      avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, periodStart))
    .groupBy(aiLogs.model)
    .orderBy(desc(sum(aiLogs.costUsd)));

  // Daily cost trend
  const dailyCostTrend = await db
    .select({
      date: sql<string>`DATE(${aiLogs.createdAt})`,
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, periodStart))
    .groupBy(sql`DATE(${aiLogs.createdAt})`)
    .orderBy(sql`DATE(${aiLogs.createdAt})`);

  // Current month spend for forecast
  const currentMonthSpendQuery = await db
    .select({
      totalCost: sum(aiLogs.costUsd),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, startOfMonth));

  // Cost by monitor
  const costByMonitorQuery = await db
    .select({
      monitorId: aiLogs.monitorId,
      monitorName: monitors.name,
      platform: aiLogs.platform,
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
    })
    .from(aiLogs)
    .leftJoin(monitors, eq(aiLogs.monitorId, monitors.id))
    .where(
      and(
        gte(aiLogs.createdAt, periodStart),
        sql`${aiLogs.monitorId} IS NOT NULL`
      )
    )
    .groupBy(aiLogs.monitorId, monitors.name, aiLogs.platform)
    .orderBy(desc(sum(aiLogs.costUsd)))
    .limit(20);

  // Cost by analysis type
  const costByAnalysisTypeQuery = await db
    .select({
      analysisType: aiLogs.analysisType,
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
      cacheHits: sql<number>`COUNT(CASE WHEN ${aiLogs.cacheHit} = true THEN 1 END)`,
    })
    .from(aiLogs)
    .where(
      and(
        gte(aiLogs.createdAt, periodStart),
        sql`${aiLogs.analysisType} IS NOT NULL`
      )
    )
    .groupBy(aiLogs.analysisType)
    .orderBy(desc(sum(aiLogs.costUsd)));

  // Summary stats
  const [totalStats, resultsCount, paidUserStats] = await Promise.all([
    db
      .select({
        totalCost: sum(aiLogs.costUsd),
        totalCalls: count(),
        userCount: count(sql`DISTINCT ${aiLogs.userId}`),
        totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, periodStart)),
    db.select({ count: count() }).from(results).where(gte(results.createdAt, periodStart)),
    db
      .select({
        totalCost: sum(aiLogs.costUsd),
        userCount: count(sql`DISTINCT ${aiLogs.userId}`),
      })
      .from(aiLogs)
      .innerJoin(users, eq(aiLogs.userId, users.id))
      .where(
        and(
          gte(aiLogs.createdAt, periodStart),
          sql`${users.subscriptionStatus} IN ('pro', 'enterprise')`
        )
      ),
  ]);

  // Forecast calculations
  const currentMonthSpend = Number(currentMonthSpendQuery[0]?.totalCost) || 0;
  const daysWithData = dailyCostTrend.length;
  const totalCostInPeriod = Number(totalStats[0]?.totalCost) || 0;
  const dailyAvgCost = daysWithData > 0 ? totalCostInPeriod / daysWithData : 0;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const projectedMonthEnd = currentMonthSpend + dailyAvgCost * daysRemaining;

  // Total cost for analysis type percentage calculation
  const analysisTypeTotalCost = costByAnalysisTypeQuery.reduce(
    (acc, item) => acc + (Number(item.totalCost) || 0),
    0
  );

  return {
    costByPlan: costByPlanQuery.map((item) => ({
      plan: item.plan || "free",
      userCount: Number(item.userCount) || 0,
      totalCost: Number(item.totalCost) || 0,
      totalCalls: Number(item.totalCalls) || 0,
      totalTokens: Number(item.totalTokens) || 0,
      avgCostPerUser:
        Number(item.userCount) > 0
          ? Number(item.totalCost) / Number(item.userCount)
          : 0,
      previousCost: Number(
        previousCostByPlan.find((p) => p.plan === item.plan)?.totalCost || 0
      ),
    })),
    topUsersByCost: topUsersByCostQuery.map((user) => ({
      userId: user.userId || "",
      email: user.email,
      name: user.name,
      plan: user.plan || "free",
      totalCost: Number(user.totalCost) || 0,
      aiCalls: Number(user.aiCalls) || 0,
      totalTokens: Number(user.totalTokens) || 0,
    })),
    costByModel: costByModelQuery.map((item) => ({
      model: item.model,
      totalCost: Number(item.totalCost) || 0,
      totalCalls: Number(item.totalCalls) || 0,
      totalTokens: Number(item.totalTokens) || 0,
      promptTokens: Number(item.promptTokens) || 0,
      completionTokens: Number(item.completionTokens) || 0,
      avgLatency: Number(item.avgLatency) || 0,
    })),
    dailyTrend: dailyCostTrend.map((item) => ({
      date: item.date,
      totalCost: Number(item.totalCost) || 0,
      totalCalls: Number(item.totalCalls) || 0,
    })),
    costByMonitor: costByMonitorQuery.map((item) => ({
      monitorId: item.monitorId || "",
      monitorName: item.monitorName || "Deleted Monitor",
      platform: item.platform || "unknown",
      totalCost: Number(item.totalCost) || 0,
      totalCalls: Number(item.totalCalls) || 0,
    })),
    costByAnalysisType: costByAnalysisTypeQuery.map((item) => ({
      analysisType: item.analysisType || "unknown",
      totalCost: Number(item.totalCost) || 0,
      totalCalls: Number(item.totalCalls) || 0,
      cacheHits: Number(item.cacheHits) || 0,
      percentOfTotal:
        analysisTypeTotalCost > 0
          ? (Number(item.totalCost) / analysisTypeTotalCost) * 100
          : 0,
    })),
    forecast: {
      dailyAvgCost,
      projectedMonthEnd,
      daysRemaining,
      currentMonthSpend,
    },
    summary: {
      totalCost: Number(totalStats[0]?.totalCost) || 0,
      totalCalls: Number(totalStats[0]?.totalCalls) || 0,
      totalUsers: Number(totalStats[0]?.userCount) || 0,
      totalTokens: Number(totalStats[0]?.totalTokens) || 0,
      totalResults: resultsCount[0]?.count || 0,
      avgCostPerUser:
        Number(totalStats[0]?.userCount) > 0
          ? Number(totalStats[0]?.totalCost) / Number(totalStats[0]?.userCount)
          : 0,
      avgCostPerPaidUser:
        Number(paidUserStats[0]?.userCount) > 0
          ? Number(paidUserStats[0]?.totalCost) / Number(paidUserStats[0]?.userCount)
          : 0,
      costPerResult:
        (resultsCount[0]?.count || 0) > 0
          ? Number(totalStats[0]?.totalCost) / (resultsCount[0]?.count || 1)
          : 0,
    },
  };
}

async function getBudgetAlertsData() {
  const alerts = await db.query.budgetAlerts.findMany({
    orderBy: [desc(budgetAlerts.createdAt)],
    with: {
      history: {
        orderBy: [desc(budgetAlertHistory.createdAt)],
        limit: 5,
      },
    },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    name: alert.name,
    period: alert.period as "daily" | "weekly" | "monthly",
    thresholdUsd: alert.thresholdUsd,
    warningPercent: alert.warningPercent,
    isActive: alert.isActive,
    notifyEmail: alert.notifyEmail,
    notifySlack: alert.notifySlack,
    currentPeriodSpend: alert.currentPeriodSpend,
    history: alert.history.map((h) => ({
      id: h.id,
      alertType: h.alertType,
      spendUsd: h.spendUsd,
      percentOfThreshold: h.percentOfThreshold,
      createdAt: h.createdAt.toISOString(),
    })),
    lastTriggeredAt: alert.lastTriggeredAt?.toISOString() || null,
    createdAt: alert.createdAt.toISOString(),
  }));
}

function formatCurrency(value: number, decimals = 2) {
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

function getPlanBadge(plan: string) {
  switch (plan) {
    case "enterprise":
      return <Badge className="bg-amber-500 text-white">Enterprise</Badge>;
    case "pro":
      return <Badge className="bg-primary text-primary-foreground">Pro</Badge>;
    default:
      return <Badge variant="secondary">Free</Badge>;
  }
}

const VALID_DAYS = [30, 60, 90] as const;
type ValidDays = (typeof VALID_DAYS)[number];

function parsedays(raw: string | undefined): ValidDays {
  const parsed = Number(raw);
  return (VALID_DAYS as readonly number[]).includes(parsed)
    ? (parsed as ValidDays)
    : 30;
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: rawDays } = await searchParams;
  const days = parsedays(rawDays);

  const [data, alertsData] = await Promise.all([
    getDetailedCostData(days),
    getBudgetAlertsData(),
  ]);

  const { forecast } = data;

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
            <h1 className="text-3xl font-bold tracking-tight">AI Cost Analysis</h1>
            <p className="text-muted-foreground">
              Detailed breakdown of AI usage and costs (last {days} days)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex gap-1">
            {VALID_DAYS.map((d) => (
              <Link key={d} href={`/manage/costs?days=${d}`}>
                <Button variant={days === d ? "default" : "outline"} size="sm">
                  {d}d
                </Button>
              </Link>
            ))}
          </div>
          <CsvExport dailyTrend={data.dailyTrend} />
          <Link href="/manage/costs/services">
            <Button variant="outline" size="sm" className="gap-2">
              All Services <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Badge variant="outline">AI Usage</Badge>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {formatCurrency(data.summary.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.summary.totalCalls)} API calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost / User</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.avgCostPerUser)}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.totalUsers} active users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost / Paid User</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.avgCostPerPaidUser)}</div>
            <p className="text-xs text-muted-foreground">Pro + Enterprise</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost / Result</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.costPerResult, 4)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.summary.totalResults)} results analyzed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 30-Day Cost Forecast */}
      <Card className="border-blue-500/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <CardTitle className="text-lg">30-Day Cost Forecast</CardTitle>
          </div>
          <CardDescription>
            Projected month-end spend based on current daily average
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Daily Burn Rate</p>
              <p className="mt-1 text-2xl font-bold text-blue-400">
                {formatCurrency(forecast.dailyAvgCost)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Average over last {days} days
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Current Month Spend</p>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(forecast.currentMonthSpend)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Since start of month
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Projected Month-End</p>
              <p className="mt-1 text-2xl font-bold text-amber-500">
                {formatCurrency(forecast.projectedMonthEnd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {forecast.daysRemaining} days remaining in month
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost by Model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost by Model</CardTitle>
          <CardDescription>Detailed AI model usage and costs</CardDescription>
        </CardHeader>
        <CardContent>
          {data.costByModel.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Prompt Tokens</TableHead>
                  <TableHead className="text-right">Completion Tokens</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.costByModel.map((item) => (
                  <TableRow key={item.model}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.model}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.totalCalls)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.promptTokens)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.completionTokens)}</TableCell>
                    <TableCell className="text-right">{item.avgLatency.toFixed(0)}ms</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">
                      {formatCurrency(item.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No AI usage data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Cost by Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost by Subscription Plan</CardTitle>
          <CardDescription>AI costs breakdown by user subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          {data.costByPlan.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">API Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Avg/User</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">vs Prev {days}d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.costByPlan.map((item) => {
                  const change = item.previousCost > 0
                    ? ((item.totalCost - item.previousCost) / item.previousCost) * 100
                    : 0;
                  return (
                    <TableRow key={item.plan}>
                      <TableCell>{getPlanBadge(item.plan)}</TableCell>
                      <TableCell className="text-right">{item.userCount}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.totalCalls)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.totalTokens)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.avgCostPerUser)}</TableCell>
                      <TableCell className="text-right font-medium text-amber-500">
                        {formatCurrency(item.totalCost)}
                      </TableCell>
                      <TableCell className={`text-right ${change > 0 ? "text-red-500" : change < 0 ? "text-green-500" : ""}`}>
                        {change > 0 ? "+" : ""}{change.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No AI usage data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Cost per Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost per Monitor</CardTitle>
          <CardDescription>
            AI spend attributed to each monitor (last {days} days, top 20)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.costByMonitor.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monitor</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">AI Calls</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.costByMonitor.map((item) => (
                  <TableRow key={`${item.monitorId}-${item.platform}`}>
                    <TableCell>
                      <p className="font-medium">{item.monitorName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.monitorId}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.totalCalls)}</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">
                      {formatCurrency(item.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No monitor cost data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Cost by Analysis Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost by Analysis Type</CardTitle>
          <CardDescription>
            AI spend broken down by feature / analysis operation (last {days} days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.costByAnalysisType.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Analysis Type</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Cache Hits</TableHead>
                  <TableHead className="text-right">Cache Rate</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.costByAnalysisType.map((item) => {
                  const cacheRate =
                    item.totalCalls > 0
                      ? (item.cacheHits / item.totalCalls) * 100
                      : 0;
                  return (
                    <TableRow key={item.analysisType}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {item.analysisType}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(item.totalCalls)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.cacheHits)}</TableCell>
                      <TableCell className="text-right">
                        <span className={cacheRate > 30 ? "text-green-500" : "text-muted-foreground"}>
                          {cacheRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-500">
                        {formatCurrency(item.totalCost)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.percentOfTotal.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No analysis type data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Top Users by Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Top Users by AI Cost</CardTitle>
            <CardDescription>Users with highest AI usage (last {days} days)</CardDescription>
          </div>
          <Link href="/manage/costs/users">
            <Button variant="outline" size="sm" className="gap-2">
              View All Users <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {data.topUsersByCost.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">API Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topUsersByCost.slice(0, 10).map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(user.plan)}</TableCell>
                    <TableCell className="text-right">{formatNumber(user.aiCalls)}</TableCell>
                    <TableCell className="text-right">{formatNumber(user.totalTokens)}</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">
                      {formatCurrency(user.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No AI usage data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Budget Alerts */}
      <BudgetAlerts initialAlerts={alertsData} />
    </div>
  );
}
