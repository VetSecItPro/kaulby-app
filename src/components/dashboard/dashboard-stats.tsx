"use client";

import { useMemo } from "react";
import { StatCard, generateSparklineData } from "./stat-card";
import { Radio, MessageSquare, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { PlanKey } from "@/lib/plans";

interface DashboardStatsProps {
  monitorsCount: number;
  resultsCount: number;
  userPlan: PlanKey;
  limits: {
    monitors: number;
    resultsVisible: number;
  };
}

export function DashboardStats({
  monitorsCount,
  resultsCount,
  userPlan,
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
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Active Monitors"
        value={monitorsCount}
        description={
          limits.monitors === -1
            ? "Unlimited"
            : `of ${limits.monitors} available`
        }
        icon={Radio}
        sparklineData={monitorsSparkline}
        delay={0}
      />

      <StatCard
        title="Results This Month"
        value={resultsCount}
        description={
          limits.resultsVisible === -1
            ? "Unlimited visible"
            : `${limits.resultsVisible} visible (free tier)`
        }
        icon={MessageSquare}
        sparklineData={resultsSparkline}
        trend={getResultsTrend()}
        delay={0.05}
      />

      <StatCard
        title="Current Plan"
        value={userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
        description={
          userPlan === "free" ? (
            <Link href="/dashboard/settings" className="text-primary hover:underline">
              Upgrade for more
            </Link>
          ) : (
            "Active subscription"
          )
        }
        icon={TrendingUp}
        delay={0.1}
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}
