import { db } from "@/lib/db";
import { webhooks, webhookDeliveries, apiKeys, users, workspaces, workspaceInvites } from "@/lib/db/schema";
import { count, sql, gte, eq, and, desc, sum, isNull } from "drizzle-orm";
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
import { ArrowLeft, Webhook, Key, Users as UsersIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getIntegrationsData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [
    webhookCounts,
    deliveryStats,
    httpErrors,
    recentFailures,
    apiKeyCounts,
    apiKeyUsage,
    expiringKeys,
    workspaceData,
    inviteStats,
  ] = await Promise.all([
    // Webhook counts
    db
      .select({
        total: count(),
        active: sql<number>`COUNT(*) FILTER (WHERE ${webhooks.isActive} = true)`,
      })
      .from(webhooks),

    // Delivery stats (last 30d)
    db
      .select({
        total: count(),
        success: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'success')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'failed')`,
        retrying: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'retrying')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'pending')`,
      })
      .from(webhookDeliveries)
      .where(gte(webhookDeliveries.createdAt, thirtyDaysAgo)),

    // HTTP error distribution
    db
      .select({
        statusCode: webhookDeliveries.statusCode,
        count: count(),
      })
      .from(webhookDeliveries)
      .where(
        and(
          gte(webhookDeliveries.createdAt, thirtyDaysAgo),
          eq(webhookDeliveries.status, "failed")
        )
      )
      .groupBy(webhookDeliveries.statusCode),

    // Recent failures (20 most recent)
    db
      .select({
        id: webhookDeliveries.id,
        eventType: webhookDeliveries.eventType,
        statusCode: webhookDeliveries.statusCode,
        errorMessage: webhookDeliveries.errorMessage,
        attemptCount: webhookDeliveries.attemptCount,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, "failed"))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(20),

    // API key counts
    db
      .select({
        total: count(),
        active: sql<number>`COUNT(*) FILTER (WHERE ${apiKeys.isActive} = true AND ${apiKeys.revokedAt} IS NULL)`,
        revoked: sql<number>`COUNT(*) FILTER (WHERE ${apiKeys.revokedAt} IS NOT NULL)`,
        totalRequests: sum(apiKeys.requestCount),
      })
      .from(apiKeys),

    // Top API keys by usage
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        userId: apiKeys.userId,
        requestCount: apiKeys.requestCount,
        dailyRequestCount: apiKeys.dailyRequestCount,
        lastUsedAt: apiKeys.lastUsedAt,
        isActive: apiKeys.isActive,
        revokedAt: apiKeys.revokedAt,
        expiresAt: apiKeys.expiresAt,
        userEmail: users.email,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.userId, users.id))
      .orderBy(desc(apiKeys.requestCount))
      .limit(20),

    // Keys expiring within 7 days
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        expiresAt: apiKeys.expiresAt,
        userEmail: users.email,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.userId, users.id))
      .where(
        and(
          eq(apiKeys.isActive, true),
          isNull(apiKeys.revokedAt),
          sql`${apiKeys.expiresAt} IS NOT NULL AND ${apiKeys.expiresAt} <= ${sevenDaysFromNow}`
        )
      ),

    // Workspace seat data
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        seatLimit: workspaces.seatLimit,
        seatCount: workspaces.seatCount,
      })
      .from(workspaces),

    // Invite stats
    db
      .select({
        status: workspaceInvites.status,
        count: count(),
      })
      .from(workspaceInvites)
      .groupBy(workspaceInvites.status),
  ]);

  const wh = webhookCounts[0] || { total: 0, active: 0 };
  const del = deliveryStats[0] || { total: 0, success: 0, failed: 0, retrying: 0, pending: 0 };
  const ak = apiKeyCounts[0] || { total: 0, active: 0, revoked: 0, totalRequests: 0 };

  const totalSeats = workspaceData.reduce((s, w) => s + w.seatLimit, 0);
  const usedSeats = workspaceData.reduce((s, w) => s + w.seatCount, 0);

  const pendingInvites = inviteStats.find((i) => i.status === "pending")?.count || 0;
  const acceptedInvites = inviteStats.find((i) => i.status === "accepted")?.count || 0;
  const expiredInvites = inviteStats.find((i) => i.status === "expired")?.count || 0;
  const totalInvites = pendingInvites + acceptedInvites + expiredInvites;

  return {
    webhooks: {
      total: wh.total,
      active: Number(wh.active),
    },
    deliveries: {
      total: Number(del.total),
      success: Number(del.success),
      failed: Number(del.failed),
      retrying: Number(del.retrying),
      pending: Number(del.pending),
    },
    httpErrors: httpErrors
      .filter((e) => e.statusCode !== null)
      .map((e) => ({ statusCode: e.statusCode!, count: e.count }))
      .sort((a, b) => b.count - a.count),
    recentFailures: recentFailures.map((f) => ({
      id: f.id,
      eventType: f.eventType,
      statusCode: f.statusCode,
      error: f.errorMessage || "Unknown error",
      attempts: f.attemptCount,
      createdAt: f.createdAt,
    })),
    apiKeys: {
      total: ak.total,
      active: Number(ak.active),
      revoked: Number(ak.revoked),
      totalRequests: Number(ak.totalRequests) || 0,
    },
    apiKeyUsage: apiKeyUsage.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      email: k.userEmail,
      totalRequests: k.requestCount,
      dailyRequests: k.dailyRequestCount,
      lastUsed: k.lastUsedAt,
      status: k.revokedAt ? "revoked" : k.isActive ? "active" : "inactive",
      expiresAt: k.expiresAt,
    })),
    expiringKeys: expiringKeys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      email: k.userEmail,
      expiresAt: k.expiresAt!,
    })),
    seats: {
      totalSeats,
      usedSeats,
      workspaces: workspaceData,
    },
    invites: {
      pending: pendingInvites,
      accepted: acceptedInvites,
      expired: expiredInvites,
      total: totalInvites,
      acceptanceRate: totalInvites > 0 ? (acceptedInvites / totalInvites) * 100 : 0,
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

export default async function IntegrationsPage() {
  const data = await getIntegrationsData();
  const { deliveries, apiKeys: ak, seats } = data;

  const successRate = deliveries.total > 0
    ? ((deliveries.success / deliveries.total) * 100).toFixed(1)
    : "0.0";

  const seatUtilization = seats.totalSeats > 0
    ? ((seats.usedSeats / seats.totalSeats) * 100).toFixed(1)
    : "0.0";

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
            <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground">Webhooks, API keys, and workspace management</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.webhooks.active}</div>
            <p className="text-xs text-muted-foreground">{data.webhooks.total} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Webhook className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${Number(successRate) >= 95 ? "text-green-500" : Number(successRate) >= 80 ? "text-amber-500" : "text-red-500"}`}>
              {successRate}%
            </div>
            <p className="text-xs text-muted-foreground">{deliveries.total.toLocaleString()} deliveries (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ak.active}</div>
            <p className="text-xs text-muted-foreground">{ak.totalRequests.toLocaleString()} total requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seat Utilization</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{seatUtilization}%</div>
            <p className="text-xs text-muted-foreground">{seats.usedSeats}/{seats.totalSeats} seats</p>
          </CardContent>
        </Card>
      </div>

      {/* Webhook Delivery Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook Delivery Health</CardTitle>
          <CardDescription>Delivery status breakdown (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              { label: "Success", value: deliveries.success, color: "bg-green-500" },
              { label: "Failed", value: deliveries.failed, color: "bg-red-500" },
              { label: "Retrying", value: deliveries.retrying, color: "bg-amber-500" },
              { label: "Pending", value: deliveries.pending, color: "bg-muted-foreground" },
            ].map((s) => {
              const pct = deliveries.total > 0 ? (s.value / deliveries.total) * 100 : 0;
              return (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground">{s.value.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {data.httpErrors.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">HTTP Error Distribution</h4>
              <div className="flex flex-wrap gap-2">
                {data.httpErrors.map((e) => (
                  <Badge key={e.statusCode} variant="outline" className="text-red-500 border-red-500/30">
                    {e.statusCode}: {e.count}x
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Webhook Failures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Webhook Failures</CardTitle>
          <CardDescription>Most recent failed deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentFailures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead className="text-center">Status Code</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-center">Attempts</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentFailures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.eventType}</TableCell>
                    <TableCell className="text-center">
                      {f.statusCode ? (
                        <Badge variant="outline" className="text-red-500">
                          {f.statusCode}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {f.error}
                    </TableCell>
                    <TableCell className="text-center">{f.attempts}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDate(f.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No failed deliveries</div>
          )}
        </CardContent>
      </Card>

      {/* API Key Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Key Usage</CardTitle>
          <CardDescription>Keys sorted by total requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.expiringKeys.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-500">
                {data.expiringKeys.length} key{data.expiringKeys.length > 1 ? "s" : ""} expiring within 7 days:
                {" "}{data.expiringKeys.map((k) => k.name).join(", ")}
              </p>
            </div>
          )}

          {data.apiKeyUsage.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Total Requests</TableHead>
                  <TableHead className="text-right">Daily</TableHead>
                  <TableHead className="text-right">Last Used</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.apiKeyUsage.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{k.name}</p>
                        <p className="text-xs text-muted-foreground">{k.prefix}...</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{k.email || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{k.totalRequests.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{k.dailyRequests.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatDate(k.lastUsed)}
                    </TableCell>
                    <TableCell className="text-center">
                      {k.status === "active" ? (
                        <Badge className="bg-green-500/10 text-green-500">Active</Badge>
                      ) : k.status === "revoked" ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No API keys created yet</div>
          )}
        </CardContent>
      </Card>

      {/* Workspace Seats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workspace Seats</CardTitle>
          <CardDescription>Utilization across all workspaces</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall utilization bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Utilization</span>
              <span className="text-muted-foreground">
                {seats.usedSeats}/{seats.totalSeats} seats ({seatUtilization}%)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-primary transition-all"
                style={{ width: `${Number(seatUtilization)}%` }}
              />
            </div>
          </div>

          {/* Per-workspace table */}
          {seats.workspaces.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Seats Used</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seats.workspaces.map((w) => {
                  const util = w.seatLimit > 0 ? ((w.seatCount / w.seatLimit) * 100).toFixed(1) : "0.0";
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-right">{w.seatCount}</TableCell>
                      <TableCell className="text-right">{w.seatLimit}</TableCell>
                      <TableCell className="text-right">{util}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-4">No workspaces yet</div>
          )}

          {/* Invite stats */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Invite Stats</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Pending: <strong>{data.invites.pending}</strong></span>
              <span>Accepted: <strong>{data.invites.accepted}</strong></span>
              <span>Expired: <strong>{data.invites.expired}</strong></span>
              <span className="text-muted-foreground">
                Acceptance rate: {data.invites.acceptanceRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
