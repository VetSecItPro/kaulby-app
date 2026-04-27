import { db } from "@/lib/db";
import { monitors, users, results } from "@/lib/db/schema";
import { count, desc, sql, eq, and, inArray } from "drizzle-orm";
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
import { ArrowLeft, Radio, Activity, AlertCircle, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlatformDisplayName } from "@/lib/platform-utils";

export const dynamic = "force-dynamic";

async function getMonitorStats() {
  // All monitors with user info and result counts
  const allMonitors = await db
    .select({
      id: monitors.id,
      name: monitors.name,
      keywords: monitors.keywords,
      platforms: monitors.platforms,
      isActive: monitors.isActive,
      createdAt: monitors.createdAt,
      lastCheckedAt: monitors.lastCheckedAt,
      userId: monitors.userId,
      userEmail: users.email,
      userName: users.name,
      userPlan: users.subscriptionStatus,
    })
    .from(monitors)
    .leftJoin(users, eq(monitors.userId, users.id))
    .orderBy(desc(monitors.createdAt))
    // PERF: Limit admin query to prevent full table scan - FIX-007
    .limit(500);

  // Result counts per monitor (only for the monitors we fetched)
  const monitorIds = allMonitors.map(m => m.id);
  const resultCounts = monitorIds.length > 0
    ? await db
        .select({
          monitorId: results.monitorId,
          count: count(),
        })
        .from(results)
        .where(inArray(results.monitorId, monitorIds))
        .groupBy(results.monitorId)
    : [];

  const resultCountMap = new Map(resultCounts.map((r) => [r.monitorId, r.count]));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Summary stats
  const [totalCount, totalActive, totalInactive, byPlatform, byPlan, uniqueUserCount, stuckMonitors, typeDistribution, scheduleAdoption] = await Promise.all([
    db.select({ count: count() }).from(monitors),
    db.select({ count: count() }).from(monitors).where(sql`${monitors.isActive} = true`),
    db.select({ count: count() }).from(monitors).where(sql`${monitors.isActive} = false`),
    db
      .select({
        platform: sql<string>`unnest(${monitors.platforms})`,
        count: count(),
      })
      .from(monitors)
      .groupBy(sql`unnest(${monitors.platforms})`)
      .orderBy(desc(count())),
    db
      .select({
        plan: users.subscriptionStatus,
        count: count(),
      })
      .from(monitors)
      .leftJoin(users, eq(monitors.userId, users.id))
      .groupBy(users.subscriptionStatus),
    db.select({ count: sql<number>`COUNT(DISTINCT ${monitors.userId})` }).from(monitors),
    // Stuck monitors: active but not checked in 7+ days (or never checked)
    db
      .select({
        id: monitors.id,
        name: monitors.name,
        lastCheckedAt: monitors.lastCheckedAt,
        userEmail: users.email,
        userId: monitors.userId,
      })
      .from(monitors)
      .leftJoin(users, eq(monitors.userId, users.id))
      .where(
        and(
          eq(monitors.isActive, true),
          sql`(${monitors.lastCheckedAt} IS NULL OR ${monitors.lastCheckedAt} < ${sevenDaysAgo})`
        )
      )
      .orderBy(monitors.lastCheckedAt)
      .limit(50),
    // Monitor type distribution
    db
      .select({
        monitorType: monitors.monitorType,
        count: count(),
      })
      .from(monitors)
      .groupBy(monitors.monitorType),
    // Schedule adoption among active monitors
    db
      .select({
        total: count(),
        scheduled: sql<number>`COUNT(*) FILTER (WHERE ${monitors.scheduleEnabled} = true)`,
      })
      .from(monitors)
      .where(eq(monitors.isActive, true)),
  ]);

  const scheduleData = scheduleAdoption[0] || { total: 0, scheduled: 0 };

  return {
    monitors: allMonitors.map((m) => ({
      ...m,
      resultCount: resultCountMap.get(m.id) || 0,
    })),
    summary: {
      total: totalCount[0]?.count || 0,
      active: totalActive[0]?.count || 0,
      inactive: totalInactive[0]?.count || 0,
    },
    byPlatform: byPlatform.map((p) => ({
      platform: p.platform,
      count: p.count,
    })),
    byPlan: byPlan.map((p) => ({
      plan: p.plan || "free",
      count: p.count,
    })),
    uniqueUsers: uniqueUserCount[0]?.count || 0,
    stuckMonitors: stuckMonitors.map((m) => ({
      id: m.id,
      name: m.name,
      lastCheckedAt: m.lastCheckedAt,
      userEmail: m.userEmail,
    })),
    stuckCount: stuckMonitors.length,
    typeDistribution: typeDistribution.map((t) => ({
      type: t.monitorType,
      count: t.count,
    })),
    scheduleAdoption: {
      total: scheduleData.total,
      scheduled: Number(scheduleData.scheduled),
      rate: scheduleData.total > 0 ? (Number(scheduleData.scheduled) / scheduleData.total) * 100 : 0,
    },
  };
}

