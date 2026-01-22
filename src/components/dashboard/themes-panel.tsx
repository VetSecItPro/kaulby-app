"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Themes Panel - GummySearch-style quick access to conversation categories
 *
 * Shows theme cards with:
 * - Theme name and icon
 * - Result count
 * - Sample preview
 * - Quick filter action
 */

type ConversationCategory = "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion";

// Theme configuration matching GummySearch's categories
const themeConfig: Record<
  ConversationCategory,
  {
    label: string;
    description: string;
    Icon: typeof Target;
    color: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  solution_request: {
    label: "Looking for Solutions",
    description: "People actively seeking recommendations",
    Icon: Target,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-700 dark:text-green-300",
    borderColor: "border-green-200 dark:border-green-800",
  },
  money_talk: {
    label: "Budget Discussions",
    description: "Pricing, ROI, and budget conversations",
    Icon: DollarSign,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  pain_point: {
    label: "Pain Points",
    description: "Frustrations and problems to solve",
    Icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-300",
    borderColor: "border-red-200 dark:border-red-800",
  },
  advice_request: {
    label: "Seeking Advice",
    description: "How-to questions and guidance requests",
    Icon: HelpCircle,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  hot_discussion: {
    label: "Hot Discussions",
    description: "Trending threads with high engagement",
    Icon: TrendingUp,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
};

// Order for display (highest value first)
const themeOrder: ConversationCategory[] = [
  "solution_request",
  "money_talk",
  "pain_point",
  "advice_request",
  "hot_discussion",
];

interface ThemeData {
  category: ConversationCategory;
  count: number;
  sample?: {
    title: string;
    platform: string;
  };
}

interface ThemesPanelProps {
  /** Category counts from aggregations */
  categoryCounts: Record<string, number>;
  /** Sample results for previews (optional) */
  sampleResults?: Array<{
    conversationCategory: ConversationCategory | null;
    title: string;
    platform: string;
  }>;
  /** Currently selected category filter */
  selectedCategory?: ConversationCategory | null;
  /** Called when category is clicked */
  onCategoryClick?: (category: ConversationCategory | null) => void;
  /** Display mode: grid (default) or compact */
  variant?: "grid" | "compact" | "tabs";
  /** Additional CSS classes */
  className?: string;
}

export const ThemesPanel = memo(function ThemesPanel({
  categoryCounts,
  sampleResults = [],
  selectedCategory,
  onCategoryClick,
  variant = "grid",
  className,
}: ThemesPanelProps) {
  // Build theme data with counts and samples
  const themes: ThemeData[] = themeOrder.map((category) => {
    const sample = sampleResults.find((r) => r.conversationCategory === category);
    return {
      category,
      count: categoryCounts[category] || 0,
      sample: sample ? { title: sample.title, platform: sample.platform } : undefined,
    };
  });

  // Filter to only show themes with results (for compact view)
  const themesWithResults = themes.filter((t) => t.count > 0);
  const totalResults = Object.values(categoryCounts).reduce((sum, c) => sum + c, 0);

  if (variant === "tabs") {
    return (
      <div className={cn("flex items-center gap-1 flex-wrap", className)}>
        {themeOrder.map((category) => {
          const config = themeConfig[category];
          const count = categoryCounts[category] || 0;
          const isSelected = selectedCategory === category;

          return (
            <Button
              key={category}
              variant="ghost"
              size="sm"
              onClick={() => onCategoryClick?.(isSelected ? null : category)}
              className={cn(
                "h-8 px-3 gap-1.5 transition-all",
                isSelected && cn(config.bgColor, config.textColor),
                count === 0 && "opacity-50"
              )}
              disabled={count === 0}
            >
              <config.Icon className="h-3.5 w-3.5" />
              <span className="text-xs">{config.label.split(" ")[0]}</span>
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-4 px-1 text-[10px]",
                    isSelected && "bg-white/20 text-current"
                  )}
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
        {selectedCategory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCategoryClick?.(null)}
            className="h-8 px-2 text-xs text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="text-sm font-medium text-muted-foreground">
          Filter by Theme
        </div>
        <div className="flex flex-wrap gap-2">
          {themesWithResults.map((theme) => {
            const config = themeConfig[theme.category];
            const isSelected = selectedCategory === theme.category;

            return (
              <Button
                key={theme.category}
                variant="outline"
                size="sm"
                onClick={() => onCategoryClick?.(isSelected ? null : theme.category)}
                className={cn(
                  "h-7 gap-1.5 transition-all",
                  isSelected && cn(config.bgColor, config.borderColor, config.textColor),
                  !isSelected && "border-muted"
                )}
              >
                <config.Icon className={cn("h-3 w-3", isSelected ? "" : config.color)} />
                <span className="text-xs">{config.label.split(" ")[0]}</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-4 px-1 text-[10px]",
                    isSelected && "bg-white/20 text-current"
                  )}
                >
                  {theme.count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  // Grid variant (default) - full theme cards
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Themes</h3>
        <span className="text-xs text-muted-foreground">
          {totalResults} categorized results
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {themes.map((theme) => {
            const config = themeConfig[theme.category];
            const isSelected = selectedCategory === theme.category;
            const isEmpty = theme.count === 0;

            return (
              <motion.div
                key={theme.category}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    isSelected && cn(config.borderColor, "border-2", config.bgColor),
                    isEmpty && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (!isEmpty) {
                      onCategoryClick?.(isSelected ? null : theme.category);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "p-1.5 rounded-md",
                            isSelected ? config.bgColor : "bg-muted"
                          )}
                        >
                          <config.Icon
                            className={cn(
                              "h-4 w-4",
                              isSelected ? config.textColor : config.color
                            )}
                          />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">
                            {config.label}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {config.description}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={isSelected ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          isSelected && config.bgColor,
                          isSelected && config.textColor
                        )}
                      >
                        {theme.count}
                      </Badge>
                    </div>
                  </CardHeader>

                  {theme.sample && !isEmpty && (
                    <CardContent className="pt-0">
                      <div className="text-xs text-muted-foreground line-clamp-1 italic">
                        &quot;{theme.sample.title}&quot;
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {theme.sample.platform}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
});

/**
 * Loading state for themes panel
 */
export function ThemesPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="opacity-50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-muted animate-pulse" />
                <div className="space-y-1">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
