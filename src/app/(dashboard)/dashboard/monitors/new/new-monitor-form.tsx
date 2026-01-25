"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, X, Loader2, Sparkles, Lock, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import { SearchQueryInput } from "@/components/search-query-input";
import type { PlanLimits } from "@/lib/plans";
import { COMMON_TIMEZONES, WEEKDAYS } from "@/lib/monitor-schedule";

// All 16 platforms with tier-based access
// Pro tier (8 platforms): reddit, hackernews, indiehackers, producthunt, googlereviews, youtube, github, trustpilot
// Team tier (16 platforms): + devto, hashnode, appstore, playstore, quora, g2, yelp, amazonreviews
const ALL_PLATFORMS = [
  // Pro tier platforms (8)
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions", tier: "free", needsUrl: false },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions", tier: "pro", needsUrl: false },
  { id: "indiehackers", name: "Indie Hackers", description: "Indie makers and solo founders", tier: "pro", needsUrl: false },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews", tier: "pro", needsUrl: false },
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews on Google", tier: "pro", needsUrl: true, urlPlaceholder: "https://www.google.com/maps/place/... or Place ID", urlHelp: "Google Maps URL or Place ID (ChI...)" },
  { id: "youtube", name: "YouTube", description: "Video comments and discussions", tier: "pro", needsUrl: true, urlPlaceholder: "https://www.youtube.com/watch?v=...", urlHelp: "YouTube video URL to monitor comments" },
  { id: "github", name: "GitHub", description: "Issues and discussions", tier: "pro", needsUrl: false },
  { id: "trustpilot", name: "Trustpilot", description: "Customer reviews and ratings", tier: "pro", needsUrl: true, urlPlaceholder: "https://www.trustpilot.com/review/example.com", urlHelp: "Trustpilot company review page URL" },
  // Team tier only platforms (8 more)
  { id: "devto", name: "Dev.to", description: "Developer blog posts and discussions", tier: "team", needsUrl: false },
  { id: "hashnode", name: "Hashnode", description: "Tech blog network", tier: "team", needsUrl: false },
  { id: "appstore", name: "App Store", description: "iOS app reviews", tier: "team", needsUrl: true, urlPlaceholder: "https://apps.apple.com/us/app/name/id123456", urlHelp: "App Store URL for your iOS app" },
  { id: "playstore", name: "Play Store", description: "Android app reviews", tier: "team", needsUrl: true, urlPlaceholder: "https://play.google.com/store/apps/details?id=com.app", urlHelp: "Play Store URL for your Android app" },
  { id: "quora", name: "Quora", description: "Q&A discussions", tier: "team", needsUrl: false },
  { id: "g2", name: "G2", description: "Software reviews and ratings", tier: "team", needsUrl: true, urlPlaceholder: "https://www.g2.com/products/your-product/reviews", urlHelp: "G2 product reviews page URL" },
  { id: "yelp", name: "Yelp", description: "Local business reviews", tier: "team", needsUrl: true, urlPlaceholder: "https://www.yelp.com/biz/business-name-city", urlHelp: "Yelp business page URL" },
  { id: "amazonreviews", name: "Amazon Reviews", description: "Product reviews on Amazon", tier: "team", needsUrl: true, urlPlaceholder: "https://amazon.com/dp/B08N5WRWNW or ASIN", urlHelp: "Amazon product URL or ASIN (10-character code)" },
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

interface NewMonitorFormProps {
  limits: PlanLimits;
  userPlan: string;
}

