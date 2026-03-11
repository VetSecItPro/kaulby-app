import { db } from "@/lib/db";
import { results, emailEvents, users, monitors } from "@/lib/db/schema";
import { count, sql, gte, eq } from "drizzle-orm";
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
import { ArrowLeft, Eye, MousePointerClick, Bookmark, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlatformDisplayName } from "@/lib/platform-utils";

export const dynamic = "force-dynamic";

async function getEngagementData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    overallEngagement,
    engagementByPlatform,
    emailOverall,
    emailByType,
    digestPausedCount,
    onboardingFunnel,
  ] = await Promise.all([
    // Overall result engagement (last 30d)
    db
      .select({
        total: count(),
        viewed: sql<number>`COUNT(*) FILTER (WHERE ${results.isViewed} = true)`,
        clicked: sql<number>`COUNT(*) FILTER (WHERE ${results.isClicked} = true)`,
        saved: sql<number>`COUNT(*) FILTER (WHERE ${results.isSaved} = true)`,
        hidden: sql<number>`COUNT(*) FILTER (WHERE ${results.isHidden} = true)`,
      })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo)),

    // Engagement by platform (last 30d)
    db
      .select({
        platform: results.platform,
        total: count(),
        viewed: sql<number>`COUNT(*) FILTER (WHERE ${results.isViewed} = true)`,
        clicked: sql<number>`COUNT(*) FILTER (WHERE ${results.isClicked} = true)`,
        saved: sql<number>`COUNT(*) FILTER (WHERE ${results.isSaved} = true)`,
      })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo))
      .groupBy(results.platform),

    // Email stats overall (last 30d)
    db
      .select({
        sent: sql<number>`COUNT(DISTINCT ${emailEvents.emailId}) FILTER (WHERE ${emailEvents.eventType} = 'sent')`,
        opened: sql<number>`COUNT(DISTINCT ${emailEvents.emailId}) FILTER (WHERE ${emailEvents.eventType} = 'opened')`,
        clicked: sql<number>`COUNT(*) FILTER (WHERE ${emailEvents.eventType} = 'clicked')`,
      })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, thirtyDaysAgo)),

    // Email by type (last 30d)
    db
      .select({
        emailType: emailEvents.emailType,
        sent: sql<number>`COUNT(DISTINCT ${emailEvents.emailId}) FILTER (WHERE ${emailEvents.eventType} = 'sent')`,
        opened: sql<number>`COUNT(DISTINCT ${emailEvents.emailId}) FILTER (WHERE ${emailEvents.eventType} = 'opened')`,
        clicked: sql<number>`COUNT(*) FILTER (WHERE ${emailEvents.eventType} = 'clicked')`,
      })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, thirtyDaysAgo))
      .groupBy(emailEvents.emailType),

    // Digest pause count
    db
      .select({ count: count() })
      .from(users)
      .where(eq(users.digestPaused, true)),

    // Onboarding funnel
    db
      .select({
        totalUsers: count(),
        onboarded: sql<number>`COUNT(*) FILTER (WHERE ${users.onboardingCompleted} = true)`,
      })
      .from(users),
  ]);

  // Users with monitors + users with results
  const [usersWithMonitors, usersWithResults] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${monitors.userId})` })
      .from(monitors),
    db
      .select({ count: sql<number>`COUNT(DISTINCT m."user_id")` })
      .from(results)
      .innerJoin(monitors, eq(results.monitorId, monitors.id)),
  ]);

  const engagement = overallEngagement[0] || { total: 0, viewed: 0, clicked: 0, saved: 0, hidden: 0 };
  const email = emailOverall[0] || { sent: 0, opened: 0, clicked: 0 };

  return {
    engagement: {
      total: engagement.total,
      viewed: Number(engagement.viewed),
      clicked: Number(engagement.clicked),
      saved: Number(engagement.saved),
      hidden: Number(engagement.hidden),
    },
    byPlatform: engagementByPlatform.map((p) => ({
      platform: p.platform,
      total: p.total,
      viewed: Number(p.viewed),
      clicked: Number(p.clicked),
      saved: Number(p.saved),
    })).sort((a, b) => b.total - a.total),
    email: {
      sent: Number(email.sent),
      opened: Number(email.opened),
      clicked: Number(email.clicked),
      pausedUsers: digestPausedCount[0]?.count || 0,
    },
    emailByType: emailByType.map((e) => ({
      type: e.emailType,
      sent: Number(e.sent),
      opened: Number(e.opened),
      clicked: Number(e.clicked),
    })),
    funnel: {
      totalUsers: onboardingFunnel[0]?.totalUsers || 0,
      onboarded: Number(onboardingFunnel[0]?.onboarded) || 0,
      withMonitors: Number(usersWithMonitors[0]?.count) || 0,
      withResults: Number(usersWithResults[0]?.count) || 0,
    },
  };
}

function pct(n: number, total: number): string {
  if (total === 0) return "0.0";
  return ((n / total) * 100).toFixed(1);
}

export default async function EngagementPage() {
  const data = await getEngagementData();
  const { engagement, email, funnel } = data;

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
            <h1 className="text-3xl font-bold tracking-tight">User Engagement</h1>
            <p className="text-muted-foreground">Result interactions, email health, and onboarding</p>
          </div>
        </div>
        <Badge variant="outline">Last 30 days</Badge>
      </div>

      {/* Engagement Rate Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">View Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pct(engagement.viewed, engagement.total)}%</div>
            <p className="text-xs text-muted-foreground">
              {engagement.viewed.toLocaleString()} of {engagement.total.toLocaleString()} results
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pct(engagement.clicked, engagement.total)}%</div>
            <p className="text-xs text-muted-foreground">
              {engagement.clicked.toLocaleString()} clicked through
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Save Rate</CardTitle>
            <Bookmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pct(engagement.saved, engagement.total)}%</div>
            <p className="text-xs text-muted-foreground">
              {engagement.saved.toLocaleString()} saved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hide Rate</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pct(engagement.hidden, engagement.total)}%</div>
            <p className="text-xs text-muted-foreground">
              {engagement.hidden.toLocaleString()} hidden
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement by Platform */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engagement by Platform</CardTitle>
          <CardDescription>Interaction rates per platform (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.byPlatform.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">View %</TableHead>
                  <TableHead className="text-right">Click %</TableHead>
                  <TableHead className="text-right">Save %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byPlatform.map((p) => (
                  <TableRow key={p.platform}>
                    <TableCell className="font-medium">{getPlatformDisplayName(p.platform)}</TableCell>
                    <TableCell className="text-right">{p.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{pct(p.viewed, p.total)}%</TableCell>
                    <TableCell className="text-right">{pct(p.clicked, p.total)}%</TableCell>
                    <TableCell className="text-right">{pct(p.saved, p.total)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No result data yet</div>
          )}
        </CardContent>
      </Card>

      {/* Email & Digest Stats */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Digest Performance</CardTitle>
            <CardDescription>Open and click rates for digest emails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-bold">
                  {pct(email.opened, email.sent)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clicks</p>
                <p className="text-2xl font-bold">{email.clicked.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">{email.sent.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Digest Paused</p>
                <p className="text-2xl font-bold">{email.pausedUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Digest Type</CardTitle>
            <CardDescription>Breakdown by email type</CardDescription>
          </CardHeader>
          <CardContent>
            {data.emailByType.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Opened</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.emailByType.map((e) => (
                    <TableRow key={e.type}>
                      <TableCell className="font-medium capitalize">
                        {e.type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-right">{e.sent}</TableCell>
                      <TableCell className="text-right">{e.opened}</TableCell>
                      <TableCell className="text-right">{e.clicked}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">No email data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Onboarding Funnel</CardTitle>
          <CardDescription>User progression from signup to first result</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Signups", value: funnel.totalUsers, pctVal: 100 },
            { label: "Onboarding Completed", value: funnel.onboarded, pctVal: funnel.totalUsers > 0 ? (funnel.onboarded / funnel.totalUsers) * 100 : 0 },
            { label: "Created Monitor", value: funnel.withMonitors, pctVal: funnel.totalUsers > 0 ? (funnel.withMonitors / funnel.totalUsers) * 100 : 0 },
            { label: "Got Results", value: funnel.withResults, pctVal: funnel.totalUsers > 0 ? (funnel.withResults / funnel.totalUsers) * 100 : 0 },
          ].map((step) => (
            <div key={step.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{step.label}</span>
                <span className="text-muted-foreground">
                  {step.value.toLocaleString()} ({step.pctVal.toFixed(1)}%)
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-primary transition-all"
                  style={{ width: `${step.pctVal}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
