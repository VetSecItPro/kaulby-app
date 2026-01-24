import { db } from "@/lib/db";
import { users, aiLogs } from "@/lib/db/schema";
import { count, sum, desc, sql, gte, eq } from "drizzle-orm";
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
import { ArrowLeft, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getAllUserCosts() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // All users by cost
  const usersCostQuery = await db
    .select({
      userId: aiLogs.userId,
      email: users.email,
      name: users.name,
      plan: users.subscriptionStatus,
      totalCost: sum(aiLogs.costUsd),
      aiCalls: count(),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
      promptTokens: sum(aiLogs.promptTokens),
      completionTokens: sum(aiLogs.completionTokens),
      avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
      firstCall: sql<Date>`MIN(${aiLogs.createdAt})`,
      lastCall: sql<Date>`MAX(${aiLogs.createdAt})`,
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiLogs.userId, users.email, users.name, users.subscriptionStatus)
    .orderBy(desc(sum(aiLogs.costUsd)));

  // Summary
  const summary = await db
    .select({
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
      userCount: count(sql`DISTINCT ${aiLogs.userId}`),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, thirtyDaysAgo));

  return {
    users: usersCostQuery.map((user) => ({
      userId: user.userId || "",
      email: user.email,
      name: user.name,
      plan: user.plan || "free",
      totalCost: Number(user.totalCost) || 0,
      aiCalls: Number(user.aiCalls) || 0,
      totalTokens: Number(user.totalTokens) || 0,
      promptTokens: Number(user.promptTokens) || 0,
      completionTokens: Number(user.completionTokens) || 0,
      avgLatency: Number(user.avgLatency) || 0,
      firstCall: user.firstCall,
      lastCall: user.lastCall,
    })),
    summary: {
      totalCost: Number(summary[0]?.totalCost) || 0,
      totalCalls: Number(summary[0]?.totalCalls) || 0,
      userCount: Number(summary[0]?.userCount) || 0,
    },
  };
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

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export default async function UsersAICostPage() {
  const data = await getAllUserCosts();

  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage/costs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User AI Costs</h1>
            <p className="text-muted-foreground">Complete list of users and their AI usage (last 30 days)</p>
          </div>
        </div>
        <Badge variant="outline">All Users</Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.userCount}</div>
            <p className="text-xs text-muted-foreground">Users with AI activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost / User</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary.userCount > 0 ? data.summary.totalCost / data.summary.userCount : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all active users</p>
          </CardContent>
        </Card>
      </div>

      {/* All Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Users by AI Cost</CardTitle>
          <CardDescription>
            {data.users.length} users with AI activity in the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">API Calls</TableHead>
                  <TableHead className="text-right">Prompt Tokens</TableHead>
                  <TableHead className="text-right">Completion Tokens</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Last Activity</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user, index) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-6">#{index + 1}</span>
                        <div>
                          <p className="font-medium">{user.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(user.plan)}</TableCell>
                    <TableCell className="text-right">{formatNumber(user.aiCalls)}</TableCell>
                    <TableCell className="text-right">{formatNumber(user.promptTokens)}</TableCell>
                    <TableCell className="text-right">{formatNumber(user.completionTokens)}</TableCell>
                    <TableCell className="text-right">{user.avgLatency.toFixed(0)}ms</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDate(user.lastCall)}
                    </TableCell>
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
    </div>
  );
}
