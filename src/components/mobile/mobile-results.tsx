"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Filter,
  CheckCheck
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { markAllResultsViewed } from "@/app/(dashboard)/dashboard/results/actions";
import { getPlatformBadgeColor, getSentimentBadgeColor } from "@/lib/platform-utils";

interface Result {
  id: string;
  platform: "reddit" | "hackernews" | "producthunt" | "devto" | "twitter";
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
  monitor: { name: string } | null;
}

interface MobileResultsProps {
  results: Result[];
  totalCount: number;
  page: number;
  totalPages: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};


export function MobileResults({ results, totalCount, page, totalPages }: MobileResultsProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "saved" | "hidden">("all");
  const [isPending, startTransition] = useTransition();
  const [allMarkedRead, setAllMarkedRead] = useState(false);

  const unviewedCount = results.filter((r) => !r.isViewed && !allMarkedRead).length;
  const savedCount = results.filter((r) => r.isSaved).length;

  const filteredResults = results.filter((result) => {
    switch (filter) {
      case "unread":
        return !result.isViewed && !allMarkedRead && !result.isHidden;
      case "saved":
        return result.isSaved && !result.isHidden;
      case "hidden":
        return result.isHidden;
      case "all":
      default:
        return !result.isHidden;
    }
  });

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllResultsViewed();
      setAllMarkedRead(true);
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="text-muted-foreground text-sm">
            {totalCount} mentions found
          </p>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {filter === "all" && "All"}
              {filter === "unread" && `Unread (${unviewedCount})`}
              {filter === "saved" && `Saved (${savedCount})`}
              {filter === "hidden" && "Hidden"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilter("all")}>
              All results
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("unread")}>
              Unread ({unviewedCount})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("saved")}>
              Saved ({savedCount})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("hidden")}>
              Hidden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {unviewedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </motion.div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No results</h3>
              <p className="text-sm text-muted-foreground">
                {filter === "unread" && "All caught up!"}
                {filter === "saved" && "No saved results yet"}
                {filter === "hidden" && "No hidden results"}
                {filter === "all" && "No results found yet"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {filteredResults.map((result) => (
              <motion.div
                key={result.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <MobileResultCard result={result} allMarkedRead={allMarkedRead} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div variants={itemVariants} className="flex justify-center gap-2 pt-4">
          {page > 1 && (
            <Link href={`/dashboard/results?page=${page - 1}`}>
              <Button variant="outline" size="sm">Previous</Button>
            </Link>
          )}
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/dashboard/results?page=${page + 1}`}>
              <Button variant="outline" size="sm">Next</Button>
            </Link>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function MobileResultCard({ result, allMarkedRead }: { result: Result; allMarkedRead: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUnread = !result.isViewed && !allMarkedRead;

  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Card className={`overflow-hidden ${isUnread ? "border-primary/50" : ""}`}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`p-2 rounded-full shrink-0 ${getPlatformBadgeColor(result.platform)}`}>
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="capitalize text-xs">
                  {result.platform}
                </Badge>
                {result.sentiment && (
                  <Badge className={`text-xs ${getSentimentBadgeColor(result.sentiment)}`}>
                    {result.sentiment}
                  </Badge>
                )}
                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <h3 className="font-medium text-sm line-clamp-2">{result.title}</h3>
            </div>
          </div>

          {/* Content Preview */}
          {result.aiSummary && (
            <div className="mb-3">
              <p className={`text-sm text-muted-foreground ${isExpanded ? "" : "line-clamp-3"}`}>
                {result.aiSummary}
              </p>
              {result.aiSummary.length > 150 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-primary mt-1"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {result.author && <span>@{result.author}</span>}
              {result.postedAt && (
                <span>
                  {new Date(result.postedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {result.monitor && (
              <Badge variant="secondary" className="text-xs">
                {result.monitor.name}
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="outline" size="sm" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                View
              </Button>
            </a>
            <Button variant="ghost" size="icon" className="shrink-0">
              {result.isSaved ? (
                <BookmarkCheck className="h-4 w-4 text-primary" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
