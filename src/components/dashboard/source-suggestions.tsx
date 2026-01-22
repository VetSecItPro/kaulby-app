"use client";

import { memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Plus, Sparkles, ChevronRight } from "lucide-react";
import { getPlatformDisplayName, getPlatformBadgeColor, platforms, type Platform } from "@/lib/platform-utils";
import { cn } from "@/lib/utils";

/**
 * Platform suggestion with reasoning
 */
interface PlatformSuggestion {
  platform: Platform;
  reason: string;
  potentialValue: "high" | "medium" | "low";
  examples?: string[];
}

/**
 * Props for SourceSuggestions component
 */
interface SourceSuggestionsProps {
  /** Platforms the user is currently monitoring */
  currentPlatforms: string[];
  /** User's keywords (for context-aware suggestions) */
  keywords?: string[];
  /** Callback when user wants to add a platform */
  onAddPlatform?: (platform: Platform) => void;
  /** Whether user has pro access */
  isPro?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Platform metadata for suggestions
 */
const platformMetadata: Record<Platform, {
  description: string;
  bestFor: string[];
  suggestFor: string[];
}> = {
  reddit: {
    description: "Largest discussion platform with niche communities",
    bestFor: ["B2C products", "developer tools", "gaming", "tech"],
    suggestFor: ["SaaS", "startup", "developer", "consumer"],
  },
  hackernews: {
    description: "Tech-focused discussions with influential developers",
    bestFor: ["developer tools", "SaaS", "startups", "tech news"],
    suggestFor: ["developer", "startup", "SaaS", "tech", "AI"],
  },
  producthunt: {
    description: "Product launches and early adopter feedback",
    bestFor: ["new products", "startup launches", "competitor tracking"],
    suggestFor: ["launch", "product", "startup", "competitor"],
  },
  devto: {
    description: "Developer community articles and discussions",
    bestFor: ["developer tools", "technical content", "tutorials"],
    suggestFor: ["developer", "API", "SDK", "programming"],
  },
  googlereviews: {
    description: "Local business and service reviews",
    bestFor: ["local businesses", "services", "restaurants", "agencies"],
    suggestFor: ["agency", "service", "local", "consulting"],
  },
  trustpilot: {
    description: "Business reviews and reputation tracking",
    bestFor: ["B2B services", "e-commerce", "SaaS", "competitor analysis"],
    suggestFor: ["B2B", "SaaS", "competitor", "enterprise"],
  },
  appstore: {
    description: "iOS app reviews and competitor tracking",
    bestFor: ["iOS apps", "mobile products", "competitor apps"],
    suggestFor: ["app", "mobile", "iOS", "consumer"],
  },
  playstore: {
    description: "Android app reviews and feedback",
    bestFor: ["Android apps", "mobile products", "competitor apps"],
    suggestFor: ["app", "mobile", "Android", "consumer"],
  },
  quora: {
    description: "Q&A platform with high search visibility",
    bestFor: ["thought leadership", "long-form questions", "SEO"],
    suggestFor: ["question", "how to", "why", "best"],
  },
};

/**
 * Get intelligent suggestions based on current platforms and keywords
 */
function getSuggestions(
  currentPlatforms: string[],
  keywords: string[]
): PlatformSuggestion[] {
  const suggestions: PlatformSuggestion[] = [];
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  // Find platforms not currently being used
  const unusedPlatforms = platforms.filter(p => !currentPlatforms.includes(p));

  for (const platform of unusedPlatforms) {
    const meta = platformMetadata[platform];

    // Check if any keywords match the platform's suggested use cases
    const keywordMatches = meta.suggestFor.filter(term =>
      lowerKeywords.some(k => k.includes(term.toLowerCase()) || term.toLowerCase().includes(k))
    );

    let potentialValue: "high" | "medium" | "low" = "low";
    let reason = `Track ${meta.bestFor[0]} discussions`;

    if (keywordMatches.length >= 2) {
      potentialValue = "high";
      reason = `Your keywords suggest high relevance for ${getPlatformDisplayName(platform)}`;
    } else if (keywordMatches.length === 1) {
      potentialValue = "medium";
      reason = `May find relevant mentions for "${keywordMatches[0]}" topics`;
    } else {
      // Generic reasons based on platform
      reason = meta.description;
    }

    suggestions.push({
      platform,
      reason,
      potentialValue,
      examples: meta.bestFor.slice(0, 2),
    });
  }

  // Sort by potential value
  const valueOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => valueOrder[a.potentialValue] - valueOrder[b.potentialValue]);

  return suggestions;
}

/**
 * Individual suggestion card
 */
