"use client";

import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, HelpCircle, Zap, AlertCircle } from "lucide-react";
import { parseSearchQuery, validateSearchQuery } from "@/lib/search-parser";

interface SearchQueryInputProps {
  value: string;
  onChange: (value: string) => void;
  isPro?: boolean;
}

export function SearchQueryInput({ value, onChange, isPro = false }: SearchQueryInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse and validate the query
  const { parsed, validation } = useMemo(() => {
    const validation = validateSearchQuery(value);
    const parsed = value.trim() ? parseSearchQuery(value) : null;
    return { parsed, validation };
  }, [value]);

  if (!isPro) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-2">
            Advanced Search
            <Badge variant="outline" className="text-xs gap-1">
              <Zap className="h-3 w-3" />
              Pro
            </Badge>
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Upgrade to Pro to use boolean search operators like &quot;exact phrase&quot;, NOT, OR, title:, author:, and more.
        </p>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between cursor-pointer group">
          <Label className="flex items-center gap-2 cursor-pointer">
            Advanced Search
            <Badge variant="outline" className="text-xs gap-1">
              <Zap className="h-3 w-3" />
              Pro
            </Badge>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              placeholder='e.g., "pricing feedback" OR competitor NOT support'
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={!validation.valid && value.trim() ? "border-destructive" : ""}
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm" align="end">
              <div className="space-y-2">
                <h4 className="font-semibold">Search Operators</h4>
                <div className="space-y-1 text-xs">
                  <p><code className="bg-muted px-1 rounded">&quot;exact phrase&quot;</code> - Match exact words</p>
                  <p><code className="bg-muted px-1 rounded">title:keyword</code> - Search in titles only</p>
                  <p><code className="bg-muted px-1 rounded">body:keyword</code> - Search in content only</p>
                  <p><code className="bg-muted px-1 rounded">author:name</code> - Filter by author</p>
                  <p><code className="bg-muted px-1 rounded">subreddit:name</code> - Filter by subreddit</p>
                  <p><code className="bg-muted px-1 rounded">platform:reddit</code> - Filter by platform</p>
                  <p><code className="bg-muted px-1 rounded">NOT term</code> - Exclude results with term</p>
                  <p><code className="bg-muted px-1 rounded">term1 OR term2</code> - Match either</p>
                  <p><code className="bg-muted px-1 rounded">term1 term2</code> - Match both (AND)</p>
                </div>
                <div className="pt-2 border-t">
                  <h5 className="font-medium mb-1">Examples</h5>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>&quot;pricing feedback&quot; - Find exact phrase</p>
                    <p>title:bug NOT fixed - Bugs not yet fixed</p>
                    <p>alternative OR competitor - Either word</p>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Validation Error */}
        {!validation.valid && value.trim() && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="h-3 w-3" />
            {validation.error}
          </div>
        )}

        {/* Query Preview */}
        {parsed && validation.valid && (
          <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-2">
            <div className="font-medium">Search Preview:</div>
            <p className="text-muted-foreground">{parsed.explanation}</p>
            <div className="flex flex-wrap gap-1">
              {parsed.required.length > 0 && (
                <Badge variant="default" className="text-[10px]">
                  Required: {parsed.required.map(t => t.isExact ? `"${t.term}"` : t.term).join(", ")}
                </Badge>
              )}
              {parsed.optional.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  Optional: {parsed.optional.map(t => t.isExact ? `"${t.term}"` : t.term).join(" OR ")}
                </Badge>
              )}
              {parsed.excluded.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  Excluded: {parsed.excluded.map(t => t.term).join(", ")}
                </Badge>
              )}
              {parsed.filters.platform && parsed.filters.platform.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  Platform: {parsed.filters.platform.join(", ")}
                </Badge>
              )}
              {parsed.filters.author && parsed.filters.author.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  Author: {parsed.filters.author.join(", ")}
                </Badge>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Use advanced operators for precise filtering. Leave empty to use simple keyword matching.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
