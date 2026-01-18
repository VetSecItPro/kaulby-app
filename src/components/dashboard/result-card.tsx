"use client";

import { useState, useTransition, memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Bookmark,
  BookmarkCheck,
  EyeOff,
  Eye,
  MoreHorizontal,
  Check,
  Loader2,
  Target,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markResultViewed,
  markResultClicked,
  toggleResultSaved,
  toggleResultHidden,
} from "@/app/(dashboard)/dashboard/results/actions";
import { getPlatformBadgeColor } from "@/lib/platform-utils";
import { BlurredAiAnalysis } from "./upgrade-prompt";

type ConversationCategory = "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion";

interface ResultCardProps {
  result: {
    id: string;
    platform: string;
    sourceUrl: string;
    title: string;
    content: string | null;
    author: string | null;
    postedAt: Date | null;
    sentiment: "positive" | "negative" | "neutral" | null;
    painPointCategory: string | null;
    conversationCategory: ConversationCategory | null;
    aiSummary: string | null;
    isViewed: boolean;
    isClicked: boolean;
    isSaved: boolean;
    isHidden: boolean;
    monitor?: { name: string } | null;
  };
  showHidden?: boolean;
  isAiBlurred?: boolean;
}

// Conversation category styling - these are the high-value ***-style categories
// Using Lucide icons for professional B2B appearance
const conversationCategoryStyles: Record<ConversationCategory, { bg: string; text: string; label: string; Icon: typeof Target }> = {
  solution_request: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "Looking for Solution", Icon: Target },
  money_talk: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "Budget Talk", Icon: DollarSign },
  pain_point: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Pain Point", Icon: AlertTriangle },
  advice_request: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Seeking Advice", Icon: HelpCircle },
  hot_discussion: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", label: "Trending", Icon: TrendingUp },
};

const sentimentIcons = {
  positive: <ThumbsUp className="h-4 w-4 text-green-500" />,
  negative: <ThumbsDown className="h-4 w-4 text-red-500" />,
  neutral: <Minus className="h-4 w-4 text-gray-500" />,
};

// Memoize to prevent re-renders when parent updates but props haven't changed
export const ResultCard = memo(function ResultCard({ result, showHidden = false, isAiBlurred = false }: ResultCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(result.isSaved);
  const [isHidden, setIsHidden] = useState(result.isHidden);
  const [isViewed, setIsViewed] = useState(result.isViewed);

  // All hooks must be called before any conditional returns
  const handleClick = useCallback(() => {
    startTransition(async () => {
      await markResultClicked(result.id);
      setIsViewed(true);
    });
  }, [result.id]);

  const handleView = useCallback(() => {
    if (!isViewed) {
      startTransition(async () => {
        await markResultViewed(result.id);
        setIsViewed(true);
      });
    }
  }, [result.id, isViewed]);

  const handleToggleSaved = useCallback(() => {
    startTransition(async () => {
      const response = await toggleResultSaved(result.id);
      if (response.success) {
        setIsSaved(response.isSaved ?? !isSaved);
      }
    });
  }, [result.id, isSaved]);

  const handleToggleHidden = useCallback(() => {
    startTransition(async () => {
      const response = await toggleResultHidden(result.id);
      if (response.success) {
        setIsHidden(response.isHidden ?? !isHidden);
      }
    });
  }, [result.id, isHidden]);

  // Hide card if hidden and not showing hidden (after all hooks)
  if (isHidden && !showHidden) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2 },
      }}
    >
      <Card
        className={cn(
          "transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5",
          !isViewed && "border-l-4 border-l-primary bg-primary/5",
          isHidden && "opacity-60"
        )}
        onMouseEnter={handleView}
      >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn("capitalize", getPlatformBadgeColor(result.platform, "light"))}
              >
                {result.platform}
              </Badge>
              {result.sentiment && sentimentIcons[result.sentiment]}
              {/* Conversation Category Badge - ***-style high-value classification */}
              {result.conversationCategory && conversationCategoryStyles[result.conversationCategory] && (() => {
                const { Icon, bg, text, label } = conversationCategoryStyles[result.conversationCategory];
                return (
                  <Badge
                    variant="secondary"
                    className={cn("text-xs font-medium gap-1", bg, text)}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </Badge>
                );
              })()}
              {!isViewed && (
                <Badge variant="default" className="text-xs bg-primary">
                  New
                </Badge>
              )}
              {isSaved && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                  <BookmarkCheck className="h-3 w-3 mr-1" />
                  Saved
                </Badge>
              )}
            </div>
            <CardTitle className="text-base line-clamp-2">
              {result.title}
            </CardTitle>
            <CardDescription className="text-xs">
              From monitor: {result.monitor?.name || "Unknown"}
              {result.author && ` • by ${result.author}`}
              {result.postedAt && ` • ${new Date(result.postedAt).toLocaleDateString()}`}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Save button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleSaved}
              disabled={isPending}
              className={cn(
                "h-8 w-8",
                isSaved && "text-amber-500 hover:text-amber-600"
              )}
              aria-label={isSaved ? "Remove from saved" : "Save result"}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSaved ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>

            {/* View Source button */}
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
            >
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-3 w-3" />
                View
              </Button>
            </a>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleToggleSaved}>
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 mr-2" />
                      Unsave
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </DropdownMenuItem>
                {!isViewed && (
                  <DropdownMenuItem onClick={handleView}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark as read
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleToggleHidden}>
                  {isHidden ? (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show result
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide result
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {(result.content || result.aiSummary) && (
        <CardContent className="pt-0">
          {isAiBlurred && result.aiSummary ? (
            <BlurredAiAnalysis
              aiSummary={result.aiSummary}
              sentiment={result.sentiment || undefined}
              painPointCategory={result.painPointCategory || undefined}
            />
          ) : result.aiSummary ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">AI Summary:</p>
              <p className="text-sm">{result.aiSummary}</p>
            </div>
          ) : result.content ? (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {result.content}
            </p>
          ) : null}
        </CardContent>
      )}
      </Card>
    </motion.div>
  );
});

