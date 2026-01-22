"use client";

import { memo, useState, useMemo } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

/**
 * Date Range Picker
 *
 * A simple date range picker with presets:
 * - Today
 * - Last 7 days
 * - Last 30 days
 * - Last 90 days
 * - Custom range
 */

type DatePreset = "today" | "7d" | "30d" | "90d" | "custom" | "all";

const presets: { key: DatePreset; label: string; days?: number }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "custom", label: "Custom" },
];

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  /** Current date range */
  value?: DateRange | null;
  /** Called when date range changes */
  onChange?: (range: DateRange | null) => void;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Get date range from preset
 */
function getPresetDateRange(preset: DatePreset): DateRange | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "all":
      return null;
    case "today":
      return { from: today, to: now };
    case "7d":
      return {
        from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
      };
    case "30d":
      return {
        from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
      };
    case "90d":
      return {
        from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
        to: now,
      };
    case "custom":
      return { from: null, to: null };
    default:
      return null;
  }
}

/**
 * Detect which preset matches the current date range
 */
function detectPreset(range: DateRange | null | undefined): DatePreset {
  if (!range || (!range.from && !range.to)) return "all";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check if "to" is roughly today/now
  const toIsNow = range.to && Math.abs(range.to.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;

  if (range.from && toIsNow) {
    const daysDiff = Math.round(
      (today.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysDiff <= 1) return "today";
    if (daysDiff >= 6 && daysDiff <= 8) return "7d";
    if (daysDiff >= 29 && daysDiff <= 31) return "30d";
    if (daysDiff >= 89 && daysDiff <= 91) return "90d";
  }

  return "custom";
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Format date range for display
 */
function formatDateRange(range: DateRange | null | undefined): string {
  if (!range || (!range.from && !range.to)) return "All time";

  const preset = detectPreset(range);
  const presetConfig = presets.find((p) => p.key === preset);

  if (preset !== "custom" && presetConfig) {
    return presetConfig.label;
  }

  if (range.from && range.to) {
    return `${formatDate(range.from)} - ${formatDate(range.to)}`;
  }

  if (range.from) {
    return `From ${formatDate(range.from)}`;
  }

  if (range.to) {
    return `Until ${formatDate(range.to)}`;
  }

  return "Select dates";
}

export const DateRangePicker = memo(function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const currentPreset = useMemo(() => detectPreset(value), [value]);
  const displayText = useMemo(() => formatDateRange(value), [value]);
  const hasValue = value && (value.from || value.to);

  const handlePresetClick = (preset: DatePreset) => {
    if (preset === "custom") {
      // Don't change value, just show custom inputs
      return;
    }

    const range = getPresetDateRange(preset);
    onChange?.(range);

    if (preset !== "all") {
      setIsOpen(false);
    }
  };

  const handleCustomApply = () => {
    let from: Date | null = null;
    let to: Date | null = null;

    if (customFrom) {
      from = new Date(customFrom);
      if (isNaN(from.getTime())) from = null;
    }

    if (customTo) {
      to = new Date(customTo);
      if (isNaN(to.getTime())) to = null;
    }

    if (from || to) {
      onChange?.({ from, to });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange?.(null);
    setCustomFrom("");
    setCustomTo("");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start gap-2 text-left font-normal",
            !hasValue && "text-muted-foreground",
            className
          )}
        >
          <Calendar className="h-4 w-4" />
          <span className="flex-1 truncate">{displayText}</span>
          {hasValue ? (
            <X
              className="h-3 w-3 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          ) : (
            <ChevronDown className="h-3 w-3 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          {/* Presets */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Quick select
            </div>
            <div className="grid grid-cols-2 gap-1">
              {presets
                .filter((p) => p.key !== "custom")
                .map((preset) => (
                  <Button
                    key={preset.key}
                    variant={currentPreset === preset.key ? "default" : "ghost"}
                    size="sm"
                    className="h-8 justify-start"
                    onClick={() => handlePresetClick(preset.key)}
                  >
                    {preset.label}
                  </Button>
                ))}
            </div>
          </div>

          {/* Custom range inputs */}
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground">
              Custom range
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full h-8"
              onClick={handleCustomApply}
              disabled={!customFrom && !customTo}
            >
              Apply custom range
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

/**
 * Compact version for tight spaces
 */
interface CompactDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | null) => void;
  className?: string;
}

export const CompactDateRangePicker = memo(function CompactDateRangePicker({
  value,
  onChange,
  className,
}: CompactDateRangePickerProps) {
  const currentPreset = useMemo(() => detectPreset(value), [value]);

  const handlePresetClick = (preset: DatePreset) => {
    if (preset === currentPreset) {
      // Toggle off
      onChange?.(null);
    } else {
      const range = getPresetDateRange(preset);
      onChange?.(range);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {presets
        .filter((p) => p.key !== "custom")
        .map((preset) => (
          <Button
            key={preset.key}
            variant={currentPreset === preset.key ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              currentPreset === preset.key && "bg-primary/10 text-primary"
            )}
            onClick={() => handlePresetClick(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
    </div>
  );
});
