"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Bookmark, ChevronDown, Plus, Trash2, Loader2 } from "lucide-react";

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
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save search");
      }
    } catch (err) {
      setError("Failed to save search");
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
    } catch (err) {
      console.error("Failed to update use count:", err);
    }

    // Apply the search
    onSelectSearch(search.query, search.filters);
  };

  const handleDeleteSearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete saved search:", err);
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
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
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
            <div className="py-4 text-center text-sm text-muted-foreground">
              No saved searches yet.
              {canSaveCurrentSearch && (
                <p className="mt-1 text-xs">
                  Click &quot;Save Current&quot; to save your search.
                </p>
              )}
            </div>
          ) : (
            searches.map((search) => (
              <DropdownMenuItem
                key={search.id}
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => handleSelectSearch(search)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{search.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {search.query}
                    {search.filters && hasActiveFilters(search.filters) && (
                      <span className="ml-1 text-teal-500">+ filters</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 ml-2"
                  onClick={(e) => handleDeleteSearch(search.id, e)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
