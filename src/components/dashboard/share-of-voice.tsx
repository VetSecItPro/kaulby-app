"use client";

import { memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Info, TrendingUp, TrendingDown, Minus, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandMentions {
  name: string;
  mentions: number;
  previousMentions?: number;
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  color?: string;
}

interface ShareOfVoiceProps {
  /** Your brand data */
  yourBrand: BrandMentions;
  /** Competitor data */
  competitors: BrandMentions[];
  /** Time period label */
  period?: string;
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Custom class name */
  className?: string;
}

// Default colors for competitors
const COLORS = [
  "hsl(var(--chart-5))",  // Your brand - indigo
  "hsl(var(--warning))",  // Orange
  "hsl(var(--success))",  // Green
  "hsl(var(--chart-3))",  // Yellow
  "hsl(var(--chart-2))",  // Pink
  "hsl(var(--chart-1))",  // Purple
  "hsl(var(--primary))",  // Teal
];

/**
 * Calculate percentage and trend
 */
function calculateStats(current: number, previous?: number, total?: number) {
  const percentage = total && total > 0 ? (current / total) * 100 : 0;
  const trend = previous !== undefined && previous > 0
    ? ((current - previous) / previous) * 100
    : undefined;

  return { percentage, trend };
}

/**
 * Share of Voice Bar - Horizontal stacked bar showing distribution
 */
const ShareOfVoiceBar = memo(function ShareOfVoiceBar({
  brands,
  total,
}: {
  brands: (BrandMentions & { color: string })[];
  total: number;
}) {
  return (
    <div className="w-full h-8 rounded-full overflow-hidden flex bg-muted">
      {brands.map((brand) => {
        const width = total > 0 ? (brand.mentions / total) * 100 : 0;
        if (width < 1) return null; // Don't show tiny segments

        return (
          <Popover key={brand.name}>
            <PopoverTrigger asChild>
              <div
                className="h-full cursor-pointer transition-opacity hover:opacity-80 first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${width}%`,
                  backgroundColor: brand.color,
                  minWidth: width > 0 ? "4px" : "0",
                }}
              />
            </PopoverTrigger>
            <PopoverContent side="top" className="w-48 p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  <span className="font-medium">{brand.name}</span>
                </div>
                <div className="text-2xl font-bold">{brand.mentions.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">
                  {width.toFixed(1)}% share of voice
                </div>
                {brand.sentiment && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-green-600">+{brand.sentiment.positive}</span>
                    <span className="text-gray-500">{brand.sentiment.neutral}</span>
                    <span className="text-red-600">-{brand.sentiment.negative}</span>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
});

/**
 * Brand Row - Individual brand stats
 */
const BrandRow = memo(function BrandRow({
  brand,
  total,
  isYourBrand,
}: {
  brand: BrandMentions & { color: string };
  total: number;
  isYourBrand?: boolean;
}) {
  const { percentage, trend } = calculateStats(brand.mentions, brand.previousMentions, total);

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: brand.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", isYourBrand && "text-primary")}>
            {brand.name}
          </span>
          {isYourBrand && (
            <Badge variant="outline" className="text-[10px] h-4">
              You
            </Badge>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold">{percentage.toFixed(1)}%</div>
        <div className="text-xs text-muted-foreground">
          {brand.mentions.toLocaleString()} mentions
        </div>
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-0.5 text-xs shrink-0 w-14",
          trend > 0 && "text-green-600",
          trend < 0 && "text-red-600",
          trend === 0 && "text-muted-foreground"
        )}>
          {trend > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : trend < 0 ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          <span>{trend > 0 ? "+" : ""}{trend.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
});

/**
 * Share of Voice Dashboard Component
 *
 * Shows brand mention distribution compared to competitors.
 * Key enterprise feature from Brand24/Awario.
 */
export const ShareOfVoice = memo(function ShareOfVoice({
  yourBrand,
  competitors,
  period = "Last 30 days",
  showDetails = true,
  className,
}: ShareOfVoiceProps) {
  // Combine all brands with colors
  const allBrands = useMemo(() => {
    const brands: (BrandMentions & { color: string })[] = [
      { ...yourBrand, color: yourBrand.color || COLORS[0] },
      ...competitors.map((c, i) => ({
        ...c,
        color: c.color || COLORS[(i + 1) % COLORS.length],
      })),
    ];
    return brands.sort((a, b) => b.mentions - a.mentions);
  }, [yourBrand, competitors]);

  const total = useMemo(
    () => allBrands.reduce((sum, b) => sum + b.mentions, 0),
    [allBrands]
  );

  const yourStats = calculateStats(yourBrand.mentions, yourBrand.previousMentions, total);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Share of Voice</CardTitle>
          </div>
          <Popover>
            <PopoverTrigger>
              <Info className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
            </PopoverTrigger>
            <PopoverContent side="left" className="w-64 text-sm">
              <p className="font-medium mb-1">What is Share of Voice?</p>
              <p className="text-muted-foreground">
                Share of Voice shows how your brand&apos;s online presence compares to competitors.
                A higher percentage means more visibility in conversations.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <CardDescription>{period}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Total mentions */}
        <div className="text-center py-2">
          <div className="text-3xl font-bold">{total.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Mentions</div>
        </div>

        {/* Your brand highlight */}
        <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Your Share</div>
              <div className="text-2xl font-bold text-primary">
                {yourStats.percentage.toFixed(1)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">{yourBrand.name}</div>
              <div className="font-semibold">{yourBrand.mentions.toLocaleString()} mentions</div>
            </div>
            {yourStats.trend !== undefined && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                yourStats.trend > 0 && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                yourStats.trend < 0 && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                yourStats.trend === 0 && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
              )}>
                {yourStats.trend > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : yourStats.trend < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                {yourStats.trend > 0 ? "+" : ""}{yourStats.trend.toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        {/* Visual bar */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Distribution</div>
          <ShareOfVoiceBar brands={allBrands} total={total} />
        </div>

        {/* Detailed breakdown */}
        {showDetails && (
          <div className="space-y-1 pt-2 border-t">
            <div className="text-sm font-medium text-muted-foreground mb-2">Breakdown</div>
            {allBrands.map((brand) => (
              <BrandRow
                key={brand.name}
                brand={brand}
                total={total}
                isYourBrand={brand.name === yourBrand.name}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

/**
 * Compact Share of Voice Widget
 */
export const ShareOfVoiceCompact = memo(function ShareOfVoiceCompact({
  yourBrand,
  competitors,
  className,
}: Omit<ShareOfVoiceProps, "showDetails" | "period">) {
  const total = yourBrand.mentions + competitors.reduce((sum, c) => sum + c.mentions, 0);
  const yourPercentage = total > 0 ? (yourBrand.mentions / total) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <PieChart className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">Share of Voice</div>
        <div className="text-xs text-muted-foreground">
          {yourBrand.mentions.toLocaleString()} of {total.toLocaleString()} mentions
        </div>
      </div>
      <div className="text-xl font-bold text-primary">
        {yourPercentage.toFixed(0)}%
      </div>
    </div>
  );
});
