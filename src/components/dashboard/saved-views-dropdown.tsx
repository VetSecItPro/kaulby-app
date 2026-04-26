"use client";

// Task 2.2: Saved Views dropdown + save-view dialog. Lets the user persist the
// current Results page filter set under a name, and recall it from a single
// dropdown. Keeps the network cost low: views are fetched lazily on first
// open and cached in local state.

import { useEffect, useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import {
  listSavedViews,
  createSavedView,
  deleteSavedView,
} from "@/app/(dashboard)/dashboard/results/actions";

export type SavedViewFilters = {
  categoryFilter?: string | null;
  sentimentFilter?: string | null;
  platformFilter?: string | null;
  statusFilter?: "all" | "unread" | "saved" | "hidden";
  leadScoreMin?: number | null;
};

export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
}

export interface SavedViewsDropdownProps {
  onApplyView: (filters: SavedViewFilters) => void;
}

export function SavedViewsDropdown({ onApplyView }: SavedViewsDropdownProps) {
  const [views, setViews] = useState<SavedView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadViews = () => {
    setLoading(true);
    listSavedViews()
      .then((res) => setViews(res.views as SavedView[]))
      .catch((err) => {
        console.error("[SavedViewsDropdown] failed to load views", err);
        setViews([]);
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteSavedView(id);
        setViews((prev) => (prev ? prev.filter((v) => v.id !== id) : prev));
      } catch (err) {
        console.error("[SavedViewsDropdown] delete failed", err);
      }
    });
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && views === null) loadViews();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark className="h-4 w-4 mr-2" />
          Saved views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Your saved views</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <DropdownMenuItem disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading…
          </DropdownMenuItem>
        )}
        {!loading && views !== null && views.length === 0 && (
          <DropdownMenuItem disabled>
            No saved views yet
          </DropdownMenuItem>
        )}
        {!loading && views !== null && views.length > 0 &&
          views.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onSelect={(e) => {
                // Prevent closing for the delete click inside - we call
                // onApplyView only when the main row is selected.
                e.preventDefault();
                onApplyView(v.filters);
              }}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate flex-1">{v.name}</span>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(v.id);
                }}
                disabled={isPending}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SavedViewFilters;
  onSaved?: () => void;
}

export function SaveViewDialog({
  open,
  onOpenChange,
  filters,
  onSaved,
}: SaveViewDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    startTransition(async () => {
      try {
        await createSavedView(trimmed, filters);
        onSaved?.();
        onOpenChange(false);
      } catch (err) {
        setError((err as Error).message || "Failed to save view");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="saved-view-name">Name</Label>
            <Input
              id="saved-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hot pain points"
              maxLength={100}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            Saves your current filter combination for one-click recall.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export a trigger for convenience when a parent wants a standalone button.
export function SaveViewButton({
  filters,
  onSaved,
}: {
  filters: SavedViewFilters;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Save view
        </Button>
      </DialogTrigger>
      <SaveViewDialog open={open} onOpenChange={setOpen} filters={filters} onSaved={onSaved} />
    </>
  );
}
