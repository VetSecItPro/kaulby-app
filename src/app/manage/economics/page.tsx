import { db } from "@/lib/db";
import { users, aiLogs, results } from "@/lib/db/schema";
import { count, sum, desc, gte, eq, and, sql } from "drizzle-orm";
import { PLANS } from "@/lib/plans";
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
import { ArrowLeft, DollarSign, TrendingUp, Users, PieChart, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ANNUAL_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000; // 60 days in ms

function getUserMonthlyRevenue(
  plan: string | null,
  periodStart: Date | null,
  periodEnd: Date | null
): number {
  const isAnnual =
    periodStart &&
    periodEnd &&
    (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) > ANNUAL_THRESHOLD_MS;

  switch (plan) {
    case "team":
      return isAnnual ? PLANS.team.annualPrice / 12 : PLANS.team.price;
    case "pro":
      return isAnnual ? PLANS.pro.annualPrice / 12 : PLANS.pro.price;
    default:
      return 0;
  }
}

async function getUnitEconomicsData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // --- Billing-aware revenue: fetch per-user billing periods for paid users ---
  const paidUsersRaw = await db
    .select({
      id: users.id,
      status: users.subscriptionStatus,
      currentPeriodStart: users.currentPeriodStart,
      currentPeriodEnd: users.currentPeriodEnd,
    })
    .from(users)
    .where(sql`${users.polarSubscriptionId} IS NOT NULL`);

  // Build a map of userId -> monthly revenue for paid users
  const paidUserRevenueMap = new Map<string, number>();
  for (const u of paidUsersRaw) {
    paidUserRevenueMap.set(
      u.id,
      getUserMonthlyRevenue(u.status, u.currentPeriodStart, u.currentPeriodEnd)
    );
  }

  // --- Margin by Plan ---
  // Count users per plan (all users, not just those with AI logs)
  const usersByPlan = await db
    .select({
      plan: users.subscriptionStatus,
      userCount: count(),
    })
    .from(users)
    .groupBy(users.subscriptionStatus);

  // AI cost per plan for the last 30 days
  const aiCostByPlan = await db
    .select({
      plan: users.subscriptionStatus,
      totalAiCost: sum(aiLogs.costUsd),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(users.subscriptionStatus);

  // Compute billing-aware revenue per plan
  const planRevenue = { free: 0, pro: 0, team: 0 };
  for (const u of paidUsersRaw) {
    const rev = getUserMonthlyRevenue(u.status, u.currentPeriodStart, u.currentPeriodEnd);
    if (u.status === "pro") planRevenue.pro += rev;
    else if (u.status === "team") planRevenue.team += rev;
  }

  const plans = ["free", "pro", "team"] as const;

  const marginByPlan = plans.map((planKey) => {
    const userCount = Number(usersByPlan.find((r) => r.plan === planKey)?.userCount) || 0;
    const totalAiCost = Number(aiCostByPlan.find((r) => r.plan === planKey)?.totalAiCost) || 0;
    const monthlyRevenue = planRevenue[planKey];
    const margin = monthlyRevenue - totalAiCost;
    const marginPercent = monthlyRevenue > 0 ? (margin / monthlyRevenue) * 100 : 0;

    return {
      plan: planKey,
      userCount,
      totalAiCost,
      monthlyRevenue,
      margin,
      marginPercent,
    };
  });

  // --- Customer Profitability (Top 20 most expensive) ---
  const topUsersByCost = await db
    .select({
      userId: aiLogs.userId,
      email: users.email,
      name: users.name,
      subscriptionStatus: users.subscriptionStatus,
      currentPeriodStart: users.currentPeriodStart,
      currentPeriodEnd: users.currentPeriodEnd,
      totalAiCost: sum(aiLogs.costUsd),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiLogs.userId, users.email, users.name, users.subscriptionStatus, users.currentPeriodStart, users.currentPeriodEnd)
    .orderBy(desc(sum(aiLogs.costUsd)))
    .limit(20);

  const paidProfitability: typeof customerProfitability = [];
  const freeTierSubsidy: typeof customerProfitability = [];

  type ProfitEntry = {
    userId: string;
    email: string | null;
    name: string | null;
    subscriptionStatus: string;
    totalAiCost: number;
    monthlyRevenue: number;
    profitability: number;
  };
  const customerProfitability: ProfitEntry[] = [];

  for (const user of topUsersByCost) {
    const totalAiCost = Number(user.totalAiCost) || 0;
    const monthlyRevenue = getUserMonthlyRevenue(
      user.subscriptionStatus,
      user.currentPeriodStart,
      user.currentPeriodEnd
    );
    const profitability = monthlyRevenue - totalAiCost;
    const entry: ProfitEntry = {
      userId: user.userId || "",
      email: user.email,
      name: user.name,
      subscriptionStatus: user.subscriptionStatus || "free",
      totalAiCost,
      monthlyRevenue,
      profitability,
    };
    customerProfitability.push(entry);
    if (user.subscriptionStatus === "free" || !user.subscriptionStatus) {
      freeTierSubsidy.push(entry);
    } else {
      paidProfitability.push(entry);
    }
  }

  // Free tier total subsidy cost
  const freeSubsidyCost = freeTierSubsidy.reduce((sum, u) => sum + u.totalAiCost, 0);

  // --- Summary stats ---
  const [totalAiStats, resultsCount] = await Promise.all([
    db
      .select({
        totalCost: sum(aiLogs.costUsd),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, thirtyDaysAgo)),

    db
      .select({ count: count() })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo)),
  ]);

  const totalAiCost30d = Number(totalAiStats[0]?.totalCost) || 0;
  const totalResults30d = resultsCount[0]?.count || 0;

  // Total revenue = billing-aware sum
  const totalRevenue = marginByPlan.reduce((s, p) => s + p.monthlyRevenue, 0);
  const grossMargin = totalRevenue - totalAiCost30d;
  const grossMarginPercent = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
  const costPerResult = totalResults30d > 0 ? totalAiCost30d / totalResults30d : 0;

  return {
    marginByPlan,
    paidProfitability,
    freeTierSubsidy,
    freeSubsidyCost,
    customerProfitability,
    summary: {
      totalRevenue,
      totalAiCost30d,
      grossMargin,
      grossMarginPercent,
      costPerResult,
      totalResults30d,
    },
  };
}

// PERF-BUILDTIME-004: Cache Intl formatters at module level
const currencyFormatters = new Map<number, Intl.NumberFormat>();
const numberFormatter = new Intl.NumberFormat("en-US");

function formatCurrency(value: number, decimals = 2) {
  if (!currencyFormatters.has(decimals)) {
    currencyFormatters.set(decimals, new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }));
  }
  return currencyFormatters.get(decimals)!.format(value);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function getPlanBadge(plan: string | null) {
  switch (plan) {
    case "team":
      return <Badge className="bg-amber-500 text-white">Enterprise</Badge>;
    case "pro":
      return <Badge className="bg-primary text-primary-foreground">Pro</Badge>;
    default:
      return <Badge variant="secondary">Free</Badge>;
  }
}

