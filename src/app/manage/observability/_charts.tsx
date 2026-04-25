"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as LineIcon, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TIER_COLORS: Record<string, string> = {
  free: "#94a3b8",
  solo: "#3b82f6",
  scale: "#8b5cf6",
  growth: "#a855f7",
  pro: "#3b82f6",
  team: "#8b5cf6",
  unknown: "#cbd5e1",
};

// PERF-BUILDTIME-001: hoisted formatter — was creating implicit Intl objects
// per cell × per chart. Module-level singleton is allocated once per page load.
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function formatDateLabel(d: string): string {
  return DATE_LABEL_FORMATTER.format(new Date(d));
}

/**
 * Pivots flat rows [{date, tier, value}, ...] into wide rows [{date, free: x, solo: y, ...}]
 * so recharts can stack tiers as separate areas.
 */
function pivotByTier(rows: Array<{ date: string; tier: string; value: number }>): {
  data: Array<Record<string, number | string>>;
  tiers: string[];
} {
  const tierSet = new Set<string>();
  const byDate = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    tierSet.add(r.tier);
    const existing = byDate.get(r.date) ?? { date: formatDateLabel(r.date) };
    existing[r.tier] = (Number(existing[r.tier]) || 0) + r.value;
    byDate.set(r.date, existing);
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  const data = sortedDates.map((d) => byDate.get(d)!);
  // Fill missing tier values with 0 so the stack renders correctly.
  const tiers = Array.from(tierSet).sort();
  for (const row of data) {
    for (const t of tiers) if (row[t] == null) row[t] = 0;
  }
  return { data, tiers };
}

export function AiCostTrendChart({ data }: { data: Array<{ date: string; tier: string; value: number }> }) {
  const { data: pivoted, tiers } = pivotByTier(data);
  const totalCost = data.reduce((s, r) => s + r.value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle>AI Cost Trend (30 days, by tier)</CardTitle>
        </div>
        <CardDescription>
          Stacked area chart of daily AI spend per tier from the daily_metrics rollup.
          Empty until the 00:05 CT cron has run at least once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-4">
          ${totalCost.toFixed(2)}
          <span className="text-xs text-muted-foreground font-normal ml-2">across the window</span>
        </div>
        {pivoted.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            No daily_metrics rows yet. The rollup cron writes one batch per day at 00:05 CT.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={pivoted}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
              <Tooltip
                formatter={(v: number) => [`$${Number(v).toFixed(2)}`, ""]}
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
              />
              <Legend />
              {tiers.map((t) => (
                <Area
                  key={t}
                  type="monotone"
                  dataKey={t}
                  stackId="1"
                  stroke={TIER_COLORS[t] ?? "#94a3b8"}
                  fill={TIER_COLORS[t] ?? "#94a3b8"}
                  fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function VendorMetricTrendChart({
  data,
  title,
  description,
  unit = "",
}: {
  data: Array<{ date: string; value: number }>;
  title: string;
  description: string;
  unit?: string;
}) {
  const formatted = data.map((d) => ({ date: formatDateLabel(d.date), value: d.value }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LineIcon className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {formatted.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            No daily_metrics rows yet. The rollup cron writes one batch per day at 00:05 CT.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v) => `${Number(v).toFixed(0)}${unit}`} />
              <Tooltip
                formatter={(v: number) => [`${Number(v).toFixed(2)}${unit}`, ""]}
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
              />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
