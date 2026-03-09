"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, X } from "lucide-react";
import { getPlatformDisplayName } from "@/lib/platform-utils";

interface ResultsFiltersProps {
  /** Platforms this monitor is configured for */
  platforms: string[];
  /** Currently active platform filter */
  activePlatform: string | null;
  /** Currently active time range */
  activeTimeRange: string | null;
  /** Current sort order */
  sortOrder: "desc" | "asc";
}

const TIME_RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 3 months" },
  { value: "180d", label: "Last 6 months" },
  { value: "365d", label: "Last year" },
] as const;

export function ResultsFilters({
  platforms,
  activePlatform,
  activeTimeRange,
  sortOrder,
}: ResultsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset to page 1 when filters change
      params.delete("page");

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasActiveFilters = activePlatform || activeTimeRange;

  const clearFilters = () => {
    const params = new URLSearchParams();
    router.push(pathname);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">

      {/* Platform filter — only show if monitor has 2+ platforms */}
      {platforms.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={activePlatform === null ? "default" : "outline"}
            size="sm"
            className={
              activePlatform === null
                ? "h-7 text-xs bg-teal-500 text-black hover:bg-teal-600"
                : "h-7 text-xs"
            }
            onClick={() => updateParams({ platform: null })}
          >
            All
          </Button>
          {platforms.map((platform) => (
            <Button
              key={platform}
              variant={activePlatform === platform ? "default" : "outline"}
              size="sm"
              className={
                activePlatform === platform
                  ? "h-7 text-xs bg-teal-500 text-black hover:bg-teal-600"
                  : "h-7 text-xs"
              }
              onClick={() =>
                updateParams({
                  platform: activePlatform === platform ? null : platform,
                })
              }
            >
              {getPlatformDisplayName(platform)}
            </Button>
          ))}
        </div>
      )}

      {/* Separator */}
      {platforms.length > 1 && (
        <div className="h-5 w-px bg-border hidden sm:block" />
      )}

      {/* Time range filter */}
      <Select
        value={activeTimeRange || "all"}
        onValueChange={(value) =>
          updateParams({ time: value === "all" ? null : value })
        }
      >
        <SelectTrigger className="h-7 w-[140px] text-xs">
          <SelectValue placeholder="Time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          {TIME_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort order toggle */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() =>
          updateParams({ sort: sortOrder === "desc" ? "asc" : "desc" })
        }
      >
        <ArrowUpDown className="h-3 w-3" />
        {sortOrder === "desc" ? "Newest first" : "Oldest first"}
      </Button>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={clearFilters}
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
