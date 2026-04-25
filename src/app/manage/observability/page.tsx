/**
 * Admin Observability Dashboard
 *
 * Consolidates the 5 most important "is the cadence matrix working?" + "what's
 * burning money?" + "what's broken?" questions into a single admin page so
 * we don't have to log in to PostHog/Langfuse/Sentry/Apify just to spot-check.
 *
 * Validates the cadence matrix shipped in PR #263.
 *
 * Auth: relies on /manage layout's admin gate.
 */

import { db } from "@/lib/db";
import { aiLogs, monitors, results, users } from "@/lib/db/schema";
import { and, count, desc, eq, gte, isNotNull, sql, sum } from "drizzle-orm";
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
import { ArrowLeft, Activity, DollarSign, Gauge, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CADENCE_MATRIX,
  PLATFORM_VELOCITY,
  type Velocity,
} from "@/lib/scan-cadence";
import type { Platform } from "@/lib/plans";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Effective scan cadence per (tier, platform) for the last 7 days.
 * Computed as the average gap between consecutive `results.created_at` per
 * monitor, then aggregated across monitors of the same tier+platform.
 */
async function getCadenceHealth(): Promise<
  Array<{ tier: string; platform: string; avgGapMin: number; sampleSize: number }>
> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db.execute<{
    tier: string;
    platform: string;
    avg_gap_min: number;
    sample_size: number;
  }>(sql`
    WITH scan_intervals AS (
      SELECT
        r.platform AS platform,
        u.subscription_status AS tier,
        EXTRACT(
          EPOCH FROM (
            r.created_at - LAG(r.created_at) OVER (
              PARTITION BY r.monitor_id ORDER BY r.created_at
            )
          )
        ) / 60.0 AS gap_min
      FROM results r
      JOIN monitors m ON m.id = r.monitor_id
      JOIN users u ON u.id = m.user_id
      WHERE r.created_at > ${sevenDaysAgo}
    )
    SELECT
      tier,
      platform,
      ROUND(AVG(gap_min)::numeric, 1) AS avg_gap_min,
      COUNT(*) AS sample_size
    FROM scan_intervals
    WHERE gap_min IS NOT NULL AND gap_min > 0
    GROUP BY tier, platform
    HAVING COUNT(*) >= 3
    ORDER BY tier, platform
  `);

  return rows.rows.map((r) => ({
    tier: String(r.tier ?? "unknown"),
    platform: String(r.platform),
    avgGapMin: Number(r.avg_gap_min ?? 0),
    sampleSize: Number(r.sample_size ?? 0),
  }));
}

/**
 * AI spend rolled up by tier + day for the last 30 days.
 * Provides a "is the cadence matrix actually saving money on each tier?" answer.
 */
async function getAiCostByTier(): Promise<
  Array<{ tier: string; totalCostUsd: number; calls: number }>
> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db
    .select({
      tier: users.subscriptionStatus,
      totalCostUsd: sum(aiLogs.costUsd),
      calls: count(),
    })
    .from(aiLogs)
    .leftJoin(users, eq(users.id, aiLogs.userId))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(users.subscriptionStatus)
    .orderBy(desc(sum(aiLogs.costUsd)));

  return rows.map((r) => ({
    tier: r.tier ?? "unknown",
    totalCostUsd: Number(r.totalCostUsd ?? 0),
    calls: Number(r.calls ?? 0),
  }));
}

/**
 * Per-tier per-platform scan volume (last 7 days).
 * Validates the cadence matrix is discriminating: lower tiers should insert
 * fewer rows than higher tiers for the same platform.
 */
async function getScanVolumeByTier(): Promise<
  Array<{ tier: string; platform: string; scans: number }>
> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db
    .select({
      tier: users.subscriptionStatus,
      platform: results.platform,
      scans: count(),
    })
    .from(results)
    .innerJoin(monitors, eq(monitors.id, results.monitorId))
    .leftJoin(users, eq(users.id, monitors.userId))
    .where(gte(results.createdAt, sevenDaysAgo))
    .groupBy(users.subscriptionStatus, results.platform)
    .orderBy(users.subscriptionStatus, results.platform);

  return rows.map((r) => ({
    tier: r.tier ?? "unknown",
    platform: String(r.platform),
    scans: Number(r.scans),
  }));
}

/**
 * Monitors with `lastCheckFailedAt` in the last 24h.
 * Operational ops view — what scans are actively failing right now.
 */
async function getRecentFailures(): Promise<
  Array<{
    monitorId: string;
    name: string;
    email: string | null;
    failedAt: Date;
    reason: string | null;
  }>
> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      monitorId: monitors.id,
      name: monitors.name,
      email: users.email,
      failedAt: monitors.lastCheckFailedAt,
      reason: monitors.lastCheckFailedReason,
    })
    .from(monitors)
    .leftJoin(users, eq(users.id, monitors.userId))
    .where(
      and(
        isNotNull(monitors.lastCheckFailedAt),
        gte(monitors.lastCheckFailedAt, oneDayAgo),
      ),
    )
    .orderBy(desc(monitors.lastCheckFailedAt))
    .limit(50);

  return rows.map((r) => ({
    monitorId: r.monitorId,
    name: r.name,
    email: r.email,
    failedAt: r.failedAt as Date,
    reason: r.reason,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default async function ObservabilityPage() {
  const [cadenceHealth, aiCostByTier, scanVolume, recentFailures] = await Promise.all([
    getCadenceHealth().catch((e) => {
      console.error("[observability] cadence query failed", e);
      return [] as Awaited<ReturnType<typeof getCadenceHealth>>;
    }),
    getAiCostByTier().catch((e) => {
      console.error("[observability] ai-cost query failed", e);
      return [] as Awaited<ReturnType<typeof getAiCostByTier>>;
    }),
    getScanVolumeByTier().catch((e) => {
      console.error("[observability] scan-volume query failed", e);
      return [] as Awaited<ReturnType<typeof getScanVolumeByTier>>;
    }),
    getRecentFailures().catch((e) => {
      console.error("[observability] failures query failed", e);
      return [] as Awaited<ReturnType<typeof getRecentFailures>>;
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/manage">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to admin
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Observability</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Validates the cadence matrix (PR #263) and surfaces operational health without
          requiring logins to PostHog / Langfuse / Sentry / Apify.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CadenceHealthTile data={cadenceHealth} />
        <AiCostByTierTile data={aiCostByTier} />
        <ScanVolumeTile data={scanVolume} />
        <RecentFailuresTile data={recentFailures} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TILES
// ─────────────────────────────────────────────────────────────────────────────

function CadenceHealthTile({
  data,
}: {
  data: Array<{ tier: string; platform: string; avgGapMin: number; sampleSize: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Cadence Health</CardTitle>
        </div>
        <CardDescription>
          Effective scan interval per (tier × platform), last 7 days. Compared to expected matrix value.
          Drift &gt; 50% means the matrix isn&apos;t biting correctly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No scan-interval data yet. The matrix needs at least 2 scans per monitor in the
            window to compute a gap.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const velocity = PLATFORM_VELOCITY[row.platform as Platform] as Velocity | undefined;
                  const matrixRow = CADENCE_MATRIX[row.tier as keyof typeof CADENCE_MATRIX];
                  const expectedMin = velocity && matrixRow ? matrixRow[velocity] : null;
                  const driftPct =
                    expectedMin && expectedMin > 0
                      ? ((row.avgGapMin - expectedMin) / expectedMin) * 100
                      : null;
                  return (
                    <TableRow key={`${row.tier}-${row.platform}`}>
                      <TableCell className="font-mono text-xs">{row.tier}</TableCell>
                      <TableCell className="font-mono text-xs">{row.platform}</TableCell>
                      <TableCell className="text-right text-xs">
                        {(row.avgGapMin / 60).toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {expectedMin != null ? `${(expectedMin / 60).toFixed(1)}h` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {driftPct == null ? (
                          <Badge variant="outline">—</Badge>
                        ) : Math.abs(driftPct) <= 25 ? (
                          <Badge className="bg-green-100 text-green-800">on target</Badge>
                        ) : Math.abs(driftPct) <= 75 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            {driftPct > 0 ? "+" : ""}
                            {driftPct.toFixed(0)}%
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            {driftPct > 0 ? "+" : ""}
                            {driftPct.toFixed(0)}%
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AiCostByTierTile({
  data,
}: {
  data: Array<{ tier: string; totalCostUsd: number; calls: number }>;
}) {
  const total = data.reduce((s, r) => s + r.totalCostUsd, 0);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <CardTitle>AI Cost by Tier (30 days)</CardTitle>
        </div>
        <CardDescription>
          Total OpenRouter + xAI spend rolled up from the aiLogs table. Lower tiers should
          have proportionally lower spend after the cadence matrix takes effect.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-4">
          ${total.toFixed(2)}
          <span className="text-xs text-muted-foreground font-normal ml-2">total</span>
        </div>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">No AI calls in the last 30 days.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">$/call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.tier}>
                  <TableCell className="font-mono text-xs">{row.tier}</TableCell>
                  <TableCell className="text-right text-xs">{row.calls.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs">${row.totalCostUsd.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-xs">
                    ${row.calls > 0 ? (row.totalCostUsd / row.calls).toFixed(4) : "0.0000"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScanVolumeTile({
  data,
}: {
  data: Array<{ tier: string; platform: string; scans: number }>;
}) {
  // Group by tier for a tier × platform pivot view
  const tiers = Array.from(new Set(data.map((r) => r.tier))).sort();
  const platforms = Array.from(new Set(data.map((r) => r.platform))).sort();
  const lookup = new Map<string, number>();
  for (const r of data) lookup.set(`${r.tier}|${r.platform}`, r.scans);
  const totalScans = data.reduce((s, r) => s + r.scans, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Scan Volume by Tier (7 days)</CardTitle>
        </div>
        <CardDescription>
          Result-row inserts per (tier × platform). Higher tiers should scan more frequently
          per the cadence matrix.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-4">
          {totalScans.toLocaleString()}
          <span className="text-xs text-muted-foreground font-normal ml-2">total scans</span>
        </div>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">No scans in last 7 days.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  {tiers.map((t) => (
                    <TableHead key={t} className="text-right font-mono text-xs">
                      {t}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {platforms.map((p) => (
                  <TableRow key={p}>
                    <TableCell className="font-mono text-xs">{p}</TableCell>
                    {tiers.map((t) => (
                      <TableCell key={t} className="text-right text-xs">
                        {(lookup.get(`${t}|${p}`) ?? 0).toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentFailuresTile({
  data,
}: {
  data: Array<{
    monitorId: string;
    name: string;
    email: string | null;
    failedAt: Date;
    reason: string | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Recent Failures (24h)</CardTitle>
        </div>
        <CardDescription>
          Monitors with a non-null lastCheckFailedAt in the last 24h. Sorted newest first,
          capped at 50.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            ✅ No scan failures in the last 24 hours.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Monitor</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const ageMin = (Date.now() - row.failedAt.getTime()) / 60_000;
                  const recent = ageMin < 60;
                  return (
                    <TableRow key={row.monitorId}>
                      <TableCell className="text-xs">
                        {recent ? (
                          <Badge variant="destructive">{Math.round(ageMin)}m ago</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {(ageMin / 60).toFixed(1)}h ago
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono truncate max-w-[200px]">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {row.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {row.reason ?? "(no reason recorded)"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
