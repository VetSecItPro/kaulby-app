"use client";

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

export function AreaChartImpl({
  data,
  tiers,
}: {
  data: Array<Record<string, number | string>>;
  tiers: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
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
  );
}

export function LineChartImpl({
  data,
  unit = "",
}: {
  data: Array<{ date: string; value: number }>;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
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
  );
}
