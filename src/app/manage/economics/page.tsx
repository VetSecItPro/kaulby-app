import { db } from "@/lib/db";
import { users, aiLogs, results } from "@/lib/db/schema";
import { count, sum, desc, gte, eq } from "drizzle-orm";
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
import { ArrowLeft, DollarSign, TrendingUp, Users, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// Plan price lookup — maps subscriptionStatus values to their monthly price
function getPlanPrice(plan: string | null): number {
  switch (plan) {
    case "enterprise":
      return PLANS.enterprise.price; // 99
    case "pro":
      return PLANS.pro.price; // 29
    default:
      return PLANS.free.price; // 0
  }
}

async function getUnitEconomicsData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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

  const plans = ["free", "pro", "enterprise"] as const;

  const marginByPlan = plans.map((planKey) => {
    const userCount = Number(usersByPlan.find((r) => r.plan === planKey)?.userCount) || 0;
    const totalAiCost = Number(aiCostByPlan.find((r) => r.plan === planKey)?.totalAiCost) || 0;
    const planPrice = getPlanPrice(planKey);
    const monthlyRevenue = userCount * planPrice;
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
      totalAiCost: sum(aiLogs.costUsd),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiLogs.userId, users.email, users.name, users.subscriptionStatus)
    .orderBy(desc(sum(aiLogs.costUsd)))
    .limit(20);

  const customerProfitability = topUsersByCost.map((user) => {
    const totalAiCost = Number(user.totalAiCost) || 0;
    const planPrice = getPlanPrice(user.subscriptionStatus);
    const profitability = planPrice - totalAiCost;

    return {
      userId: user.userId || "",
      email: user.email,
      name: user.name,
      subscriptionStatus: user.subscriptionStatus || "free",
      totalAiCost,
      monthlyRevenue: planPrice,
      profitability,
    };
  });

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

  // Total revenue = sum over all users of their plan price
  const totalRevenue = marginByPlan.reduce((sum, p) => sum + p.monthlyRevenue, 0);
  const grossMargin = totalRevenue - totalAiCost30d;
  const grossMarginPercent = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
  const costPerResult = totalResults30d > 0 ? totalAiCost30d / totalResults30d : 0;

  return {
    marginByPlan,
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
    case "enterprise":
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
              All users x their plan price
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
            <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.grossMargin >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(data.summary.grossMargin)}
            </div>
            <p className="text-xs text-muted-foreground">Revenue minus AI cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin %</CardTitle>
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
          <CardTitle className="text-lg">Margin by Plan</CardTitle>
          <CardDescription>Revenue vs AI cost breakdown per subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Monthly Revenue</TableHead>
                <TableHead className="text-right">AI Cost (30d)</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
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
                  <TableCell className={`text-right font-medium ${item.margin >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatCurrency(item.margin)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${item.margin >= 0 ? "text-green-500" : "text-red-500"}`}>
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

      {/* Customer Profitability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Profitability</CardTitle>
          <CardDescription>Top 20 most expensive users by AI cost (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.customerProfitability.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">AI Cost</TableHead>
                  <TableHead className="text-right">Profit / Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customerProfitability.map((user) => (
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
                    <TableCell className={`text-right font-semibold ${user.profitability >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {formatCurrency(user.profitability)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No AI usage data in the last 30 days</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