export function NewMonitorForm({ limits, userPlan }: NewMonitorFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  // Schedule settings
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleStartHour, setScheduleStartHour] = useState(9);
  const [scheduleEndHour, setScheduleEndHour] = useState(17);
  const [scheduleDays, setScheduleDays] = useState<number[]>(WEEKDAYS);
  const [scheduleTimezone, setScheduleTimezone] = useState("America/New_York");

  const isPaidUser = userPlan !== "free";
  const isTeamUser = userPlan === "enterprise";
  const keywordLimit = limits.keywordsPerMonitor;
  const keywordsRemaining = keywordLimit - keywords.length;
  const isAtKeywordLimit = keywords.length >= keywordLimit;

  // Check if a platform is locked based on user's tier
  const isPlatformLocked = (platformTier: string): boolean => {
    if (platformTier === "free") return false; // Reddit - always available
    if (platformTier === "pro") return !isPaidUser; // Pro platforms locked for free users
    if (platformTier === "team") return !isTeamUser; // Team platforms locked for free and pro users
    return true;
  };

  // Generate keyword suggestions based on company name
  const keywordSuggestions = useMemo(() => generateKeywordSuggestions(companyName || name), [companyName, name]);

  const addKeyword = () => {
    if (isAtKeywordLimit) return;
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  };

  const addSuggestedKeyword = (suggestion: string) => {
    if (isAtKeywordLimit) return;
    if (!keywords.includes(suggestion)) {
      setKeywords([...keywords, suggestion]);
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
          platformUrls, // Platform-specific URLs (Google Reviews, Trustpilot, etc.)
          // Schedule settings
          scheduleEnabled,
          scheduleStartHour,
          scheduleEndHour,
          scheduleDays,
          scheduleTimezone,
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

  // Get upgrade plan name
  const getUpgradePlanName = () => {
    if (userPlan === "free") return "Pro";
    if (userPlan === "pro") return "Team";
    return null;
  };

  const upgradePlanName = getUpgradePlanName();

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
              <div className="flex items-center justify-between">
                <Label htmlFor="keywords">
                  Additional Keywords <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                {/* Keyword Counter */}
                <span className={`text-xs font-medium ${
                  isAtKeywordLimit
                    ? "text-amber-500"
                    : keywordsRemaining <= 2
                      ? "text-amber-500/80"
                      : "text-muted-foreground"
                }`}>
                  {keywords.length}/{keywordLimit} keywords
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  id="keywords"
                  placeholder={isAtKeywordLimit ? "Keyword limit reached" : "e.g., customer service, pricing, alternative"}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  disabled={isAtKeywordLimit}
                  className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 disabled:opacity-50"
                />
                <Button
                  type="button"
                  onClick={addKeyword}
                  disabled={isAtKeywordLimit || !keywordInput.trim()}
                  className="bg-teal-500 text-black hover:bg-teal-600 disabled:opacity-50"
                >
                  Add
                </Button>
              </div>

              {/* Keyword Limit Warning / Upgrade Prompt */}
              {isAtKeywordLimit && upgradePlanName && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-xs">
                    You&apos;ve reached your {keywordLimit} keyword limit.{" "}
                    <Link href="/dashboard/settings" className="underline font-medium hover:text-amber-500">
                      Upgrade to {upgradePlanName}
                    </Link>{" "}
                    for more keywords.
                  </span>
                </div>
              )}

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
              {keywordSuggestions.length > 0 && !isAtKeywordLimit && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Suggested keywords</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywordSuggestions
                      .filter(s => !keywords.includes(s))
                      .slice(0, keywordsRemaining) // Only show as many suggestions as remaining slots
                      .map((suggestion) => (
                        <Badge
                          key={suggestion}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => addSuggestedKeyword(suggestion)}
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
            <div className="space-y-4">
              <div>
                <Label>Platforms</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {isTeamUser
                    ? "All 16 platforms available"
                    : isPaidUser
                      ? "8 Pro platforms available • Upgrade to Team for all 16"
                      : "Upgrade to Pro for 8 platforms or Team for all 16"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_PLATFORMS.map((platform) => {
                  const isLocked = isPlatformLocked(platform.tier);
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
                            <div className="flex items-center gap-1">
                              <Lock className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {platform.tier === "team" ? "Team" : "Pro"}
                              </Badge>
                            </div>
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

            {/* Platform-specific URLs */}
            {selectedPlatforms.some(p => ALL_PLATFORMS.find(ap => ap.id === p)?.needsUrl) && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <div>
                  <Label className="text-base">Platform URLs</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Some platforms require specific URLs to monitor. Enter the URL for each selected platform below.
                  </p>
                </div>
                <div className="space-y-4">
                  {selectedPlatforms
                    .filter(p => ALL_PLATFORMS.find(ap => ap.id === p)?.needsUrl)
                    .map((platformId) => {
                      const platform = ALL_PLATFORMS.find(ap => ap.id === platformId);
                      if (!platform) return null;
                      return (
                        <div key={platformId} className="space-y-2">
                          <Label htmlFor={`url-${platformId}`} className="text-sm font-medium">
                            {platform.name} URL
                          </Label>
                          <Input
                            id={`url-${platformId}`}
                            placeholder={platform.urlPlaceholder}
                            value={platformUrls[platformId] || ""}
                            onChange={(e) => setPlatformUrls(prev => ({ ...prev, [platformId]: e.target.value }))}
                            autoComplete="off"
                            className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500"
                          />
                          <p className="text-xs text-muted-foreground">
                            {platform.urlHelp}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Schedule Settings */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label htmlFor="schedule">Schedule Active Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Only scan during specific hours
                    </p>
                  </div>
                </div>
                <Switch
                  id="schedule"
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                />
              </div>

              {scheduleEnabled && (
                <div className="space-y-4 pt-4 border-t">
                  {/* Time Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Select
                        value={String(scheduleStartHour)}
                        onValueChange={(v) => setScheduleStartHour(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {i === 0 ? "12:00 AM" : i === 12 ? "12:00 PM" : i < 12 ? `${i}:00 AM` : `${i - 12}:00 PM`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Select
                        value={String(scheduleEndHour)}
                        onValueChange={(v) => setScheduleEndHour(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {i === 0 ? "12:00 AM" : i === 12 ? "12:00 PM" : i < 12 ? `${i}:00 AM` : `${i - 12}:00 PM`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Days of Week */}
                  <div className="space-y-2">
                    <Label>Active Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setScheduleDays((prev) =>
                              prev.includes(i)
                                ? prev.filter((d) => d !== i)
                                : [...prev, i].sort()
                            );
                          }}
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            scheduleDays.includes(i)
                              ? "bg-teal-500 text-black border-teal-500"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={scheduleTimezone}
                      onValueChange={setScheduleTimezone}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading} className="bg-teal-500 text-black hover:bg-teal-600">
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
