import { db } from "@/lib/db";
import { users, aiLogs } from "@/lib/db/schema";
import { count, desc, sql, gte, and, lt, eq } from "drizzle-orm";
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
import { ArrowLeft, DollarSign, Users, TrendingUp, TrendingDown, Minus, AlertTriangle, UserMinus, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

async function getDetailedBusinessMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Subscription breakdown with Polar data
  // NOTE: Admin users (isAdmin=true) are excluded from all counts to avoid inflating metrics
  const notAdmin = eq(users.isAdmin, false);
  const [currentSubs, paidUsersRaw, lastMonthSubs, monthlySignups, dailySignups] = await Promise.all([
    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .where(notAdmin)
    .groupBy(users.subscriptionStatus),

    // Fetch per-user billing period data to detect annual vs monthly billing
    db.select({
      status: users.subscriptionStatus,
      currentPeriodStart: users.currentPeriodStart,
      currentPeriodEnd: users.currentPeriodEnd,
    })
    .from(users)
    .where(and(sql`${users.polarSubscriptionId} IS NOT NULL`, notAdmin)),

    // NOTE: lastMonthSubs uses current subscription status for historical comparison.
    // This is fundamentally imprecise -- users may have changed plans since last month.
    // The MRR change derived from this is therefore approximate.
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

  // Compute billing-aware MRR: detect annual billing when period span > 60 days
  const ANNUAL_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000; // 60 days in ms
  const proAnnualMonthly = PLANS.pro.annualPrice / 12;     // $290/12 = ~$24.17
  const teamAnnualMonthly = PLANS.team.annualPrice / 12; // $990/12 = $82.50

  let paidProUsers = 0;
  let paidTeamUsers = 0;
  let billingAwareMrr = 0;

  for (const user of paidUsersRaw) {
    const isAnnual =
      user.currentPeriodStart &&
      user.currentPeriodEnd &&
      (new Date(user.currentPeriodEnd).getTime() - new Date(user.currentPeriodStart).getTime()) > ANNUAL_THRESHOLD_MS;

    if (user.status === "pro") {
      paidProUsers++;
      billingAwareMrr += isAnnual ? proAnnualMonthly : PLANS.pro.price;
    } else if (user.status === "team") {
      paidTeamUsers++;
      billingAwareMrr += isAnnual ? teamAnnualMonthly : PLANS.team.price;
    }
  }

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

  // --- DAU/WAU/MAU from lastActiveAt ---
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [dauResult, wauResult, mauResult] = await Promise.all([
    db.select({ count: count() }).from(users).where(gte(users.lastActiveAt, oneDayAgo)),
    db.select({ count: count() }).from(users).where(gte(users.lastActiveAt, sevenDaysAgo)),
    db.select({ count: count() }).from(users).where(gte(users.lastActiveAt, thirtyDaysAgo)),
  ]);

  const dau = dauResult[0]?.count || 0;
  const wau = wauResult[0]?.count || 0;
  const mau = mauResult[0]?.count || 0;
  const dauMauRatio = mau > 0 ? (dau / mau) * 100 : 0;

  // --- Churn & Retention ---
  const thirtyDaysAgoForChurn = new Date();
  thirtyDaysAgoForChurn.setDate(thirtyDaysAgoForChurn.getDate() - 30);

  const [churnedUsersResult, atRiskUsersResult] = await Promise.all([
    // Churned: had a Polar subscription but now on free plan
    db.select({ count: count() }).from(users).where(
      and(
        sql`${users.polarSubscriptionId} IS NOT NULL`,
        eq(users.subscriptionStatus, "free")
      )
    ),
    // At-risk: paid users inactive for 30+ days
    db.select({ count: count() }).from(users).where(
      and(
        sql`${users.subscriptionStatus} IN ('pro', 'team')`,
        sql`${users.polarSubscriptionId} IS NOT NULL`,
        sql`(${users.lastActiveAt} IS NULL OR ${users.lastActiveAt} < ${thirtyDaysAgoForChurn})`
      )
    ),
  ]);

  const churnedUsers = churnedUsersResult[0]?.count || 0;
  const atRiskUsers = atRiskUsersResult[0]?.count || 0;

  // Active AI usage (for existing activeUsers metric)
  const activeUsers30d = await db
    .select({
      count: count(sql`DISTINCT ${aiLogs.userId}`),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, thirtyDaysAgo));

  // Calculate metrics
  const currentFreeUsers = currentSubs.find(s => s.status === "free")?.count || 0;
  const currentProUsers = currentSubs.find(s => s.status === "pro")?.count || 0;
  const currentTeamUsers = currentSubs.find(s => s.status === "team")?.count || 0;
  const totalUsers = currentProUsers + currentTeamUsers + currentFreeUsers;

  // Use billing-aware MRR that accounts for annual vs monthly billing intervals
  const mrr = billingAwareMrr;

  // Last month comparison uses flat monthly prices since we lack historical billing data.
  // This makes the MRR change percentage approximate.
  const lastMonthPaidProUsers = lastMonthSubs.find(s => s.status === "pro")?.count || 0;
  const lastMonthPaidTeamUsers = lastMonthSubs.find(s => s.status === "team")?.count || 0;
  const lastMonthMrr = (lastMonthPaidProUsers * PLANS.pro.price) + (lastMonthPaidTeamUsers * PLANS.team.price);

  const mrrChange = lastMonthMrr > 0 ? ((mrr - lastMonthMrr) / lastMonthMrr) * 100 : 0;
  const arr = mrr * 12;
  const avgRevenuePerUser = totalUsers > 0 ? mrr / totalUsers : 0;
  const totalPaidUsers = paidProUsers + paidTeamUsers;
  const paidUserPercentage = totalUsers > 0 ? (totalPaidUsers / totalUsers) * 100 : 0;
  const proConversions = paidProUsers - lastMonthPaidProUsers;
  const teamConversions = paidTeamUsers - lastMonthPaidTeamUsers;
  const conversionRate = totalUsers > 0 ? (totalPaidUsers / totalUsers) * 100 : 0;

  return {
    mrr,
    mrrChange,
    arr,
    avgRevenuePerUser,
    paidUserPercentage,
    conversionRate,
    proConversions: Math.max(0, proConversions),
    teamConversions: Math.max(0, teamConversions),
    monthlySignups: monthlySignups[0]?.count || 0,
    subscriptionBreakdown: {
      free: currentFreeUsers,
      pro: currentProUsers,
      team: currentTeamUsers,
      total: totalUsers,
      paidPro: paidProUsers,
      paidTeam: paidTeamUsers,
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
    dau,
    wau,
    mau,
    dauMauRatio,
    churnedUsers,
    atRiskUsers,
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
    case "team":
      return <Badge className="bg-amber-500 text-white">Team</Badge>;
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
              ~{data.mrrChange > 0 ? "+" : ""}{formatPercent(data.mrrChange)} from last month (approx)
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
            <CardTitle className="text-sm font-medium">ARPU (All Users)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.avgRevenuePerUser)}</div>
            <p className="text-xs text-muted-foreground">Includes free users in denominator</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LTV (Est.)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.ltv)}</div>
            <p className="text-xs text-muted-foreground">ARPU x 12 months</p>
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
                  style={{ width: `${data.subscriptionBreakdown.total > 0 ? (data.subscriptionBreakdown.free / data.subscriptionBreakdown.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPercent(data.subscriptionBreakdown.total > 0 ? (data.subscriptionBreakdown.free / data.subscriptionBreakdown.total) * 100 : 0)} of total
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
                  style={{ width: `${data.subscriptionBreakdown.total > 0 ? (data.subscriptionBreakdown.pro / data.subscriptionBreakdown.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(PLANS.pro.price)}/mo × {data.subscriptionBreakdown.paidPro} = {formatCurrency(data.subscriptionBreakdown.paidPro * PLANS.pro.price)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Team Users</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-amber-500">{data.subscriptionBreakdown.team}</span>
                  <span className="text-xs text-muted-foreground ml-2">({data.subscriptionBreakdown.paidTeam} paid)</span>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-amber-500"
                  style={{ width: `${data.subscriptionBreakdown.total > 0 ? (data.subscriptionBreakdown.team / data.subscriptionBreakdown.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(PLANS.team.price)}/mo × {data.subscriptionBreakdown.paidTeam} = {formatCurrency(data.subscriptionBreakdown.paidTeam * PLANS.team.price)}
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
            <CardDescription>Net change in paid users vs. new signups this month</CardDescription>
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
                    <span className="text-sm font-medium">Net New Pro</span>
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
                    <span className="text-sm font-medium">Net New Team</span>
                    <span className="text-sm text-muted-foreground">
                      {data.teamConversions} ({data.monthlySignups > 0 ? ((data.teamConversions / data.monthlySignups) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div
                    className="h-3 bg-amber-500 rounded-full"
                    style={{ width: `${data.monthlySignups > 0 ? (data.teamConversions / data.monthlySignups) * 100 : 0}%` }}
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
                      {data.subscriptionBreakdown.paidPro + data.subscriptionBreakdown.paidTeam} paid / {data.subscriptionBreakdown.total} total
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
          <CardTitle className="text-lg">Recent Paid Users</CardTitle>
          <CardDescription>Users with Polar subscriptions updated in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentConversions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Last Updated</TableHead>
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

      {/* Active Users (DAU/WAU/MAU) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <CardTitle className="text-lg">Active Users</CardTitle>
          </div>
          <CardDescription>Based on last meaningful activity (dashboard visit, monitor action)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">DAU (24h)</p>
              <p className="mt-1 text-2xl font-bold">{data.dau}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">WAU (7d)</p>
              <p className="mt-1 text-2xl font-bold">{data.wau}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">MAU (30d)</p>
              <p className="mt-1 text-2xl font-bold">{data.mau}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">DAU/MAU Ratio</p>
              <p className={`mt-1 text-2xl font-bold ${data.dauMauRatio >= 20 ? "text-green-500" : data.dauMauRatio >= 10 ? "text-amber-500" : "text-red-500"}`}>
                {formatPercent(data.dauMauRatio)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Healthy SaaS: 20-50%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Churn & Retention */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-red-400" />
            <CardTitle className="text-lg">Churn & Retention</CardTitle>
          </div>
          <CardDescription>Churned users (had subscription, now free) and at-risk paid users (inactive 30+ days)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <UserMinus className="h-4 w-4 text-red-500" />
                <p className="text-sm text-muted-foreground">Churned Users</p>
              </div>
              <p className={`mt-1 text-2xl font-bold ${data.churnedUsers > 0 ? "text-red-500" : "text-green-500"}`}>
                {data.churnedUsers}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Had Polar subscription, now on free plan
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-muted-foreground">At-Risk Paid Users</p>
              </div>
              <p className={`mt-1 text-2xl font-bold ${data.atRiskUsers > 0 ? "text-amber-500" : "text-green-500"}`}>
                {data.atRiskUsers}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Paid users with no activity in 30+ days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
