"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SparklineData {
  value: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  description: ReactNode;
  icon: LucideIcon;
  sparklineData?: SparklineData[];
  trend?: "up" | "down" | "neutral";
  className?: string;
  delay?: number;
}

// Determine sparkline color based on trend
const getSparklineColor = (trend?: "up" | "down" | "neutral") => {
  switch (trend) {
    case "up":
      return "#22c55e"; // green
    case "down":
      return "#ef4444"; // red
    default:
      return "#14b8a6"; // teal (primary)
  }
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  sparklineData,
  trend,
  className,
  delay = 0,
}: StatCardProps) {
  const sparklineColor = getSparklineColor(trend);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2 },
      }}
    >
      <Card className={cn("transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2">
            <div className="space-y-1">
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {sparklineData && sparklineData.length > 0 && (
              <div className="h-10 w-20 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`sparklineGradient-${title.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={sparklineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={sparklineColor}
                      strokeWidth={1.5}
                      fill={`url(#sparklineGradient-${title.replace(/\s/g, "")})`}
                      isAnimationActive={true}
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Generate mock sparkline data for demo purposes
// In production, this would come from actual historical data
export function generateSparklineData(baseValue: number, days: number = 7): SparklineData[] {
  const data: SparklineData[] = [];
  let currentValue = baseValue * 0.7; // Start at 70% of current value

  for (let i = 0; i < days; i++) {
    // Add some variation to simulate realistic trends
    const variation = (Math.random() - 0.3) * (baseValue * 0.15);
    currentValue = Math.max(0, currentValue + variation);

    // Trend towards the base value on the last day
    if (i === days - 1) {
      currentValue = baseValue;
    }

    data.push({ value: Math.round(currentValue) });
  }

  return data;
}
