"use client";

import { memo } from "react";
import { HelpCircle, Search, Filter, Quote, X as CloseIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Search Syntax Help - Shows users how to use advanced search operators
 */

interface SearchOperator {
  syntax: string;
  description: string;
  example?: string;
}

const operators: SearchOperator[] = [
  {
    syntax: '"exact phrase"',
    description: "Match exact phrase",
    example: '"pricing feedback"',
  },
  {
    syntax: "title:keyword",
    description: "Search only in titles",
    example: "title:bug",
  },
  {
    syntax: "body:keyword",
    description: "Search only in content",
    example: "body:alternative",
  },
  {
    syntax: "author:name",
    description: "Filter by author",
    example: "author:techguy",
  },
  {
    syntax: "subreddit:name",
    description: "Filter by subreddit",
    example: "subreddit:saas",
  },
  {
    syntax: "NOT term",
    description: "Exclude results with term",
    example: "pricing NOT free",
  },
  {
    syntax: "term1 OR term2",
    description: "Match either term",
    example: "alternative OR competitor",
  },
  {
    syntax: "term1 term2",
    description: "Match both terms (AND)",
    example: "bug fix",
  },
];

const exampleQueries = [
  {
    query: '"pricing feedback" NOT competitor',
    description: "Find pricing discussions, exclude competitor mentions",
  },
  {
    query: "title:bug body:workaround",
    description: "Bug in title with workaround in content",
  },
  {
    query: "alternative OR recommendation subreddit:saas",
    description: "Alternatives/recommendations in r/saas",
  },
  {
    query: "author:techguy review",
    description: "Reviews from a specific user",
  },
];

interface SearchHelpTooltipProps {
  /** Additional CSS classes */
  className?: string;
  /** Size of the help icon */
  size?: "sm" | "md";
  /** Called when an example query is clicked */
  onExampleClick?: (query: string) => void;
}

export const SearchHelpTooltip = memo(function SearchHelpTooltip({
  className,
  size = "sm",
  onExampleClick,
}: SearchHelpTooltipProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            className
          )}
          aria-label="Search help"
        >
          <HelpCircle className={iconSize} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="space-y-4 p-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Advanced Search</h3>
          </div>

          {/* Operators */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Search Operators
            </h4>
            <div className="grid gap-1">
              {operators.map((op) => (
                <div
                  key={op.syntax}
                  className="grid grid-cols-[1fr_2fr] gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
                >
                  <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                    {op.syntax}
                  </code>
                  <span className="text-muted-foreground text-xs">
                    {op.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Examples */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Quote className="h-3 w-3" />
              Examples
            </h4>
            <div className="space-y-1">
              {exampleQueries.map((ex) => (
                <button
                  key={ex.query}
                  onClick={() => onExampleClick?.(ex.query)}
                  className="w-full text-left p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <code className="font-mono text-xs text-primary block">
                    {ex.query}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {ex.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <strong>Tip:</strong> Click any example to use it as your search query.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

/**
 * Inline version that shows as a simple popover
 */
interface InlineSearchHelpProps {
  className?: string;
}

export const InlineSearchHelp = memo(function InlineSearchHelp({
  className,
}: InlineSearchHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 text-muted-foreground hover:text-foreground",
            className
          )}
          aria-label="Search help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-auto p-2">
        <div className="space-y-1 text-xs">
          <p className="font-medium">Search Operators:</p>
          <ul className="space-y-0.5 text-muted-foreground">
            <li><code className="bg-muted px-1 rounded">&quot;phrase&quot;</code> - Exact match</li>
            <li><code className="bg-muted px-1 rounded">title:</code> - In title only</li>
            <li><code className="bg-muted px-1 rounded">NOT</code> - Exclude term</li>
            <li><code className="bg-muted px-1 rounded">OR</code> - Either term</li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
});

/**
 * Search input with integrated help
 */
interface SearchInputWithHelpProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInputWithHelp = memo(function SearchInputWithHelp({
  value,
  onChange,
  placeholder = "Search results...",
  className,
}: SearchInputWithHelpProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="absolute right-1 flex items-center gap-1">
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </Button>
        )}
        <SearchHelpTooltip
          size="sm"
          onExampleClick={(query) => onChange(query)}
        />
      </div>
    </div>
  );
});
