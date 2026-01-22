"use client";

import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Flame, Star, Snowflake, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateLeadScore,
  type LeadScoreInput,
  type LeadScoreFactors,
} from "@/lib/ai/lead-scoring";

interface LeadScoreBadgeProps {
  /** Pre-calculated score (0-100) */
  score?: number | null;
  /** Pre-calculated factors breakdown */
  factors?: LeadScoreFactors | null;
  /** OR provide input to calculate on the fly */
  input?: LeadScoreInput;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show tooltip with breakdown */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get icon and styling based on score
 */
function getScoreDisplay(score: number) {
  if (score >= 70) {
    return {
      Icon: Flame,
      label: "Hot Lead",
      bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
      textColor: "text-orange-600 dark:text-orange-400",
      borderColor: "border-orange-500/30",
      iconColor: "text-orange-500",
    };
  } else if (score >= 50) {
    return {
      Icon: Star,
      label: "Warm Lead",
      bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
      textColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-500/30",
      iconColor: "text-amber-500",
    };
  } else if (score >= 30) {
    return {
      Icon: Snowflake,
      label: "Cool Lead",
      bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
      textColor: "text-blue-600 dark:text-blue-400",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-500",
    };
  } else {
    return {
      Icon: Moon,
      label: "Cold",
      bgColor: "bg-gray-500/10 hover:bg-gray-500/20",
      textColor: "text-gray-600 dark:text-gray-400",
      borderColor: "border-gray-500/30",
      iconColor: "text-gray-400",
    };
  }
}

/**
 * Factor breakdown bar
 */
function FactorBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percentage = (value / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/{max}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Lead Score Badge Component
 *
 * Displays a visual indicator of lead quality (Hot, Warm, Cool, Cold)
 * with optional tooltip showing the breakdown of scoring factors.
 */
export const LeadScoreBadge = memo(function LeadScoreBadge({
  score: providedScore,
  factors: providedFactors,
  input,
  size = "md",
  showTooltip = true,
  className,
}: LeadScoreBadgeProps) {
  // Calculate score if not provided
  const { score, factors } = useMemo(() => {
    if (providedScore !== null && providedScore !== undefined) {
      return { score: providedScore, factors: providedFactors };
    }
    if (input) {
      const calculated = calculateLeadScore(input);
      return { score: calculated.total, factors: calculated };
    }
    return { score: null, factors: null };
  }, [providedScore, providedFactors, input]);

  // Don't render if no score
  if (score === null || score === undefined) {
    return null;
  }

  const display = getScoreDisplay(score);
  const { Icon } = display;

  const sizes = {
    sm: {
      badge: "h-5 text-[10px] px-1.5 gap-0.5",
      icon: "h-3 w-3",
    },
    md: {
      badge: "h-6 text-xs px-2 gap-1",
      icon: "h-3.5 w-3.5",
    },
    lg: {
      badge: "h-7 text-sm px-2.5 gap-1.5",
      icon: "h-4 w-4",
    },
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-medium transition-colors cursor-default",
        display.bgColor,
        display.textColor,
        display.borderColor,
        sizes[size].badge,
        className
      )}
    >
      <Icon className={cn(sizes[size].icon, display.iconColor)} />
      <span>{score}</span>
    </Badge>
  );

  if (!showTooltip || !factors) {
    return badge;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent side="top" className="w-56 p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon className={cn("h-4 w-4", display.iconColor)} />
              <span className="font-semibold">{display.label}</span>
            </div>
            <span className="text-lg font-bold">{score}</span>
          </div>

          <div className="space-y-2">
            <FactorBar
              label="Intent Signals"
              value={factors.intent}
              max={40}
              color="bg-green-500"
            />
            <FactorBar
              label="Engagement"
              value={factors.engagement}
              max={20}
              color="bg-blue-500"
            />
            <FactorBar
              label="Recency"
              value={factors.recency}
              max={15}
              color="bg-purple-500"
            />
            <FactorBar
              label="Author Quality"
              value={factors.authorQuality}
              max={15}
              color="bg-amber-500"
            />
            <FactorBar
              label="Category"
              value={factors.category}
              max={10}
              color="bg-pink-500"
            />
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Higher scores indicate stronger buying intent
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
});

/**
 * Compact inline lead score (just the number with icon)
 */
export const LeadScoreInline = memo(function LeadScoreInline({
  score,
  className,
}: {
  score: number | null | undefined;
  className?: string;
}) {
  if (score === null || score === undefined) return null;

  const display = getScoreDisplay(score);
  const { Icon } = display;

  return (
    <span className={cn("inline-flex items-center gap-0.5", display.textColor, className)}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">{score}</span>
    </span>
  );
});

/**
 * Lead score filter chips for results filtering
 */
interface LeadScoreFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

export const LeadScoreFilter = memo(function LeadScoreFilter({
  value,
  onChange,
  className,
}: LeadScoreFilterProps) {
  const filters = [
    { key: "hot", label: "Hot", min: 70, Icon: Flame, color: "text-orange-500" },
    { key: "warm", label: "Warm", min: 50, Icon: Star, color: "text-amber-500" },
    { key: "cool", label: "Cool", min: 30, Icon: Snowflake, color: "text-blue-500" },
    { key: "cold", label: "Cold", min: 0, Icon: Moon, color: "text-gray-400" },
  ];

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      <Badge
        variant={value === null ? "default" : "outline"}
        className="cursor-pointer"
        onClick={() => onChange(null)}
      >
        All
      </Badge>
      {filters.map(({ key, label, Icon, color }) => (
        <Badge
          key={key}
          variant={value === key ? "default" : "outline"}
          className={cn(
            "cursor-pointer gap-1",
            value !== key && "hover:bg-muted"
          )}
          onClick={() => onChange(value === key ? null : key)}
        >
          <Icon className={cn("h-3 w-3", value !== key && color)} />
          {label}
        </Badge>
      ))}
    </div>
  );
});
