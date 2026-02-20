"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bookmark, ChevronDown, Plus, Trash2, Loader2, Pencil, Clock, Hash, Search } from "lucide-react";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: {
    platforms?: string[];
    categories?: string[];
    sentiments?: string[];
    dateRange?: { from?: string; to?: string };
  } | null;
  useCount: number;
  lastUsedAt: Date | null;
}

interface CurrentFilters {
  platforms?: string[];
  categories?: string[];
  sentiments?: string[];
  dateRange?: { from?: string; to?: string };
}

interface SavedSearchesProps {
  currentQuery: string;
  currentFilters: CurrentFilters;
  onSelectSearch: (query: string, filters: CurrentFilters | null) => void;
}

function countActiveFilters(filters: CurrentFilters | null): number {
  if (!filters) return 0;
  let count = 0;
  if (filters.platforms?.length) count += filters.platforms.length;
  if (filters.sentiments?.length) count += filters.sentiments.length;
  if (filters.categories?.length) count += filters.categories.length;
  if (filters.dateRange?.from || filters.dateRange?.to) count += 1;
  return count;
}

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SavedSearches({
  currentQuery,
  currentFilters,
  onSelectSearch,
}: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newSearchName, setNewSearchName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Rename state
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameSearchId, setRenameSearchId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteSearchId, setDeleteSearchId] = useState<string | null>(null);
  const [deleteSearchName, setDeleteSearchName] = useState("");

  // Fetch saved searches on mount
  useEffect(() => {
    async function fetchSearches() {
      try {
        const response = await fetch("/api/saved-searches");
        if (response.ok) {
          const data = await response.json();
          setSearches(data.searches);
        }
      } catch (err) {
        console.error("Failed to fetch saved searches:", err);
        toast.error("Failed to load saved searches");
      } finally {
        setLoading(false);
      }
    }
    fetchSearches();
  }, []);

  const handleSaveSearch = async () => {
    if (!newSearchName.trim()) {
      setError("Please enter a name for this search");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSearchName.trim(),
          query: currentQuery,
          filters: hasActiveFilters(currentFilters) ? currentFilters : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearches((prev) => [data.search, ...prev]);
        setShowSaveDialog(false);
        setNewSearchName("");
        toast.success("Search saved");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save search");
      }
    } catch (err) {
      setError("Failed to save search");
      toast.error("Failed to save search");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSearch = async (search: SavedSearch) => {
    // Increment use count
    try {
      await fetch(`/api/saved-searches/${search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incrementUse: true }),
      });
      // Update local state to reflect the use
      setSearches((prev) =>
        prev.map((s) =>
          s.id === search.id
            ? { ...s, useCount: s.useCount + 1, lastUsedAt: new Date() }
            : s
        )
      );
    } catch (err) {
      console.error("Failed to update use count:", err);
    }

    // Apply the search
    onSelectSearch(search.query, search.filters);
  };

  const handleStartRename = (search: SavedSearch, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameSearchId(search.id);
    setRenameName(search.name);
    setShowRenameDialog(true);
  };

  const handleRenameSearch = async () => {
    if (!renameName.trim() || !renameSearchId) return;

    setRenaming(true);
    try {
      const response = await fetch(`/api/saved-searches/${renameSearchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });

      if (response.ok) {
        setSearches((prev) =>
          prev.map((s) =>
            s.id === renameSearchId ? { ...s, name: renameName.trim() } : s
          )
        );
        setShowRenameDialog(false);
        setRenameSearchId(null);
        toast.success("Search renamed");
      } else {
        toast.error("Failed to rename search");
      }
    } catch (err) {
      console.error("Failed to rename search:", err);
      toast.error("Failed to rename search");
    } finally {
      setRenaming(false);
    }
  };

  const handleStartDelete = (search: SavedSearch, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteSearchId(search.id);
    setDeleteSearchName(search.name);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteSearchId) return;

    try {
      const response = await fetch(`/api/saved-searches/${deleteSearchId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== deleteSearchId));
        toast.success("Search deleted");
      }
    } catch (err) {
      console.error("Failed to delete saved search:", err);
      toast.error("Failed to delete saved search");
    } finally {
      setShowDeleteDialog(false);
      setDeleteSearchId(null);
      setDeleteSearchName("");
    }
  };

  const canSaveCurrentSearch = currentQuery.trim().length > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
            {searches.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {searches.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Saved Searches</span>
            {canSaveCurrentSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowSaveDialog(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Save Current
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            </div>
          ) : searches.length === 0 ? (
            <div className="py-6 px-4 text-center">
              <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No saved searches yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {canSaveCurrentSearch
                  ? "Click \"Save Current\" above to save your active search query and filters for quick reuse."
                  : "Enter a search query first, then save it here for quick access later."}
              </p>
            </div>
          ) : (
            searches.map((search) => {
              const filterCount = countActiveFilters(search.filters);
              return (
                <DropdownMenuItem
                  key={search.id}
                  className="flex items-start justify-between cursor-pointer group py-2.5 px-3"
                  onClick={() => handleSelectSearch(search)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-medium truncate text-sm">{search.name}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono">
                      {search.query || "(no query)"}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      {filterCount > 0 && (
                        <span className="flex items-center gap-0.5 text-teal-500">
                          <Hash className="h-3 w-3" />
                          {filterCount} filter{filterCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(search.lastUsedAt)}
                      </span>
                      {search.useCount > 0 && (
                        <span>{search.useCount} use{search.useCount !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 ml-2 opacity-0 group-hover:opacity-100 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleStartRename(search, e)}
                      aria-label={`Rename saved search ${search.name}`}
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleStartDelete(search, e)}
                      aria-label={`Delete saved search ${search.name}`}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Search Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
            <DialogDescription>
              Save your current search query and filters for quick access later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Name</Label>
              <Input
                id="search-name"
                placeholder="e.g., Competitor mentions"
                value={newSearchName}
                onChange={(e) => {
                  setNewSearchName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveSearch();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Query</Label>
              <div className="p-2 bg-muted rounded-md text-sm font-mono">
                {currentQuery || "(empty)"}
              </div>
            </div>

            {hasActiveFilters(currentFilters) && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Filters</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  {currentFilters.platforms?.length && (
                    <div>
                      Platforms: {currentFilters.platforms.join(", ")}
                    </div>
                  )}
                  {currentFilters.sentiments?.length && (
                    <div>
                      Sentiment: {currentFilters.sentiments.join(", ")}
                    </div>
                  )}
                  {currentFilters.categories?.length && (
                    <div>
                      Categories: {currentFilters.categories.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSearch} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Search"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Search</DialogTitle>
            <DialogDescription>
              Enter a new name for this saved search.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Search name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSearch();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameSearch}
              disabled={renaming || !renameName.trim()}
            >
              {renaming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                "Rename"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved search?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteSearchName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function hasActiveFilters(filters: CurrentFilters | null): boolean {
  if (!filters) return false;
  return (
    (filters.platforms?.length ?? 0) > 0 ||
    (filters.sentiments?.length ?? 0) > 0 ||
    (filters.categories?.length ?? 0) > 0 ||
    filters.dateRange?.from !== undefined ||
    filters.dateRange?.to !== undefined
  );
}