function formatDate(date: Date | null) {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPlanBadge(plan: string | null) {
  switch (plan) {
    case "growth":
      return <Badge className="bg-amber-500 text-white">Growth</Badge>;
    case "scale":
      return <Badge className="bg-purple-500 text-white">Scale</Badge>;
    case "solo":
      return <Badge className="bg-primary text-primary-foreground">Solo</Badge>;
    default:
      return <Badge variant="secondary">Free</Badge>;
  }
}

export default async function MonitorsPage() {
  const data = await getMonitorStats();

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
            <h1 className="text-3xl font-bold tracking-tight">All Monitors</h1>
            <p className="text-muted-foreground">Platform-wide monitor management</p>
          </div>
        </div>
        <Badge variant="outline">{data.summary.total} Total</Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Monitors</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{data.summary.active}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.total > 0 ? ((data.summary.active / data.summary.total) * 100).toFixed(1) : "0.0"}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Monitors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.inactive}</div>
            <p className="text-xs text-muted-foreground">Paused or disabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Monitors/User</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.uniqueUsers > 0 ? (data.summary.total / data.uniqueUsers).toFixed(1) : "0.0"}
            </div>
            <p className="text-xs text-muted-foreground">Per active user</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stuck Monitors</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${data.stuckCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.stuckCount > 0 ? "text-amber-500" : ""}`}>{data.stuckCount}</div>
            <p className="text-xs text-muted-foreground">No scan in 7+ days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monitor Types</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {data.typeDistribution.map((t) => (
                <div key={t.type} className="flex justify-between">
                  <span className="capitalize text-xs">{t.type.replace(/_/g, " ")}</span>
                  <span className="text-xs font-medium">{t.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule Adoption</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.scheduleAdoption.rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {data.scheduleAdoption.scheduled}/{data.scheduleAdoption.total} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stuck Monitors Warning */}
      {data.stuckMonitors.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Stuck Monitors
            </CardTitle>
            <CardDescription>Active monitors that haven&apos;t been scanned in 7+ days</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monitor</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Last Scanned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stuckMonitors.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.userEmail || "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {m.lastCheckedAt ? formatDate(m.lastCheckedAt) : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Platform</CardTitle>
            <CardDescription>Monitor distribution across platforms (monitors can appear in multiple platforms)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const totalPlatformCount = data.byPlatform.reduce((sum, p) => sum + p.count, 0);
                return data.byPlatform.slice(0, 8).map((p) => {
                const percentage = totalPlatformCount > 0 ? (p.count / totalPlatformCount) * 100 : 0;
                return (
                  <div key={p.platform} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{getPlatformDisplayName(p.platform)}</span>
                      <span className="text-muted-foreground">
                        {p.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By User Plan</CardTitle>
            <CardDescription>Monitor distribution by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.byPlan.map((p) => {
                const percentage = data.summary.total > 0 ? (p.count / data.summary.total) * 100 : 0;
                return (
                  <div key={p.plan} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{p.plan}</span>
                      <span className="text-muted-foreground">
                        {p.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${
                          p.plan === "growth" ? "bg-amber-500" :
                          p.plan === "solo" ? "bg-primary" : "bg-muted-foreground"
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
      </div>

      {/* All Monitors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Monitors</CardTitle>
          <CardDescription>Showing {Math.min(50, data.monitors.length)} of {data.summary.total} total monitors</CardDescription>
        </CardHeader>
        <CardContent>
          {data.monitors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monitor</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Results</TableHead>
                  <TableHead className="text-right">Last Scanned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.monitors.slice(0, 50).map((monitor) => (
                  <TableRow key={monitor.id}>
                    <TableCell>
                      <p className="font-medium">{monitor.name}</p>
                      <p className="text-xs text-muted-foreground">{monitor.id.slice(0, 8)}...</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm">{monitor.userName || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{monitor.userEmail}</p>
                        </div>
                        {getPlanBadge(monitor.userPlan)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(monitor.keywords || []).slice(0, 3).map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                        {(monitor.keywords || []).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{(monitor.keywords || []).length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(monitor.platforms || []).slice(0, 2).map((p, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {getPlatformDisplayName(p)}
                          </Badge>
                        ))}
                        {(monitor.platforms || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(monitor.platforms || []).length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {monitor.isActive ? (
                        <Badge className="bg-green-500/10 text-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {monitor.resultCount}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDate(monitor.lastCheckedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No monitors found</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