export default async function UnitEconomicsPage() {
  const data = await getUnitEconomicsData();

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
            <h1 className="text-3xl font-bold tracking-tight">Unit Economics</h1>
            <p className="text-muted-foreground">Revenue vs cost analysis by plan and customer</p>
          </div>
        </div>
        <Badge variant="outline">Last 30 days</Badge>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(data.summary.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Billing-aware: annual subscribers use actual monthly equivalent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Cost (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {formatCurrency(data.summary.totalAiCost30d)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.summary.totalResults30d)} results analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Margin</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.grossMargin > 0 ? "text-green-500" : data.summary.grossMargin < 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {formatCurrency(data.summary.grossMargin)}
            </div>
            <p className="text-xs text-muted-foreground">Revenue minus AI cost only</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Margin %</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.grossMarginPercent >= 50 ? "text-green-500" : data.summary.grossMarginPercent >= 0 ? "text-amber-500" : "text-red-500"}`}>
              {data.summary.totalRevenue > 0
                ? `${data.summary.grossMarginPercent.toFixed(1)}%`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Cost/result: {formatCurrency(data.summary.costPerResult, 4)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Margin by Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Margin by Plan</CardTitle>
          <CardDescription>Revenue vs AI cost breakdown per subscription tier (excludes Apify, Vercel, Inngest costs)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Monthly Revenue</TableHead>
                <TableHead className="text-right">AI Cost (30d)</TableHead>
                <TableHead className="text-right">AI Margin</TableHead>
                <TableHead className="text-right">AI Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.marginByPlan.map((item) => (
                <TableRow key={item.plan}>
                  <TableCell>{getPlanBadge(item.plan)}</TableCell>
                  <TableCell className="text-right">{formatNumber(item.userCount)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.monthlyRevenue)}
                  </TableCell>
                  <TableCell className="text-right text-amber-500">
                    {formatCurrency(item.totalAiCost)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${item.margin > 0 ? "text-green-500" : item.margin < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {formatCurrency(item.margin)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${item.margin > 0 ? "text-green-500" : item.margin < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {item.monthlyRevenue > 0
                      ? `${item.marginPercent.toFixed(1)}%`
                      : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Free Tier Subsidy Summary */}
      {data.freeSubsidyCost > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-amber-500" />
                Free Tier Subsidy Cost
              </CardTitle>
              <CardDescription>Total AI spend on free users (acquisition cost)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {formatCurrency(data.freeSubsidyCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.freeTierSubsidy.length} free user{data.freeTierSubsidy.length !== 1 ? "s" : ""} with AI usage in the last 30 days
            </p>
          </CardContent>
        </Card>
      )}

      {/* Paid Customer Profitability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paid Customer AI Profit/Loss</CardTitle>
          <CardDescription>Pro and Team users ranked by AI cost (last 30 days). Revenue is billing-aware (annual vs monthly).</CardDescription>
        </CardHeader>
        <CardContent>
          {data.paidProfitability.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">AI Cost</TableHead>
                  <TableHead className="text-right">AI Profit/Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.paidProfitability.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(user.subscriptionStatus)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(user.monthlyRevenue)}
                    </TableCell>
                    <TableCell className="text-right text-amber-500">
                      {formatCurrency(user.totalAiCost)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${user.profitability > 0 ? "text-green-500" : user.profitability < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {formatCurrency(user.profitability)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No paid user AI usage in the last 30 days</div>
          )}
        </CardContent>
      </Card>

      {/* Free Tier Subsidy Breakdown */}
      {data.freeTierSubsidy.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-4 w-4 text-amber-500" />
              Free Tier Subsidy Breakdown
            </CardTitle>
            <CardDescription>Free users with AI usage — these are acquisition costs, not losses. Negative values are expected.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">AI Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.freeTierSubsidy.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(user.subscriptionStatus)}</TableCell>
                    <TableCell className="text-right text-amber-500">
                      {formatCurrency(user.totalAiCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
