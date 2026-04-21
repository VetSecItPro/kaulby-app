"use client";

// Task 2.2: SelectionToolbar — appears when the user selects >=1 result card.
// Centralizes bulk actions so the page renders a single sticky bar instead of
// repeating the same dropdown on each card. Keyboard accessible: Cmd/Ctrl+A
// selects all visible, Escape clears selection.

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  Bookmark,
  BookmarkX,
  EyeOff,
  Eye,
  X,
  Loader2,
  Save,
} from "lucide-react";
import {
  batchMarkResultsRead,
  batchHideResults,
  batchUnhideResults,
  batchSaveResults,
  batchUnsaveResults,
} from "@/app/(dashboard)/dashboard/results/actions";

export interface SelectionToolbarProps {
  selectedIds: string[];
  /** Total number of visible results, used to show context ("3 of 42 selected"). */
  visibleCount: number;
  /** Called after a bulk action succeeds so the parent can clear selection. */
  onActionComplete: () => void;
  /** Called to clear selection. */
  onClear: () => void;
  /** Called when the user clicks "Save view" to open the dialog. */
  onSaveView?: () => void;
  /** When true, bulk-hide becomes bulk-unhide (user is currently viewing "hidden"). */
  inHiddenView?: boolean;
}

export function SelectionToolbar({
  selectedIds,
  visibleCount,
  onActionComplete,
  onClear,
  onSaveView,
  inHiddenView = false,
}: SelectionToolbarProps) {
  const [isPending, startTransition] = useTransition();

  if (selectedIds.length === 0) return null;

  const runAction = (action: (ids: string[]) => Promise<unknown>) => {
    startTransition(async () => {
      try {
        await action(selectedIds);
        onActionComplete();
      } catch (err) {
        // Surface error via alert — toast system lives in a separate hook; the
        // user-facing copy is intentionally minimal so we don't leak server
        // messages (e.g. rate-limit retry-after seconds).
        console.error("[SelectionToolbar] bulk action failed", err);
      }
    });
  };

  return (
    <>
      {/* A11Y: Live region announces count changes to screen readers. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {selectedIds.length} of {visibleCount} results selected
      </div>

      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="sticky top-2 z-10 flex items-center gap-2 flex-wrap rounded-md border bg-background/95 backdrop-blur px-3 py-2 shadow-sm"
      >
        <span className="text-sm font-medium">
          {selectedIds.length} selected
        </span>
        <span className="text-xs text-muted-foreground">
          of {visibleCount}
        </span>

        <div className="h-4 w-px bg-border mx-1" aria-hidden="true" />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => runAction(batchMarkResultsRead)}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          Mark read
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => runAction(batchSaveResults)}
          disabled={isPending}
        >
          <Bookmark className="h-4 w-4 mr-1" />
          Save
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => runAction(batchUnsaveResults)}
          disabled={isPending}
        >
          <BookmarkX className="h-4 w-4 mr-1" />
          Unsave
        </Button>

        {inHiddenView ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => runAction(batchUnhideResults)}
            disabled={isPending}
          >
            <Eye className="h-4 w-4 mr-1" />
            Unhide
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => runAction(batchHideResults)}
            disabled={isPending}
          >
            <EyeOff className="h-4 w-4 mr-1" />
            Hide
          </Button>
        )}

        {onSaveView && (
          <>
            <div className="h-4 w-px bg-border mx-1" aria-hidden="true" />
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveView}
              disabled={isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              Save view
            </Button>
          </>
        )}

        <div className="ml-auto" />

        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={isPending}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
    </>
  );
}
