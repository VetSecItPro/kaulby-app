import { db } from "@/lib/db";
import { emailEvents } from "@/lib/db/schema";
import { sql, gte, desc } from "drizzle-orm";
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
import { ArrowLeft, Mail, MousePointerClick, Eye, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getEmailData() {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    stats24h,
    stats7d,
    stats30d,
    engagementByType,
    dailyVolume,
    recentEvents,
  ] = await Promise.all([
    // 24h stats
    db
      .select({
        sent: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'sent' THEN 1 END)`,
        opened: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'opened' THEN 1 END)`,
        clicked: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'clicked' THEN 1 END)`,
      })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, twentyFourHoursAgo)),

    // 7d stats
    db
      .select({
        sent: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'sent' THEN 1 END)`,
        opened: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'opened' THEN 1 END)`,
        clicked: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'clicked' THEN 1 END)`,
      })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, sevenDaysAgo)),

    // 30d stats
    db
      .select({
        sent: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'sent' THEN 1 END)`,
        opened: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'opened' THEN 1 END)`,
        clicked: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'clicked' THEN 1 END)`,
      })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, thirtyDaysAgo)),

    // Engagement by email type (30d)
    db
      .select({
        emailType: emailEvents.emailType,
        sent: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'sent' THEN 1 END)`,
        opened: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'opened' THEN 1 END)`,
        clicked: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'clicked' THEN 1 END)`,
      })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, thirtyDaysAgo))
      .groupBy(emailEvents.emailType)
      .orderBy(desc(sql`COUNT(CASE WHEN ${emailEvents.eventType} = 'sent' THEN 1 END)`)),

    // Daily send volume (30d)
    db
      .select({
        date: sql<string>`DATE(${emailEvents.createdAt})`,
        sent: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'sent' THEN 1 END)`,
        opened: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'opened' THEN 1 END)`,
        clicked: sql<number>`COUNT(CASE WHEN ${emailEvents.eventType} = 'clicked' THEN 1 END)`,
      })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${emailEvents.createdAt})`)
      .orderBy(desc(sql`DATE(${emailEvents.createdAt})`)),

    // Recent events
    db
      .select({
        id: emailEvents.id,
        emailType: emailEvents.emailType,
        eventType: emailEvents.eventType,
        createdAt: emailEvents.createdAt,
      })
      .from(emailEvents)
      .orderBy(desc(emailEvents.createdAt))
      .limit(20),
  ]);

  // Fetch domain health from Resend
  let domainStatus: Array<{
    name: string;
    status: string;
    region: string;
  }> = [];

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const data = await res.json();
      domainStatus = (data.data || []).map((d: Record<string, unknown>) => ({
        name: d.name as string,
        status: d.status as string,
        region: (d.region as string) || "us-east-1",
      }));
    }
  } catch {
    // Silently fail
  }

  const s30 = stats30d[0] || { sent: 0, opened: 0, clicked: 0 };
  const sent30d = Number(s30.sent) || 0;
  const opened30d = Number(s30.opened) || 0;
  const clicked30d = Number(s30.clicked) || 0;

  return {
    stats24h: {
      sent: Number(stats24h[0]?.sent) || 0,
      opened: Number(stats24h[0]?.opened) || 0,
      clicked: Number(stats24h[0]?.clicked) || 0,
    },
    stats7d: {
      sent: Number(stats7d[0]?.sent) || 0,
      opened: Number(stats7d[0]?.opened) || 0,
      clicked: Number(stats7d[0]?.clicked) || 0,
    },
    stats30d: {
      sent: sent30d,
      opened: opened30d,
      clicked: clicked30d,
      openRate: sent30d > 0 ? (opened30d / sent30d) * 100 : 0,
      clickRate: sent30d > 0 ? (clicked30d / sent30d) * 100 : 0,
    },
    engagementByType: engagementByType.map((e) => ({
      type: e.emailType,
      sent: Number(e.sent) || 0,
      opened: Number(e.opened) || 0,
      clicked: Number(e.clicked) || 0,
    })),
    dailyVolume: dailyVolume.map((d) => ({
      date: d.date,
      sent: Number(d.sent) || 0,
      opened: Number(d.opened) || 0,
      clicked: Number(d.clicked) || 0,
    })),
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      emailType: e.emailType,
      eventType: e.eventType,
      createdAt: e.createdAt,
    })),
    domainStatus,
  };
}

export default async function EmailPage() {
  // Auth + admin check handled by /manage/layout.tsx
  const data = await getEmailData();

  const allDomainsVerified = data.domainStatus.length > 0 &&
    data.domainStatus.every((d) => d.status === "verified");

  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage/system">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Email</h1>
            <p className="text-muted-foreground">Resend email delivery, engagement, and domain health</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={allDomainsVerified ? "border-green-500 text-green-500" : "border-amber-500 text-amber-500"}
        >
          {allDomainsVerified ? "Operational" : data.domainStatus.length === 0 ? "No Domains" : "Domain Issues"}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent (30d)</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats30d.sent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              7d: {data.stats7d.sent} | 24h: {data.stats24h.sent}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.stats30d.openRate > 20 ? "text-green-500" : "text-amber-500"}`}>
              {data.stats30d.openRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats30d.opened} opens
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.stats30d.clickRate > 2 ? "text-green-500" : "text-amber-500"}`}>
              {data.stats30d.clickRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats30d.clicked} clicks
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Domain Status</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${allDomainsVerified ? "text-green-500" : "text-amber-500"}`}>
              {data.domainStatus.filter((d) => d.status === "verified").length}/{data.domainStatus.length}
            </div>
            <p className="text-xs text-muted-foreground">Verified domains</p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Health */}
      {data.domainStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Domain Health
            </CardTitle>
            <CardDescription>Sending domain verification status</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.domainStatus.map((domain) => (
                  <TableRow key={domain.name}>
                    <TableCell className="font-medium">{domain.name}</TableCell>
                    <TableCell className="text-muted-foreground">{domain.region}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={domain.status === "verified"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-amber-500/10 text-amber-500"}
                      >
                        {domain.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Engagement by Email Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engagement by Email Type (30d)</CardTitle>
          <CardDescription>How different email types perform</CardDescription>
        </CardHeader>
        <CardContent>
          {data.engagementByType.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Click Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.engagementByType.map((e) => {
                  const openRate = e.sent > 0 ? (e.opened / e.sent) * 100 : 0;
                  const clickRate = e.sent > 0 ? (e.clicked / e.sent) * 100 : 0;
                  return (
                    <TableRow key={e.type}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{e.type}</code>
                      </TableCell>
                      <TableCell className="text-right">{e.sent}</TableCell>
                      <TableCell className="text-right">{e.opened}</TableCell>
                      <TableCell className="text-right">{e.clicked}</TableCell>
                      <TableCell className={`text-right font-medium ${openRate > 20 ? "text-green-500" : "text-amber-500"}`}>
                        {openRate.toFixed(1)}%
                      </TableCell>
                      <TableCell className={`text-right font-medium ${clickRate > 2 ? "text-green-500" : "text-amber-500"}`}>
                        {clickRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No email data</div>
          )}
        </CardContent>
      </Card>

      {/* Daily Volume */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Email Volume (30d)</CardTitle>
          <CardDescription>Send volume and engagement over time</CardDescription>
        </CardHeader>
        <CardContent>
          {data.dailyVolume.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dailyVolume.map((day) => {
                  const openRate = day.sent > 0 ? (day.opened / day.sent) * 100 : 0;
                  return (
                    <TableRow key={day.date}>
                      <TableCell>{day.date}</TableCell>
                      <TableCell className="text-right">{day.sent}</TableCell>
                      <TableCell className="text-right">{day.opened}</TableCell>
                      <TableCell className="text-right">{day.clicked}</TableCell>
                      <TableCell className={`text-right font-medium ${openRate > 20 ? "text-green-500" : "text-amber-500"}`}>
                        {openRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No data</div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Events</CardTitle>
          <CardDescription>Latest email activity</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{event.emailType}</code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          event.eventType === "clicked" ? "bg-blue-500/10 text-blue-500" :
                          event.eventType === "opened" ? "bg-green-500/10 text-green-500" :
                          "bg-muted text-muted-foreground"
                        }
                      >
                        {event.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">No recent events</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
