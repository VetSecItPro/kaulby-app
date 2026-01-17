"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, X, Loader2, Sparkles, Lock } from "lucide-react";
import Link from "next/link";
import { SearchQueryInput } from "@/components/search-query-input";

// All available platforms
const ALL_PLATFORMS = [
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions", tier: "free" },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions", tier: "pro" },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews", tier: "pro" },
  { id: "devto", name: "Dev.to", description: "Developer community articles", tier: "pro" },
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews on Google", tier: "pro" },
  { id: "trustpilot", name: "Trustpilot", description: "Customer reviews and ratings", tier: "pro" },
  { id: "appstore", name: "App Store", description: "iOS app reviews", tier: "pro" },
  { id: "playstore", name: "Play Store", description: "Android app reviews", tier: "pro" },
  { id: "quora", name: "Quora", description: "Q&A discussions", tier: "pro" },
];

// Dynamic keyword suggestions based on monitor name
function generateKeywordSuggestions(monitorName: string): string[] {
  const name = monitorName.toLowerCase().trim();
  if (!name) return [];

  const suggestions: string[] = [];

  // Brand/company monitoring patterns
  if (name.includes("brand") || name.includes("mention")) {
    suggestions.push(`${name.split(" ")[0]} reviews`, `${name.split(" ")[0]} alternative`, "recommend");
  }

  // Competitor patterns
  if (name.includes("competitor") || name.includes("vs") || name.includes("alternative")) {
    suggestions.push("switching from", "problems with", "better than", "vs");
  }

  // Product patterns
  if (name.includes("product") || name.includes("saas") || name.includes("app")) {
    suggestions.push("looking for", "best", "recommend", "help with");
  }

  // General high-value patterns based on first word
  const firstWord = name.split(" ")[0];
  if (firstWord && firstWord.length > 2) {
    suggestions.push(
      `${firstWord} review`,
      `${firstWord} alternative`,
      `best ${firstWord}`,
      `${firstWord} vs`
    );
  }

  // Remove duplicates and return top 6
  return Array.from(new Set(suggestions)).slice(0, 6);
}

export default function NewMonitorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [error, setError] = useState("");

  // In dev mode, assume enterprise tier. In production, this would come from user context
  // TODO: Get actual tier from user subscription context
  const isDev = process.env.NODE_ENV === "development";
  const isPaidUser = isDev; // In dev mode, treat as paid user with access to all platforms

  // Generate keyword suggestions based on company name
  const keywordSuggestions = useMemo(() => generateKeywordSuggestions(companyName || name), [companyName, name]);

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a monitor name");
      return;
    }
    if (!companyName.trim()) {
      setError("Please enter the company/brand name to monitor");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("Please select at least one platform");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim(),
          keywords, // Keywords are now optional additional terms
          searchQuery: searchQuery.trim() || undefined, // Advanced boolean search (Pro feature)
          platforms: selectedPlatforms,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create monitor");
      }

      router.push("/dashboard/monitors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/monitors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Monitor</h1>
          <p className="text-muted-foreground">
            Set up a new keyword monitor to track mentions.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Monitor Details</CardTitle>
            <CardDescription>
              Configure what you want to track across platforms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Monitor Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Monitor Name</Label>
              <Input
                id="name"
                placeholder="e.g., Brand Reputation, Customer Feedback"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this monitor in your dashboard.
              </p>
            </div>

            {/* Company/Brand Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName">Company/Brand Name</Label>
              <Input
                id="companyName"
                placeholder="e.g., High Rise Coffee, Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="off"
                className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-muted-foreground">
                The company or brand you want to monitor. We&apos;ll search for this name across selected platforms.
              </p>
            </div>

            {/* Keywords (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="keywords">Additional Keywords <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="flex gap-2">
                <Input
                  id="keywords"
                  placeholder="e.g., customer service, pricing, alternative"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500"
                />
                <Button
                  type="button"
                  onClick={addKeyword}
                  className="bg-teal-500 text-black hover:bg-teal-600"
                >
                  Add
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="gap-1">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Dynamic keyword suggestions */}
              {keywordSuggestions.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Suggested keywords</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywordSuggestions
                      .filter(s => !keywords.includes(s))
                      .map((suggestion) => (
                        <Badge
                          key={suggestion}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => {
                            if (!keywords.includes(suggestion)) {
                              setKeywords([...keywords, suggestion]);
                            }
                          }}
                        >
                          + {suggestion}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Add additional keywords to find mentions like &quot;{companyName || "your company"} customer service&quot; or &quot;{companyName || "your company"} alternative&quot;.
              </p>
            </div>

            {/* Advanced Search Query (Pro feature) */}
            <div className="space-y-2">
              <SearchQueryInput
                value={searchQuery}
                onChange={setSearchQuery}
                isPro={isPaidUser}
              />
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <Label>Platforms</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {isPaidUser ? "All 9 platforms available" : "Upgrade to Pro to unlock all platforms"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_PLATFORMS.map((platform) => {
                  const isLocked = platform.tier !== "free" && !isPaidUser;
                  const isSelected = selectedPlatforms.includes(platform.id);

                  return (
                    <label
                      key={platform.id}
                      htmlFor={`platform-${platform.id}`}
                      className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                        isLocked
                          ? "opacity-60 cursor-not-allowed bg-muted/30"
                          : "cursor-pointer hover:bg-muted/50"
                      } ${isSelected ? "border-primary bg-primary/5" : ""}`}
                    >
                      <Checkbox
                        id={`platform-${platform.id}`}
                        checked={isSelected}
                        disabled={isLocked}
                        onCheckedChange={(checked) => {
                          if (!isLocked && typeof checked === "boolean") {
                            if (checked && !isSelected) {
                              setSelectedPlatforms((prev) => [...prev, platform.id]);
                            } else if (!checked && isSelected) {
                              setSelectedPlatforms((prev) => prev.filter((p) => p !== platform.id));
                            }
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                            {platform.name}
                          </span>
                          {isLocked && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {platform.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Monitor
              </Button>
              <Link href="/dashboard/monitors">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
