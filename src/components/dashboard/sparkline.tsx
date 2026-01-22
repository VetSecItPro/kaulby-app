"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  /** Data points (numbers) */
  data: number[];
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Stroke color (CSS class or hex) */
  color?: string;
  /** Show filled area under the line */
  filled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label */
  label?: string;
}

/**
 * Minimal sparkline chart component
 *
 * Renders a simple line chart that shows trends at a glance.
 * Designed to be small and fit within cards or inline text.
 */
export const Sparkline = memo(function Sparkline({
  data,
  width = 100,
  height = 32,
  color = "currentColor",
  filled = true,
  className,
  label = "Trend chart",
}: SparklineProps) {
  const { path, fillPath, hasData } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: "", fillPath: "", hasData: false };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // Prevent division by zero

    // Padding from edges
    const paddingX = 2;
    const paddingY = 4;
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;

    // Calculate points
    const points = data.map((value, index) => {
      const x = paddingX + (index / (data.length - 1)) * chartWidth;
      const y = paddingY + chartHeight - ((value - min) / range) * chartHeight;
      return { x, y };
    });

    // Build SVG path
    const linePath = points
      .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");

    // Build fill path (closes the area)
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`;

    return { path: linePath, fillPath: areaPath, hasData: true };
  }, [data, width, height]);

  if (!hasData) {
    // Empty state - show a flat line
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("text-muted-foreground/30", className)}
        role="img"
        aria-label={label}
      >
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={label}
    >
      {filled && (
        <path
          d={fillPath}
          fill={color}
          opacity={0.1}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

/**
 * Trend direction indicator
 */
export type TrendDirection = "up" | "down" | "flat";

interface TrendIndicatorProps {
  /** Percentage change (positive = up, negative = down) */
  change: number;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Shows trend direction with percentage and arrow
 */
export const TrendIndicator = memo(function TrendIndicator({
  change,
  size = "md",
  className,
}: TrendIndicatorProps) {
  const direction: TrendDirection = change > 0.5 ? "up" : change < -0.5 ? "down" : "flat";

  const colors = {
    up: "text-green-600 dark:text-green-400",
    down: "text-red-600 dark:text-red-400",
    flat: "text-muted-foreground",
  };

  const arrows = {
    up: "↑",
    down: "↓",
    flat: "→",
  };

  const sizes = {
    sm: "text-xs",
    md: "text-sm",
  };

  const displayValue = Math.abs(change).toFixed(0);

  return (
    <span className={cn(colors[direction], sizes[size], "font-medium", className)}>
      {direction !== "flat" && `${change > 0 ? "+" : ""}${displayValue}%`}
      {direction === "flat" && "—"}
      <span className="ml-0.5">{arrows[direction]}</span>
    </span>
  );
});

/**
 * Combined sparkline with trend indicator
 */
interface SparklineWithTrendProps {
  /** Data points for the sparkline */
  data: number[];
  /** Percentage change to display */
  change: number;
  /** Chart dimensions */
  width?: number;
  height?: number;
  /** Color for positive/neutral trend */
  color?: string;
  /** Additional CSS classes */
  className?: string;
}

export const SparklineWithTrend = memo(function SparklineWithTrend({
  data,
  change,
  width = 80,
  height = 24,
  className,
}: SparklineWithTrendProps) {
  // Color based on trend
  const color = change > 0.5
    ? "rgb(22 163 74)" // green-600
    : change < -0.5
    ? "rgb(220 38 38)" // red-600
    : "rgb(107 114 128)"; // gray-500

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Sparkline
        data={data}
        width={width}
        height={height}
        color={color}
      />
      <TrendIndicator change={change} size="sm" />
    </div>
  );
});
