"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bookmark,
  Plus,
  FolderOpen,
  Loader2,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Minus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getPlatformDisplayName, getPlatformBadgeColor } from "@/lib/platform-utils";

interface BookmarkResult {
  id: string;
  title: string;
  content: string | null;
  sourceUrl: string;
  platform: string;
  sentiment: string | null;
  aiSummary: string | null;
  createdAt: Date;
  monitor: { name: string } | null;
}

interface Collection {
  id: string;
  name: string;
  color: string | null;
  bookmarkCount: number;
}

interface BookmarkMeta {
  collectionId: string | null;
  note: string | null;
}

interface BookmarksViewProps {
  results: BookmarkResult[];
  collections: Collection[];
  bookmarkMap: Record<string, BookmarkMeta>;
}

const sentimentIcons = {
  positive: <ThumbsUp className="h-3.5 w-3.5 text-green-500" />,
  negative: <ThumbsDown className="h-3.5 w-3.5 text-red-500" />,
  neutral: <Minus className="h-3.5 w-3.5 text-gray-500" />,
};

export function BookmarksView({ results, collections, bookmarkMap }: BookmarksViewProps) {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [localCollections, setLocalCollections] = useState(collections);

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/bookmarks/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });
      if (res.ok) {
        const { collection } = await res.json();
        setLocalCollections((prev) => [{ ...collection, bookmarkCount: 0 }, ...prev]);
        setNewCollectionName("");
        setShowNewCollection(false);
        toast.success("Collection created");
      }
    } catch {
      toast.error("Failed to create collection");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      const res = await fetch("/api/bookmarks/collections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: collectionId }),
      });
      if (res.ok) {
        setLocalCollections((prev) => prev.filter((c) => c.id !== collectionId));
        if (selectedCollection === collectionId) {
          setSelectedCollection(null);
        }
        toast.success("Collection deleted");
      }
    } catch {
      toast.error("Failed to delete collection");
    }
  };

  // Filter results by selected collection
  const filteredResults = selectedCollection
    ? results.filter((r) => bookmarkMap[r.id]?.collectionId === selectedCollection)
    : results;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookmarks</h1>
        <p className="text-muted-foreground">
          Your saved results organized by collection.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar: Collections */}
        <div className="w-full lg:w-64 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Collections</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewCollection(true)}
              className="h-7 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          </div>

          <button
            onClick={() => setSelectedCollection(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCollection === null
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            <Bookmark className="h-4 w-4" />
            <span className="flex-1 text-left">All Saved</span>
            <Badge variant="secondary" className="text-xs">
              {results.length}
            </Badge>
          </button>

          {localCollections.map((collection) => (
            <div key={collection.id} className="group relative">
              <button
                onClick={() => setSelectedCollection(collection.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCollection === collection.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: collection.color || "#6b7280" }}
                />
                <span className="flex-1 text-left truncate">{collection.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {collection.bookmarkCount}
                </Badge>
              </button>
              <button
                onClick={() => handleDeleteCollection(collection.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>

        {/* Main content: Results */}
        <div className="flex-1 space-y-3">
          {filteredResults.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">
                  {selectedCollection ? "No results in this collection" : "No saved results yet"}
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  {selectedCollection
                    ? "Move saved results into this collection from the results page."
                    : "Click the bookmark icon on any result to save it here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredResults.map((result) => (
              <Card key={result.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${getPlatformBadgeColor(result.platform)}`}
                        >
                          {getPlatformDisplayName(result.platform)}
                        </Badge>
                        {result.sentiment && sentimentIcons[result.sentiment as keyof typeof sentimentIcons]}
                        {result.monitor && (
                          <span className="text-xs text-muted-foreground">
                            via {result.monitor.name}
                          </span>
                        )}
                      </div>
                      <a
                        href={result.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm hover:underline line-clamp-1"
                      >
                        {result.title}
                      </a>
                      {result.aiSummary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {result.aiSummary}
                        </p>
                      )}
                    </div>
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* New Collection Dialog */}
      <Dialog open={showNewCollection} onOpenChange={setShowNewCollection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Collection name..."
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateCollection();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCollection(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={isCreating || !newCollectionName.trim()}
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
