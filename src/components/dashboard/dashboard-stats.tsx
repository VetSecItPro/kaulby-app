"use client";

import { useMemo } from "react";
import { StatCard, generateSparklineData } from "./stat-card";
import { Radio, MessageSquare } from "lucide-react";

interface DashboardStatsProps {
  monitorsCount: number;
  resultsCount: number;
  limits: {
    monitors: number;
  };
}

export function DashboardStats({
  monitorsCount,
  resultsCount,
  limits,
}: DashboardStatsProps) {
  // Generate sparkline data once (memoized to prevent regeneration on re-renders)
  const monitorsSparkline = useMemo(
    () => generateSparklineData(monitorsCount, 7),
    [monitorsCount]
  );
  const resultsSparkline = useMemo(
    () => generateSparklineData(resultsCount, 7),
    [resultsCount]
  );

  // Determine trend based on sparkline data
  const getResultsTrend = () => {
    if (resultsSparkline.length < 2) return "neutral";
    const first = resultsSparkline[0].value;
    const last = resultsSparkline[resultsSparkline.length - 1].value;
    if (last > first * 1.1) return "up";
    if (last < first * 0.9) return "down";
    return "neutral";
  };

  return (
    <div className="grid gap-4 grid-cols-2">
      <StatCard
        title="Active Monitors"
        value={monitorsCount}
        description={
          limits.monitors === -1
            ? "No limit"
            : `of ${limits.monitors} available`
        }
        icon={Radio}
        sparklineData={monitorsSparkline}
        delay={0}
      />

      <StatCard
        title="Results This Month"
        value={resultsCount}
        description="Across all monitors"
        icon={MessageSquare}
        sparklineData={resultsSparkline}
        trend={getResultsTrend()}
        delay={0.05}
      />
    </div>
  );
}
