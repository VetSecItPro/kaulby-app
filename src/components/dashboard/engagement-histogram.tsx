"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Engagement Histogram - GummySearch-style horizontal bar chart
 *
 * Shows distribution of engagement scores (upvotes + comments) across buckets:
 * - 0
 * - 1-5
 * - 6-10
 * - 11-50
 * - 51-100
 * - 100+
 */

interface EngagementBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

interface EngagementHistogramProps {
  /** The engagement buckets to display */
  buckets: EngagementBucket[];
  /** Currently selected range */
  selectedRange?: { min: number; max: number } | null;
  /** Called when a range is selected/deselected */
  onRangeChange?: (range: { min: number; max: number } | null) => void;
  /** Additional CSS classes */
  className?: string;
}

export const EngagementHistogram = memo(function EngagementHistogram({
  buckets,
  selectedRange,
  onRangeChange,
  className,
}: EngagementHistogramProps) {
  // Calculate max count for scaling bars
  const maxCount = useMemo(() => {
    return Math.max(...buckets.map((b) => b.count), 1);
  }, [buckets]);

  // Calculate total for percentages
  const total = useMemo(() => {
    return buckets.reduce((sum, b) => sum + b.count, 0);
  }, [buckets]);

  if (total === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No engagement data
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Upvotes</span>
        <span>Results</span>
      </div>

      {/* Histogram bars */}
      <div className="space-y-1.5">
        {buckets.map((bucket) => {
          const percentage = (bucket.count / maxCount) * 100;
          const isSelected =
            selectedRange?.min === bucket.min && selectedRange?.max === bucket.max;
          const isEmpty = bucket.count === 0;

          return (
            <button
              key={bucket.label}
              onClick={() => {
                if (isEmpty) return;
                onRangeChange?.(
                  isSelected ? null : { min: bucket.min, max: bucket.max }
                );
              }}
              disabled={isEmpty}
              className={cn(
                "w-full flex items-center gap-2 px-1 py-0.5 rounded transition-colors",
                isSelected && "bg-primary/10",
                !isEmpty && !isSelected && "hover:bg-muted",
                isEmpty && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Label */}
              <span className="w-12 text-xs text-right flex-shrink-0 font-mono">
                {bucket.label}
              </span>

              {/* Bar container */}
              <div className="flex-1 h-5 bg-muted/50 rounded-sm overflow-hidden">
                {/* Bar fill */}
                <div
                  className={cn(
                    "h-full rounded-sm transition-all",
                    isSelected
                      ? "bg-primary"
                      : "bg-primary/60"
                  )}
                  style={{ width: `${Math.max(percentage, bucket.count > 0 ? 2 : 0)}%` }}
                />
              </div>

              {/* Count badge */}
              <Badge
                variant="secondary"
                className={cn(
                  "h-5 px-1.5 text-xs flex-shrink-0 min-w-[2rem] justify-center",
                  isSelected && "bg-primary text-primary-foreground"
                )}
              >
                {bucket.count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Selected filter indicator */}
      {selectedRange && (
        <div className="text-xs text-center text-muted-foreground pt-1">
          Showing posts with {selectedRange.min === selectedRange.max
            ? selectedRange.min
            : selectedRange.max === Infinity
            ? `${selectedRange.min}+`
            : `${selectedRange.min}-${selectedRange.max}`} upvotes
        </div>
      )}
    </div>
  );
});

/**
 * Mini version for inline use (e.g., in cards)
 */
interface MiniEngagementBarProps {
  /** Current engagement score */
  score: number;
  /** Maximum expected score (for scaling) */
  maxScore?: number;
  /** Additional CSS classes */
  className?: string;
}

export const MiniEngagementBar = memo(function MiniEngagementBar({
  score,
  maxScore = 100,
  className,
}: MiniEngagementBarProps) {
  const percentage = Math.min((score / maxScore) * 100, 100);

  // Color based on engagement level
  const getColor = () => {
    if (score >= 100) return "bg-orange-500"; // Hot
    if (score >= 50) return "bg-yellow-500"; // Popular
    if (score >= 10) return "bg-green-500"; // Engaging
    return "bg-gray-400"; // Low
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", getColor())}
          style={{ width: `${Math.max(percentage, score > 0 ? 5 : 0)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground min-w-[2rem]">
        {score}
      </span>
    </div>
  );
});