interface ResultsFilterBarProps {
  totalCount: number;
  unviewedCount: number;
  savedCount: number;
  hiddenCount: number;
  filter: "all" | "unread" | "saved" | "hidden";
  onFilterChange: (filter: "all" | "unread" | "saved" | "hidden") => void;
  categoryFilter: ConversationCategory | null;
  onCategoryFilterChange: (category: ConversationCategory | null) => void;
  categoryCounts: Record<ConversationCategory, number>;
  onMarkAllRead?: () => void;
  isPending?: boolean;
}

// Category filter chips - ***-style quick filtering
const categoryFilterOptions: { key: ConversationCategory; label: string; Icon: typeof Target }[] = [
  { key: "solution_request", label: "Solutions", Icon: Target },
  { key: "money_talk", label: "Budget", Icon: DollarSign },
  { key: "pain_point", label: "Pain Points", Icon: AlertTriangle },
  { key: "advice_request", label: "Advice", Icon: HelpCircle },
  { key: "hot_discussion", label: "Trending", Icon: TrendingUp },
];

// Memoize filter bar - pure presentational component
export const ResultsFilterBar = memo(function ResultsFilterBar({
  totalCount,
  unviewedCount,
  savedCount,
  hiddenCount,
  filter,
  onFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categoryCounts,
  onMarkAllRead,
  isPending,
}: ResultsFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Primary filters (All, Unread, Saved, Hidden) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange("all")}
          >
            All
            <Badge variant="secondary" className="ml-1.5">
              {totalCount}
            </Badge>
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange("unread")}
          >
            Unread
            {unviewedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 bg-primary text-primary-foreground">
                {unviewedCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={filter === "saved" ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange("saved")}
          >
            Saved
            {savedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {savedCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={filter === "hidden" ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange("hidden")}
          >
            Hidden
            {hiddenCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {hiddenCount}
              </Badge>
            )}
          </Button>
        </div>

        {unviewedCount > 0 && onMarkAllRead && (
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkAllRead}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Mark all as read
          </Button>
        )}
      </div>

      {/* Category filter chips - ***-style */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Filter by type:</span>
        {categoryFilterOptions.map(({ key, label, Icon }) => {
          const count = categoryCounts[key] || 0;
          const isActive = categoryFilter === key;
          const style = conversationCategoryStyles[key];

          return (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => onCategoryFilterChange(isActive ? null : key)}
              className={cn(
                "h-7 px-2 text-xs gap-1 transition-all",
                isActive && cn(style.bg, style.text, "hover:opacity-90"),
                !isActive && count === 0 && "opacity-50"
              )}
              disabled={count === 0 && !isActive}
            >
              <Icon className="h-3 w-3" />
              {label}
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1 h-4 px-1 text-[10px]",
                    isActive && "bg-white/20 text-current"
                  )}
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
        {categoryFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCategoryFilterChange(null)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filter
          </Button>
        )}
      </div>
    </div>
  );
});
