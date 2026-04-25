/**
 * Shared tile components for the observability admin pages.
 *
 * Each tile renders a Card with a query result. Used by both the overview
 * page (5 tiles in grid) and the per-metric sub-pages (single tile full-width).
 */

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
import { Activity, AlertTriangle, DollarSign, Gauge, Heart } from "lucide-react";
import {
  CADENCE_MATRIX,
  PLATFORM_VELOCITY,
  type Velocity,
} from "@/lib/scan-cadence";
import type { Platform } from "@/lib/plans";

export type CadenceRow = { tier: string; platform: string; avgGapMin: number; sampleSize: number };
export type AiCostRow = { tier: string; totalCostUsd: number; calls: number };
export type ScanVolumeRow = { tier: string; platform: string; scans: number };
export type FailureRow = {
  monitorId: string;
  name: string;
  email: string | null;
  failedAt: Date;
  reason: string | null;
};
export type VendorHealthRow = {
  vendor: string;
  metric: string;
  value: number | null;
  metadata: unknown;
  recordedAt: Date;
};

export function CadenceHealthTile({ data, fullWidth = false }: { data: CadenceRow[]; fullWidth?: boolean }) {
  return (
    <Card className={fullWidth ? "md:col-span-2" : undefined}>
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
                        {expectedMin != null ? `${(expectedMin / 60).toFixed(1)}h` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {driftPct == null ? (
                          <Badge variant="outline">-</Badge>
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

export function AiCostByTierTile({ data, fullWidth = false }: { data: AiCostRow[]; fullWidth?: boolean }) {
  const total = data.reduce((s, r) => s + r.totalCostUsd, 0);
  return (
    <Card className={fullWidth ? "md:col-span-2" : undefined}>
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

export function ScanVolumeTile({ data, fullWidth = false }: { data: ScanVolumeRow[]; fullWidth?: boolean }) {
  const tiers = Array.from(new Set(data.map((r) => r.tier))).sort();
  const platforms = Array.from(new Set(data.map((r) => r.platform))).sort();
  const lookup = new Map<string, number>();
  for (const r of data) lookup.set(`${r.tier}|${r.platform}`, r.scans);
  const totalScans = data.reduce((s, r) => s + r.scans, 0);

  return (
    <Card className={fullWidth ? "md:col-span-2" : undefined}>
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

export function RecentFailuresTile({ data, fullWidth = false }: { data: FailureRow[]; fullWidth?: boolean }) {
  return (
    <Card className={fullWidth ? "md:col-span-2" : undefined}>
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
            No scan failures in the last 24 hours.
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
                        {row.email ?? "-"}
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

type VendorStatus = "healthy" | "warning" | "critical" | "unknown";

function getVendorStatus(rows: VendorHealthRow[]): { status: VendorStatus; summary: string } {
  if (rows.length === 0) return { status: "unknown", summary: "no snapshot yet" };
  const failedRow = rows.find((r) => r.metric === "_snapshot_failed" && r.value === 1);
  if (failedRow) {
    const md = failedRow.metadata as { error?: string } | null;
    return { status: "critical", summary: md?.error ?? "snapshot failed" };
  }
  const vendor = rows[0].vendor;
  if (vendor === "apify") {
    const pctRow = rows.find((r) => r.metric === "monthly_usage_pct");
    const pct = pctRow?.value ?? 0;
    if (pct >= 95) return { status: "critical", summary: `${pct.toFixed(0)}% of monthly quota used` };
    if (pct >= 75) return { status: "warning", summary: `${pct.toFixed(0)}% of monthly quota used` };
    return { status: "healthy", summary: `${pct.toFixed(0)}% of monthly quota used` };
  }
  if (vendor === "openrouter") {
    const usedRow = rows.find((r) => r.metric === "usage_total_usd");
    const remRow = rows.find((r) => r.metric === "credit_remaining_usd");
    if (remRow?.value != null) {
      if (remRow.value < 1) return { status: "critical", summary: `$${remRow.value.toFixed(2)} remaining` };
      if (remRow.value < 5) return { status: "warning", summary: `$${remRow.value.toFixed(2)} remaining` };
      return { status: "healthy", summary: `$${remRow.value.toFixed(2)} remaining` };
    }
    return {
      status: "healthy",
      summary: usedRow?.value != null ? `$${usedRow.value.toFixed(2)} used MTD` : "active",
    };
  }
  if (vendor === "xai") {
    const activeRow = rows.find((r) => r.metric === "key_active");
    if (activeRow?.value === 1) return { status: "healthy", summary: "key active" };
    if (activeRow?.value === 0) return { status: "critical", summary: "key disabled" };
    return { status: "unknown", summary: "no status" };
  }
  // Phase 3 vendors (sentry, polar, inngest, resend, posthog, langfuse, vercel)
  // surface a generic "active" summary derived from the first metric value.
  const first = rows[0];
  if (first?.value != null) {
    return { status: "healthy", summary: `${first.metric}: ${first.value}` };
  }
  return { status: "unknown", summary: "unknown vendor" };
}

export function SystemHealthTile({ data, fullWidth = true }: { data: VendorHealthRow[]; fullWidth?: boolean }) {
  const byVendor = new Map<string, VendorHealthRow[]>();
  for (const row of data) {
    const list = byVendor.get(row.vendor) ?? [];
    list.push(row);
    byVendor.set(row.vendor, list);
  }
  const vendorList = Array.from(byVendor.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card className={fullWidth ? "md:col-span-2" : undefined}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-muted-foreground" />
          <CardTitle>System Health (Vendors)</CardTitle>
        </div>
        <CardDescription>
          Latest hourly snapshot from external vendors. Hourly cron writes to vendor_metrics.
          Empty rows = waiting for first snapshot (cron runs at :00 each hour).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {vendorList.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No vendor snapshots yet. The hourly cron will populate this on the next :00 minute mark.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {vendorList.map(([vendor, rows]) => {
              const { status, summary } = getVendorStatus(rows);
              const ageMin = (Date.now() - rows[0].recordedAt.getTime()) / 60_000;
              const stale = ageMin > 90;
              return (
                <div key={vendor} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{vendor}</span>
                    {status === "healthy" && <Badge className="bg-green-100 text-green-800">healthy</Badge>}
                    {status === "warning" && <Badge className="bg-yellow-100 text-yellow-800">warning</Badge>}
                    {status === "critical" && <Badge variant="destructive">critical</Badge>}
                    {status === "unknown" && <Badge variant="outline">unknown</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{summary}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stale ? (
                      <span className="text-yellow-600">stale ({Math.round(ageMin)}m old)</span>
                    ) : (
                      <span>{Math.round(ageMin)}m ago</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
