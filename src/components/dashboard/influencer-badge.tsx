"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Crown, Star, User, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InfluenceScore } from "@/lib/author-influence";

interface InfluencerBadgeProps {
  score: InfluenceScore;
  showScore?: boolean;
  showTooltip?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const tierConfig = {
  influencer: {
    label: "Influencer",
    icon: Crown,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    description: "High-impact voice in the community",
  },
  established: {
    label: "Established",
    icon: Star,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    description: "Experienced community member",
  },
  active: {
    label: "Active",
    icon: UserCheck,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    description: "Regular contributor",
  },
  new: {
    label: "New",
    icon: User,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    description: "New or occasional poster",
  },
};

export function InfluencerBadge({
  score,
  showScore = false,
  showTooltip = true,
  size = "sm",
  className,
}: InfluencerBadgeProps) {
  const config = tierConfig[score.tier];
  const Icon = config.icon;

  // Don't show badge for new/low-influence users unless explicitly requested
  if (score.tier === "new" && !showScore) {
    return null;
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-normal",
        config.bgColor,
        config.borderColor,
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
    >
      <Icon className={cn("shrink-0", config.color, size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {showScore ? (
        <span className={config.color}>{score.total}</span>
      ) : (
        <span className={config.color}>{config.label}</span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{config.label}</span>
              <span className="text-muted-foreground">{score.total}/100</span>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reputation</span>
                <span>{score.factors.karma}/30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age</span>
                <span>{score.factors.accountAge}/20</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Engagement</span>
                <span>{score.factors.engagement}/30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activity</span>
                <span>{score.factors.activity}/20</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version for use in lists
 */
export function InfluencerIndicator({
  tier,
  className,
}: {
  tier: InfluenceScore["tier"];
  className?: string;
}) {
  if (tier === "new") return null;

  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Icon className={cn("h-3.5 w-3.5 shrink-0", config.color, className)} />
        </TooltipTrigger>
        <TooltipContent side="top">
          <span>{config.label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Score bar visualization
 */
export function InfluenceScoreBar({
  score,
  showLabel = true,
  className,
}: {
  score: number;
  showLabel?: boolean;
  className?: string;
}) {
  const tier =
    score >= 70 ? "influencer" : score >= 50 ? "established" : score >= 25 ? "active" : "new";
  const config = tierConfig[tier];

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Influence</span>
          <span className={config.color}>{score}/100</span>
        </div>
      )}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", config.bgColor.replace("/10", ""))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
