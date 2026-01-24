import { db } from "@/lib/db";
import { users, aiLogs } from "@/lib/db/schema";
import { count, desc, sql, gte, and, lt } from "drizzle-orm";
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
import { ArrowLeft, DollarSign, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

async function getDetailedBusinessMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Subscription breakdown with Polar data
  const [currentSubs, paidUsers, lastMonthSubs, monthlySignups, dailySignups] = await Promise.all([
    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .groupBy(users.subscriptionStatus),

    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .where(sql`${users.polarSubscriptionId} IS NOT NULL`)
    .groupBy(users.subscriptionStatus),

    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .where(
      and(
        lt(users.createdAt, startOfMonth),
        sql`${users.polarSubscriptionId} IS NOT NULL`
      )
    )
    .groupBy(users.subscriptionStatus),

    db.select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, startOfMonth)),

    db.select({
      date: sql<string>`DATE(${users.createdAt})`,
      count: count(),
    })
    .from(users)
    .where(gte(users.createdAt, thirtyDaysAgo))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`),
  ]);

  // Recent conversions (users who upgraded)
  const recentConversions = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: users.subscriptionStatus,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(
      and(
        sql`${users.polarSubscriptionId} IS NOT NULL`,
        gte(users.updatedAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(users.updatedAt))
    .limit(20);

  // Churn data (approximate - users who haven't been active)
  const activeUsers30d = await db
    .select({
      count: count(sql`DISTINCT ${aiLogs.userId}`),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, thirtyDaysAgo));

  // Calculate metrics
  const paidProUsers = paidUsers.find(s => s.status === "pro")?.count || 0;
  const paidEnterpriseUsers = paidUsers.find(s => s.status === "enterprise")?.count || 0;
  const currentFreeUsers = currentSubs.find(s => s.status === "free")?.count || 0;
  const currentProUsers = currentSubs.find(s => s.status === "pro")?.count || 0;
  const currentEnterpriseUsers = currentSubs.find(s => s.status === "enterprise")?.count || 0;
  const totalUsers = currentProUsers + currentEnterpriseUsers + currentFreeUsers;

  const mrr = (paidProUsers * PLANS.pro.price) + (paidEnterpriseUsers * PLANS.enterprise.price);

  const lastMonthPaidProUsers = lastMonthSubs.find(s => s.status === "pro")?.count || 0;
  const lastMonthPaidEnterpriseUsers = lastMonthSubs.find(s => s.status === "enterprise")?.count || 0;
  const lastMonthMrr = (lastMonthPaidProUsers * PLANS.pro.price) + (lastMonthPaidEnterpriseUsers * PLANS.enterprise.price);

  const mrrChange = lastMonthMrr > 0 ? ((mrr - lastMonthMrr) / lastMonthMrr) * 100 : (mrr > 0 ? 100 : 0);
  const arr = mrr * 12;
  const avgRevenuePerUser = totalUsers > 0 ? mrr / totalUsers : 0;
  const totalPaidUsers = paidProUsers + paidEnterpriseUsers;
  const paidUserPercentage = totalUsers > 0 ? (totalPaidUsers / totalUsers) * 100 : 0;
  const proConversions = paidProUsers - lastMonthPaidProUsers;
  const enterpriseConversions = paidEnterpriseUsers - lastMonthPaidEnterpriseUsers;
  const conversionRate = totalUsers > 0 ? (totalPaidUsers / totalUsers) * 100 : 0;

  return {
    mrr,
    mrrChange,
    arr,
    avgRevenuePerUser,
    paidUserPercentage,
    conversionRate,
    proConversions: Math.max(0, proConversions),
    enterpriseConversions: Math.max(0, enterpriseConversions),
    monthlySignups: monthlySignups[0]?.count || 0,
    subscriptionBreakdown: {
      free: currentFreeUsers,
      pro: currentProUsers,
      enterprise: currentEnterpriseUsers,
      total: totalUsers,
      paidPro: paidProUsers,
      paidEnterprise: paidEnterpriseUsers,
    },
    dailySignups: dailySignups.map(d => ({
      date: d.date,
      count: d.count,
    })),
    recentConversions: recentConversions.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    activeUsers: activeUsers30d[0]?.count || 0,
    ltv: avgRevenuePerUser * 12, // Simplified LTV calculation
  };
}

function formatCurrency(value: number, decimals = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTrendIcon(change: number) {
  if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function getTrendColor(change: number) {
  if (change > 0) return "text-green-500";
  if (change < 0) return "text-red-500";
  return "text-muted-foreground";
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

export default async function BusinessMetricsPage() {
  const data = await getDetailedBusinessMetrics();

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
            <h1 className="text-3xl font-bold tracking-tight">Business Metrics</h1>
            <p className="text-muted-foreground">Revenue, conversions, and growth analytics</p>
          </div>
        </div>
        <Badge variant="outline">Last 30 days</Badge>
      </div>

      {/* Primary Revenue Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.mrr)}</div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(data.mrrChange)}`}>
              {getTrendIcon(data.mrrChange)}
              {data.mrrChange > 0 ? "+" : ""}{formatPercent(data.mrrChange)} from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.arr)}</div>
            <p className="text-xs text-muted-foreground">Projected annual revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.avgRevenuePerUser)}</div>
            <p className="text-xs text-muted-foreground">Avg revenue per user</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LTV (Est.)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.ltv)}</div>
            <p className="text-xs text-muted-foreground">Lifetime value estimate</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subscription Breakdown</CardTitle>
          <CardDescription>Current user distribution by plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Free Users</span>
                <span className="text-2xl font-bold">{data.subscriptionBreakdown.free}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-muted-foreground/50"
                  style={{ width: `${(data.subscriptionBreakdown.free / data.subscriptionBreakdown.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPercent((data.subscriptionBreakdown.free / data.subscriptionBreakdown.total) * 100)} of total
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pro Users</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-primary">{data.subscriptionBreakdown.pro}</span>
                  <span className="text-xs text-muted-foreground ml-2">({data.subscriptionBreakdown.paidPro} paid)</span>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-primary"
                  style={{ width: `${(data.subscriptionBreakdown.pro / data.subscriptionBreakdown.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(PLANS.pro.price)}/mo × {data.subscriptionBreakdown.paidPro} = {formatCurrency(data.subscriptionBreakdown.paidPro * PLANS.pro.price)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enterprise Users</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-amber-500">{data.subscriptionBreakdown.enterprise}</span>
                  <span className="text-xs text-muted-foreground ml-2">({data.subscriptionBreakdown.paidEnterprise} paid)</span>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-amber-500"
                  style={{ width: `${(data.subscriptionBreakdown.enterprise / data.subscriptionBreakdown.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(PLANS.enterprise.price)}/mo × {data.subscriptionBreakdown.paidEnterprise} = {formatCurrency(data.subscriptionBreakdown.paidEnterprise * PLANS.enterprise.price)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversion Funnel</CardTitle>
            <CardDescription>User journey from signup to paid</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Monthly Signups</span>
                    <span className="text-sm text-muted-foreground">{data.monthlySignups}</span>
                  </div>
                  <div className="h-3 bg-primary rounded-full" style={{ width: "100%" }} />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Pro Conversions</span>
                    <span className="text-sm text-muted-foreground">
                      {data.proConversions} ({data.monthlySignups > 0 ? ((data.proConversions / data.monthlySignups) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div
                    className="h-3 bg-blue-500 rounded-full"
                    style={{ width: `${data.monthlySignups > 0 ? (data.proConversions / data.monthlySignups) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Enterprise Conversions</span>
                    <span className="text-sm text-muted-foreground">
                      {data.enterpriseConversions} ({data.monthlySignups > 0 ? ((data.enterpriseConversions / data.monthlySignups) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div
                    className="h-3 bg-amber-500 rounded-full"
                    style={{ width: `${data.monthlySignups > 0 ? (data.enterpriseConversions / data.monthlySignups) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Overall Conversion Rate</p>
                    <p className="text-xs text-muted-foreground">Free to any paid plan</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatPercent(data.conversionRate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.subscriptionBreakdown.paidPro + data.subscriptionBreakdown.paidEnterprise} paid / {data.subscriptionBreakdown.total} total
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Metrics</CardTitle>
            <CardDescription>Health indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Paid User %</p>
                  <p className="text-xs text-muted-foreground">Users who pay via Polar</p>
                </div>
                <p className="text-2xl font-bold">{formatPercent(data.paidUserPercentage)}</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Active Users (30d)</p>
                  <p className="text-xs text-muted-foreground">Users with AI activity</p>
                </div>
                <p className="text-2xl font-bold">{data.activeUsers}</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Monthly Signups</p>
                  <p className="text-xs text-muted-foreground">New users this month</p>
                </div>
                <p className="text-2xl font-bold">{data.monthlySignups}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Conversions</CardTitle>
          <CardDescription>Users who upgraded to a paid plan (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentConversions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Upgraded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentConversions.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(user.status)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(user.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No recent conversions</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
