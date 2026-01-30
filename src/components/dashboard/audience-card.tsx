"use client";

import { memo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, MessageSquare, TrendingUp, TrendingDown } from "lucide-react";
import { getPlatformDisplayName, getPlatformBadgeColor } from "@/lib/platform-utils";
import { cn } from "@/lib/utils";

/**
 * Stats for an audience card
 * These are calculated server-side for performance
 */
export interface AudienceStats {
  /** Total mentions across all monitors in the last period */
  totalMentions: number;
  /** Percentage change from previous period */
  mentionChange: number;
  /** Daily mention counts for sparkline (last 7 days) */
  dailyMentions: number[];
  /** Platforms being monitored */
  platforms: string[];
  /** Sentiment breakdown */
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  /** Monitor count */
  monitorCount: number;
}

interface AudienceCardProps {
  /** Audience ID */
  id: string;
  /** Audience name */
  name: string;
  /** Audience description */
  description?: string | null;
  /** Audience color */
  color?: string | null;
  /** Stats for the card */
  stats: AudienceStats;
  /** Called when delete is requested */
  onDeleteRequest?: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Platform icons row
 * Shows up to 4 platform badges, then "+N more"
 */
const PlatformIcons = memo(function PlatformIcons({
  platforms,
  maxVisible = 4,
}: {
  platforms: string[];
  maxVisible?: number;
}) {
  const visible = platforms.slice(0, maxVisible);
  const remaining = platforms.length - maxVisible;

  if (platforms.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No platforms selected</span>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((platform) => (
        <Badge
          key={platform}
          variant="secondary"
          className={cn(
            "text-[10px] px-1.5 py-0 h-5",
            getPlatformBadgeColor(platform, "light")
          )}
        >
          {getPlatformDisplayName(platform)}
        </Badge>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground ml-1">
          +{remaining}
        </span>
      )}
    </div>
  );
});

/**
 * Sentiment bar - compact horizontal visualization
 */
const SentimentBar = memo(function SentimentBar({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const total = positive + neutral + negative;

  if (total === 0) {
    return (
      <div className="h-1.5 w-full rounded-full bg-muted" />
    );
  }

  const positivePercent = (positive / total) * 100;
  const neutralPercent = (neutral / total) * 100;
  const negativePercent = (negative / total) * 100;

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full overflow-hidden flex">
        {positivePercent > 0 && (
          <div
            className="bg-green-500 h-full transition-all"
            style={{ width: `${positivePercent}%` }}
          />
        )}
        {neutralPercent > 0 && (
          <div
            className="bg-gray-400 h-full transition-all"
            style={{ width: `${neutralPercent}%` }}
          />
        )}
        {negativePercent > 0 && (
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${negativePercent}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="text-green-600 dark:text-green-400">
          {positivePercent.toFixed(0)}% positive
        </span>
        <span className="text-red-600 dark:text-red-400">
          {negativePercent.toFixed(0)}% negative
        </span>
      </div>
    </div>
  );
});

/**
 * Enhanced Audience Card
 *
 * Displays audience information with:
 * - Big metric: total mentions with trend
 * - 7-day sparkline showing activity pattern
 * - Platform badges showing coverage
 * - Sentiment breakdown bar
 *
 * Designed to work across all 16 platforms, not just Reddit.
 */
export const AudienceCard = memo(function AudienceCard({
  id,
  name,
  description,
  color,
  stats,
  onDeleteRequest,
  className,
}: AudienceCardProps) {
  return (
    <Card
      className={cn(
        "group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative overflow-hidden",
        className
      )}
    >
      {/* Color accent bar at top */}
      {color && (
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: color }}
        />
      )}

      <Link href={`/dashboard/audiences/${id}`} className="block">
        <CardHeader className={cn("pb-3", color && "pt-4")}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {color && (
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}
              <h3 className="font-semibold text-lg truncate">{name}</h3>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/audiences/${id}/edit`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    onDeleteRequest?.(id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
              {description}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Main metric: Mentions with trend */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">
                  {stats.totalMentions.toLocaleString()}
                </span>
                {stats.mentionChange !== 0 && (
                  <span className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    stats.mentionChange > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {stats.mentionChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(stats.mentionChange)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MessageSquare className="h-3 w-3" />
                <span>mentions this week</span>
              </div>
            </div>
          </div>

          {/* Platform coverage */}
          <div className="pt-2 border-t">
            <PlatformIcons platforms={stats.platforms} />
          </div>

          {/* Sentiment breakdown */}
          <SentimentBar
            positive={stats.sentiment.positive}
            neutral={stats.sentiment.neutral}
            negative={stats.sentiment.negative}
          />

          {/* Monitor count footer */}
          <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
            <span>{stats.monitorCount} monitor{stats.monitorCount !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              View details
              <TrendingUp className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
});

/**
 * Empty state card for new audiences
 */
export const NewAudienceCard = memo(function NewAudienceCard({
  className,
}: {
  className?: string;
}) {
  return (
    <Link href="/dashboard/audiences/new">
      <Card
        className={cn(
          "border-dashed hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer h-full min-h-[280px] flex items-center justify-center",
          className
        )}
      >
        <CardContent className="flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <span className="text-2xl text-primary">+</span>
          </div>
          <h3 className="font-semibold mb-1">Create Audience</h3>
          <p className="text-sm text-muted-foreground">
            Group monitors to track customer segments
          </p>
        </CardContent>
      </Card>
    </Link>
  );
});
