"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Plus,
  X,
  ExternalLink,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { CommunitySuggestion } from "@/lib/community-suggestions";
import { cn } from "@/lib/utils";

interface SuggestedCommunitiesProps {
  suggestions: CommunitySuggestion[];
  onAddCommunity?: (community: string) => void;
  onDismiss?: (community: string) => void;
  className?: string;
}

export function SuggestedCommunities({
  suggestions,
  onAddCommunity,
  onDismiss,
  className,
}: SuggestedCommunitiesProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissed.has(s.community)
  );

  const displayedSuggestions = showAll
    ? visibleSuggestions
    : visibleSuggestions.slice(0, 4);

  const handleDismiss = (community: string) => {
    setDismissed((prev) => new Set(prev).add(community));
    onDismiss?.(community);
  };

  const handleAdd = (community: string) => {
    onAddCommunity?.(community);
    // Also dismiss after adding
    handleDismiss(community);
  };

  if (visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Suggested Communities
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Based on your monitors, you might want to track these communities
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {displayedSuggestions.map((suggestion) => (
              <SuggestionItem
                key={suggestion.community}
                suggestion={suggestion}
                onAdd={() => handleAdd(suggestion.community)}
                onDismiss={() => handleDismiss(suggestion.community)}
              />
            ))}
          </div>

          {visibleSuggestions.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? "Show less"
                : `Show ${visibleSuggestions.length - 4} more`}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface SuggestionItemProps {
  suggestion: CommunitySuggestion;
  onAdd: () => void;
  onDismiss: () => void;
}

function SuggestionItem({ suggestion, onAdd, onDismiss }: SuggestionItemProps) {
  const subredditUrl = `https://reddit.com/${suggestion.community}`;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-background/60 hover:bg-background transition-colors group">
      <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
        <MessageSquare className="h-4 w-4 text-orange-500" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={subredditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:text-primary transition-colors flex items-center gap-1"
          >
            {suggestion.community}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
          {suggestion.relevanceScore >= 3 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              High match
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {suggestion.matchedKeywords.slice(0, 3).map((keyword) => (
            <span
              key={keyword}
              className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
            >
              {keyword}
            </span>
          ))}
          {suggestion.matchedKeywords.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{suggestion.matchedKeywords.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
          title="Dismiss suggestion"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={onAdd}
        >
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>
    </div>
  );
}

// Compact version for sidebar
export function SuggestedCommunitiesCompact({
  suggestions,
  onAddCommunity,
  className,
}: Omit<SuggestedCommunitiesProps, "onDismiss">) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions
    .filter((s) => !dismissed.has(s.community))
    .slice(0, 3);

  if (visibleSuggestions.length === 0) {
    return null;
  }

  const handleAdd = (community: string) => {
    onAddCommunity?.(community);
    setDismissed((prev) => new Set(prev).add(community));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Suggested
      </div>
      {visibleSuggestions.map((suggestion) => (
        <button
          key={suggestion.community}
          onClick={() => handleAdd(suggestion.community)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-muted transition-colors group"
        >
          <MessageSquare className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span className="truncate flex-1">{suggestion.community}</span>
          <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
        </button>
      ))}
    </div>
  );
}