const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onAdd,
  isPro,
  isFreePlatform,
}: {
  suggestion: PlatformSuggestion;
  onAdd?: () => void;
  isPro: boolean;
  isFreePlatform: boolean;
}) {
  const canAdd = isPro || isFreePlatform;

  return (
    <div
      className={cn(
        "p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors",
        suggestion.potentialValue === "high" && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="secondary"
              className={getPlatformBadgeColor(suggestion.platform, "light")}
            >
              {getPlatformDisplayName(suggestion.platform)}
            </Badge>
            {suggestion.potentialValue === "high" && (
              <Badge variant="default" className="bg-primary/20 text-primary text-[10px]">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                Recommended
              </Badge>
            )}
            {!canAdd && (
              <Badge variant="outline" className="text-[10px]">
                Pro
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {suggestion.reason}
          </p>
          {suggestion.examples && (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
              <span>Best for:</span>
              {suggestion.examples.map((ex, i) => (
                <span key={ex}>
                  {ex}{i < suggestion.examples!.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant={canAdd ? "default" : "outline"}
          className="shrink-0"
          onClick={onAdd}
          disabled={!canAdd}
        >
          {canAdd ? (
            <>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </>
          ) : (
            "Upgrade"
          )}
        </Button>
      </div>
    </div>
  );
});

/**
 * Source Suggestions Component
 *
 * Intelligently suggests platforms users should consider monitoring
 * based on their current setup and keywords. Works across all 9 platforms.
 */
export const SourceSuggestions = memo(function SourceSuggestions({
  currentPlatforms,
  keywords = [],
  onAddPlatform,
  isPro = false,
  className,
}: SourceSuggestionsProps) {
  const suggestions = useMemo(
    () => getSuggestions(currentPlatforms, keywords),
    [currentPlatforms, keywords]
  );

  // Only show if there are suggestions
  if (suggestions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p className="font-medium">You&apos;re monitoring all platforms!</p>
          <p className="text-sm text-muted-foreground">
            Great coverage across all available sources.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show top 3 suggestions
  const topSuggestions = suggestions.slice(0, 3);
  const remainingCount = suggestions.length - 3;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Expand Your Reach
        </CardTitle>
        <CardDescription>
          Platforms where you could find more relevant conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {topSuggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.platform}
            suggestion={suggestion}
            onAdd={() => onAddPlatform?.(suggestion.platform)}
            isPro={isPro}
            isFreePlatform={suggestion.platform === "reddit"}
          />
        ))}

        {remainingCount > 0 && (
          <Button variant="ghost" className="w-full text-muted-foreground">
            View {remainingCount} more platform{remainingCount > 1 ? "s" : ""}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

/**
 * Compact inline suggestion (for use in sidebars)
 */
export const CompactPlatformSuggestion = memo(function CompactPlatformSuggestion({
  platform,
  reason,
  onAdd,
  canAdd = true,
}: {
  platform: Platform;
  reason?: string;
  onAdd?: () => void;
  canAdd?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <Badge
          variant="secondary"
          className={cn("text-[10px]", getPlatformBadgeColor(platform, "light"))}
        >
          {getPlatformDisplayName(platform)}
        </Badge>
        {reason && (
          <span className="text-xs text-muted-foreground truncate">
            {reason}
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={onAdd}
        disabled={!canAdd}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
});

/**
 * Platform coverage indicator
 * Shows which platforms are being monitored vs available
 */
export const PlatformCoverage = memo(function PlatformCoverage({
  activePlatforms,
  isPro = false,
  className,
}: {
  activePlatforms: string[];
  isPro?: boolean;
  className?: string;
}) {
  const total = platforms.length;
  const active = activePlatforms.length;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Platform Coverage</span>
        <span className="font-medium">{active}/{total}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
        {platforms.map((platform) => {
          const isActive = activePlatforms.includes(platform);
          const isFree = platform === "reddit";
          const isAvailable = isPro || isFree;

          return (
            <div
              key={platform}
              className={cn(
                "h-full flex-1 transition-all",
                isActive
                  ? getPlatformBadgeColor(platform).replace("text-", "bg-").replace("/10", "")
                  : isAvailable
                  ? "bg-muted-foreground/20"
                  : "bg-muted-foreground/10"
              )}
              title={`${getPlatformDisplayName(platform)}${isActive ? " (active)" : !isAvailable ? " (Pro)" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        {platforms.map((platform) => {
          const isActive = activePlatforms.includes(platform);
          return (
            <Badge
              key={platform}
              variant="secondary"
              className={cn(
                "text-[9px] px-1 py-0",
                isActive
                  ? getPlatformBadgeColor(platform, "light")
                  : "bg-muted text-muted-foreground opacity-50"
              )}
            >
              {getPlatformDisplayName(platform)}
            </Badge>
          );
        })}
      </div>
    </div>
  );
});
