"use client";

import { useState, useTransition } from "react";
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

const sentimentIcons = {
  positive: <ThumbsUp className="h-4 w-4 text-green-500" />,
  negative: <ThumbsDown className="h-4 w-4 text-red-500" />,
  neutral: <Minus className="h-4 w-4 text-gray-500" />,
};


export function ResultCard({ result, showHidden = false, isAiBlurred = false }: ResultCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(result.isSaved);
  const [isHidden, setIsHidden] = useState(result.isHidden);
  const [isViewed, setIsViewed] = useState(result.isViewed);

  // Hide card if hidden and not showing hidden
  if (isHidden && !showHidden) {
    return null;
  }

  const handleClick = () => {
    startTransition(async () => {
      await markResultClicked(result.id);
      setIsViewed(true);
    });
  };

  const handleView = () => {
    if (!isViewed) {
      startTransition(async () => {
        await markResultViewed(result.id);
        setIsViewed(true);
      });
    }
  };

  const handleToggleSaved = () => {
    startTransition(async () => {
      const response = await toggleResultSaved(result.id);
      if (response.success) {
        setIsSaved(response.isSaved ?? !isSaved);
      }
    });
  };

  const handleToggleHidden = () => {
    startTransition(async () => {
      const response = await toggleResultHidden(result.id);
      if (response.success) {
        setIsHidden(response.isHidden ?? !isHidden);
      }
    });
  };

  const formatCategory = (category: string) => {
    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
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
              {result.painPointCategory && (
                <Badge variant="secondary" className="text-xs">
                  {formatCategory(result.painPointCategory)}
                </Badge>
              )}
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
              title={isSaved ? "Unsave" : "Save"}
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
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
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
  );
}

interface ResultsFilterBarProps {
  totalCount: number;
  unviewedCount: number;
  savedCount: number;
  hiddenCount: number;
  filter: "all" | "unread" | "saved" | "hidden";
  onFilterChange: (filter: "all" | "unread" | "saved" | "hidden") => void;
  onMarkAllRead?: () => void;
  isPending?: boolean;
}

export function ResultsFilterBar({
  totalCount,
  unviewedCount,
  savedCount,
  hiddenCount,
  filter,
  onFilterChange,
  onMarkAllRead,
  isPending,
}: ResultsFilterBarProps) {
  return (
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
  );
}
