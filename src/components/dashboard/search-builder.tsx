"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Wand2, Trash2 } from "lucide-react";
import { parseSearchQuery } from "@/lib/search-parser";

interface SearchTerm {
  id: string;
  value: string;
  operator: "AND" | "OR" | "NOT";
  field: "any" | "title" | "body" | "author" | "platform";
  isExact: boolean;
}

interface SearchBuilderProps {
  onApply: (query: string) => void;
}

const PLATFORMS = [
  "reddit",
  "hackernews",
  "producthunt",
  "devto",
  "googlereviews",
  "trustpilot",
  "appstore",
  "playstore",
  "quora",
  "youtube",
  "g2",
  "yelp",
  "amazonreviews",
  "indiehackers",
  "github",
  "hashnode",
];

export function SearchBuilder({ onApply }: SearchBuilderProps) {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [newOperator, setNewOperator] = useState<"AND" | "OR" | "NOT">("AND");
  const [newField, setNewField] = useState<"any" | "title" | "body" | "author" | "platform">("any");
  const [newIsExact, setNewIsExact] = useState(false);

  // Generate query from terms
  const generatedQuery = useMemo(() => {
    if (terms.length === 0) return "";

    return terms
      .map((term, index) => {
        let part = "";

        // Add operator for terms after the first
        if (index > 0) {
          if (term.operator === "NOT") {
            part = "NOT ";
          } else if (term.operator === "OR") {
            part = "OR ";
          } else {
            part = ""; // AND is implicit
          }
        } else if (term.operator === "NOT") {
          part = "NOT ";
        }

        // Add field prefix
        if (term.field !== "any") {
          part += `${term.field}:`;
        }

        // Add term value
        if (term.isExact || term.value.includes(" ")) {
          part += `"${term.value}"`;
        } else {
          part += term.value;
        }

        return part;
      })
      .join(" ");
  }, [terms]);

  // Parse and explain the query
  const parsedQuery = useMemo(() => {
    if (!generatedQuery) return null;
    return parseSearchQuery(generatedQuery);
  }, [generatedQuery]);

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;

    const term: SearchTerm = {
      id: crypto.randomUUID(),
      value: newTerm.trim(),
      operator: terms.length === 0 ? "AND" : newOperator,
      field: newField,
      isExact: newIsExact,
    };

    setTerms([...terms, term]);
    setNewTerm("");
    setNewIsExact(false);
  };

  const handleRemoveTerm = (id: string) => {
    setTerms(terms.filter((t) => t.id !== id));
  };

  const handleApply = () => {
    onApply(generatedQuery);
    setOpen(false);
  };

  const handleClear = () => {
    setTerms([]);
    setNewTerm("");
  };

  const getOperatorColor = (op: string) => {
    switch (op) {
      case "NOT":
        return "destructive";
      case "OR":
        return "secondary";
      default:
        return "default";
    }
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case "title":
        return "in title";
      case "body":
        return "in body";
      case "author":
        return "by author";
      case "platform":
        return "on platform";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wand2 className="h-4 w-4" />
          <span className="hidden sm:inline">Query Builder</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Search Query Builder</DialogTitle>
          <DialogDescription>
            Build a search query using AND, OR, and NOT operators. Add filters for specific fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Terms */}
          {terms.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Current Query</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {terms.map((term, index) => (
                  <div key={term.id} className="flex items-center gap-1">
                    {index > 0 && (
                      <Badge variant={getOperatorColor(term.operator)} className="text-xs">
                        {term.operator}
                      </Badge>
                    )}
                    {term.operator === "NOT" && index === 0 && (
                      <Badge variant="destructive" className="text-xs">NOT</Badge>
                    )}
                    <Badge variant="outline" className="gap-1 pr-1">
                      {term.field !== "any" && (
                        <span className="text-muted-foreground text-xs">
                          {term.field}:
                        </span>
                      )}
                      {term.isExact ? `"${term.value}"` : term.value}
                      {term.field !== "any" && (
                        <span className="text-muted-foreground text-xs ml-1">
                          ({getFieldLabel(term.field)})
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveTerm(term.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Term */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Add Search Term</Label>
            <div className="grid gap-3">
              <div className="flex gap-2">
                {terms.length > 0 && (
                  <Select
                    value={newOperator}
                    onValueChange={(v) => setNewOperator(v as "AND" | "OR" | "NOT")}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                      <SelectItem value="NOT">NOT</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Select
                  value={newField}
                  onValueChange={(v) => setNewField(v as typeof newField)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Anywhere</SelectItem>
                    <SelectItem value="title">In Title</SelectItem>
                    <SelectItem value="body">In Body</SelectItem>
                    <SelectItem value="author">Author</SelectItem>
                    <SelectItem value="platform">Platform</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1">
                  {newField === "platform" ? (
                    <Select value={newTerm} onValueChange={setNewTerm}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={
                        newField === "author"
                          ? "Enter username..."
                          : "Enter search term..."
                      }
                      value={newTerm}
                      onChange={(e) => setNewTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTerm();
                        }
                      }}
                    />
                  )}
                </div>

                <Button onClick={handleAddTerm} disabled={!newTerm.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {newField !== "platform" && newField !== "author" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="exact-match"
                    checked={newIsExact}
                    onCheckedChange={setNewIsExact}
                  />
                  <Label htmlFor="exact-match" className="text-sm text-muted-foreground">
                    Exact phrase match
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Query Preview */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Generated Query</Label>
            <div className="p-3 bg-muted rounded-lg font-mono text-sm">
              {generatedQuery || <span className="text-muted-foreground">No terms added yet</span>}
            </div>
            {parsedQuery && parsedQuery.explanation && (
              <p className="text-xs text-muted-foreground">{parsedQuery.explanation}</p>
            )}
          </div>

          {/* Quick Tips */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Quick Tips</Label>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li><strong>AND</strong> - Both terms must appear (default)</li>
              <li><strong>OR</strong> - Either term can appear</li>
              <li><strong>NOT</strong> - Exclude results with this term</li>
              <li><strong>Exact match</strong> - Match the exact phrase, not individual words</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {terms.length > 0 && (
            <Button variant="outline" onClick={handleClear} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          )}
          <Button onClick={handleApply} disabled={terms.length === 0}>
            Apply Query
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
