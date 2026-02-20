"use client";

import { useState, useMemo, useId } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, X, Loader2, Sparkles, Lock, AlertCircle, Clock, Wand2, Search, CheckCircle2, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { SearchQueryInput } from "@/components/search-query-input";
import type { PlanLimits } from "@/lib/plans";
import { COMMON_TIMEZONES, WEEKDAYS } from "@/lib/monitor-schedule";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// All 17 platforms with tier-based access
// Pro tier (9 platforms): reddit, hackernews, indiehackers, producthunt, googlereviews, youtube, github, trustpilot, x
// Team tier (17 platforms): + devto, hashnode, appstore, playstore, quora, g2, yelp, amazonreviews
const ALL_PLATFORMS = [
  // Pro tier platforms (9)
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions", tier: "free", needsUrl: false },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions", tier: "pro", needsUrl: false },
  { id: "indiehackers", name: "Indie Hackers", description: "Indie makers and solo founders", tier: "pro", needsUrl: false },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews", tier: "pro", needsUrl: false },
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews on Google", tier: "pro", needsUrl: true, urlPlaceholder: "https://www.google.com/maps/place/... or Place ID", urlHelp: "Google Maps URL or Place ID (ChI...)" },
  { id: "youtube", name: "YouTube", description: "Video comments and discussions", tier: "pro", needsUrl: true, urlPlaceholder: "https://www.youtube.com/watch?v=...", urlHelp: "YouTube video URL to monitor comments" },
  { id: "github", name: "GitHub", description: "Issues and discussions", tier: "pro", needsUrl: false },
  { id: "trustpilot", name: "Trustpilot", description: "Customer reviews and ratings", tier: "pro", needsUrl: true, urlPlaceholder: "https://www.trustpilot.com/review/example.com", urlHelp: "Trustpilot company review page URL" },
  { id: "x", name: "X (Twitter)", description: "Posts and conversations on X", tier: "pro", needsUrl: false },
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

type MonitorType = "keyword" | "ai_discovery";

// Get default platforms for a user's plan
function getDefaultPlatforms(userPlan: string): string[] {
  if (userPlan === "enterprise") {
    return ALL_PLATFORMS.map((p) => p.id);
  }
  if (userPlan === "pro") {
    return ALL_PLATFORMS.filter((p) => p.tier === "free" || p.tier === "pro").map((p) => p.id);
  }
  return ["reddit"];
}

export function NewMonitorForm({ limits, userPlan }: NewMonitorFormProps) {
  const formId = useId();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showFullForm, setShowFullForm] = useState(false);

  // Quick Create state
  const [quickBrandName, setQuickBrandName] = useState("");
  const [quickIsLoading, setQuickIsLoading] = useState(false);

  const quickKeywordSuggestions = useMemo(
    () => generateKeywordSuggestions(quickBrandName),
    [quickBrandName]
  );
  const [quickSelectedKeywords, setQuickSelectedKeywords] = useState<string[]>([]);

  const toggleQuickKeyword = (keyword: string) => {
    setQuickSelectedKeywords((prev) =>
      prev.includes(keyword) ? prev.filter((k) => k !== keyword) : prev.length < limits.keywordsPerMonitor ? [...prev, keyword] : prev
    );
  };

  const handleQuickCreate = async () => {
    if (!quickBrandName.trim()) {
      toast.error("Please enter a brand or company name");
      return;
    }

    setQuickIsLoading(true);
    try {
      const platforms = getDefaultPlatforms(userPlan);
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${quickBrandName.trim()} Monitor`,
          companyName: quickBrandName.trim(),
          monitorType: "keyword",
          keywords: quickSelectedKeywords,
          platforms,
          platformUrls: {},
          scheduleEnabled: false,
          scheduleStartHour: 9,
          scheduleEndHour: 17,
          scheduleDays: WEEKDAYS,
          scheduleTimezone: "America/New_York",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create monitor");
      }

      toast.success("Monitor created! We'll start scanning shortly.", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setTimeout(() => {
        router.push("/dashboard/monitors");
        router.refresh();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setQuickIsLoading(false);
    }
  };
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  // AI Discovery mode (Pro/Team feature)
  const [monitorType, setMonitorType] = useState<MonitorType>("keyword");
  const [discoveryPrompt, setDiscoveryPrompt] = useState("");

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

    // Validate AI Discovery mode
    if (monitorType === "ai_discovery" && !discoveryPrompt.trim()) {
      setError("Please describe what you want to find for AI Discovery mode");
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
          monitorType, // keyword or ai_discovery
          keywords: monitorType === "keyword" ? keywords : [], // Only for keyword mode
          searchQuery: monitorType === "keyword" && searchQuery.trim() ? searchQuery.trim() : undefined,
          discoveryPrompt: monitorType === "ai_discovery" ? discoveryPrompt.trim() : undefined,
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

      toast.success("Monitor created! We'll start scanning shortly.", {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      // Give user a moment to see the success message
      setTimeout(() => {
        router.push("/dashboard/monitors");
        router.refresh();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/dashboard/monitors">
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New Monitor</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Set up a new keyword monitor to track mentions.
          </p>
        </div>
      </div>

      {/* Quick Create Section */}
      <Card className="border-teal-500/30 bg-teal-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-teal-500" />
            <CardTitle>Quick Create</CardTitle>
          </div>
          <CardDescription>
            Enter your brand name and create a monitor in seconds with sensible defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-quick-brand`}>Brand / Company Name</Label>
            <Input
              id={`${formId}-quick-brand`}
              placeholder="e.g., Acme Corp, High Rise Coffee"
              value={quickBrandName}
              onChange={(e) => {
                setQuickBrandName(e.target.value);
                setQuickSelectedKeywords([]);
              }}
              autoComplete="off"
              className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 min-h-[44px]"
            />
          </div>

          {/* Auto-suggested keywords */}
          {quickBrandName.trim() && quickKeywordSuggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">
                  Suggested keywords (optional)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickKeywordSuggestions.map((suggestion) => (
                  <Badge
                    key={suggestion}
                    variant={quickSelectedKeywords.includes(suggestion) ? "default" : "outline"}
                    className="cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground min-h-[36px] px-3 text-sm"
                    onClick={() => toggleQuickKeyword(suggestion)}
                  >
                    {quickSelectedKeywords.includes(suggestion) ? "" : "+ "}
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Quick create defaults info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              Defaults: {userPlan === "enterprise" ? "All 17 platforms" : userPlan === "pro" ? "9 Pro platforms" : "Reddit"} | Keyword mode | Scans on your plan&apos;s schedule
            </p>
          </div>

          <Button
            onClick={handleQuickCreate}
            disabled={quickIsLoading || !quickBrandName.trim()}
            className="bg-teal-500 text-black hover:bg-teal-600 w-full sm:w-auto min-h-[44px]"
          >
            {quickIsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Zap className="mr-2 h-4 w-4" />
            Create Monitor
          </Button>
        </CardContent>
      </Card>

      {/* Divider with toggle to full form */}
      <Collapsible open={showFullForm} onOpenChange={setShowFullForm}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 w-full justify-center py-3 min-h-[44px] text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFullForm ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showFullForm ? "Hide advanced options" : "Or customize everything below"}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Monitor Details</CardTitle>
            <CardDescription>
              Configure what you want to track across platforms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 sm:space-y-6">
            {/* Monitor Name */}
            <div className="space-y-2">
              <Label htmlFor={`${formId}-name`}>Monitor Name</Label>
              <Input
                id={`${formId}-name`}
                placeholder="e.g., Brand Reputation, Customer Feedback"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this monitor in your dashboard.
              </p>
            </div>

            {/* Company/Brand Name */}
            <div className="space-y-2">
              <Label htmlFor={`${formId}-companyName`}>Company/Brand Name</Label>
              <Input
                id={`${formId}-companyName`}
                placeholder="e.g., High Rise Coffee, Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="off"
                className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">
                The company or brand you want to monitor. We&apos;ll search for this name across selected platforms.
              </p>
            </div>

            {/* Monitor Mode Selection (Pro/Team feature) */}
            <div className="space-y-3">
              <Label>Monitor Mode</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Keyword Mode */}
                <button
                  type="button"
                  onClick={() => setMonitorType("keyword")}
                  className={`relative flex flex-col items-start p-4 min-h-[44px] rounded-lg border-2 transition-all ${
                    monitorType === "keyword"
                      ? "border-teal-500 bg-teal-500/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Search className="h-4 w-4" />
                    <span className="font-medium">Keyword Mode</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    Traditional keyword matching. Find posts containing specific terms.
                  </p>
                </button>

                {/* AI Discovery Mode */}
                <button
                  type="button"
                  onClick={() => {
                    if (isPaidUser) {
                      setMonitorType("ai_discovery");
                    }
                  }}
                  disabled={!isPaidUser}
                  className={`relative flex flex-col items-start p-4 min-h-[44px] rounded-lg border-2 transition-all ${
                    monitorType === "ai_discovery"
                      ? "border-purple-500 bg-purple-500/5"
                      : !isPaidUser
                        ? "border-border opacity-60 cursor-not-allowed"
                        : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  {!isPaidUser && (
                    <div className="absolute -top-2 -right-2">
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Lock className="h-3 w-3" />
                        Pro
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">AI Discovery</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    AI finds relevant posts semantically, no keywords needed.
                  </p>
                </button>
              </div>
            </div>

            {/* AI Discovery Prompt (shown when AI Discovery mode is selected) */}
            {monitorType === "ai_discovery" && (
              <div className="space-y-2 p-4 rounded-lg border bg-purple-500/5 border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="h-4 w-4 text-purple-500" />
                  <Label htmlFor={`${formId}-discoveryPrompt`} className="text-purple-300">
                    What are you looking for?
                  </Label>
                </div>
                <Textarea
                  id={`${formId}-discoveryPrompt`}
                  placeholder="e.g., People who are frustrated with their current project management tool and looking for alternatives&#10;&#10;or&#10;&#10;Developers asking for recommendations on API testing tools"
                  value={discoveryPrompt}
                  onChange={(e) => setDiscoveryPrompt(e.target.value)}
                  rows={4}
                  className="dark-input placeholder:text-gray-400 hover:border-purple-500 focus:border-purple-500 resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Describe in natural language what kind of posts you want to find. AI will semantically match content even without exact keyword matches.
                </p>
                <div className="mt-3 p-3 rounded bg-muted/50 text-xs">
                  <p className="font-medium mb-1">Examples of what AI Discovery can find:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>&quot;Need help organizing my team&apos;s tasks&quot; → Project management need</li>
                    <li>&quot;Waited 3 days for a response from support&quot; → Competitor complaint</li>
                    <li>&quot;Is there anything better than X?&quot; → Buyer intent</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Keywords (Optional - only shown for keyword mode) */}
            {monitorType === "keyword" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${formId}-keywords`}>
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
                  id={`${formId}-keywords`}
                  placeholder={isAtKeywordLimit ? "Keyword limit reached" : "e.g., customer service, pricing, alternative"}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  disabled={isAtKeywordLimit}
                  className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 disabled:opacity-50 min-h-[44px]"
                />
                <Button
                  type="button"
                  onClick={addKeyword}
                  disabled={isAtKeywordLimit || !keywordInput.trim()}
                  className="bg-teal-500 text-black hover:bg-teal-600 disabled:opacity-50 min-h-[44px] min-w-[44px]"
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
                    <Badge key={keyword} variant="secondary" className="gap-1 min-h-[36px] px-3 text-sm">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                        className="ml-1 hover:text-destructive min-w-[24px] min-h-[24px] flex items-center justify-center"
                      >
                        <X className="h-3.5 w-3.5" />
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
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors min-h-[36px] px-3 text-sm"
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
            )}

            {/* Advanced Search Query (Pro feature) - only for keyword mode */}
            {monitorType === "keyword" && (
            <div className="space-y-2">
              <SearchQueryInput
                value={searchQuery}
                onChange={setSearchQuery}
                isPro={isPaidUser}
              />
            </div>
            )}

            {/* Platforms */}
            <div className="space-y-4">
              <div>
                <Label>Platforms</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {isTeamUser
                    ? "All 17 platforms available"
                    : isPaidUser
                      ? "9 Pro platforms available • Upgrade to Team for all 17"
                      : "Upgrade to Pro for 9 platforms or Team for all 17"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ALL_PLATFORMS.map((platform) => {
                  const isLocked = isPlatformLocked(platform.tier);
                  const isSelected = selectedPlatforms.includes(platform.id);

                  return (
                    <label
                      key={platform.id}
                      htmlFor={`${formId}-platform-${platform.id}`}
                      className={`flex items-center space-x-3 rounded-lg border p-4 min-h-[56px] transition-colors ${
                        isLocked
                          ? "opacity-60 cursor-not-allowed bg-muted/30"
                          : "cursor-pointer hover:bg-muted/50 active:bg-muted/70"
                      } ${isSelected ? "border-primary bg-primary/5" : ""}`}
                    >
                      <Checkbox
                        id={`${formId}-platform-${platform.id}`}
                        checked={isSelected}
                        disabled={isLocked}
                        className="h-5 w-5"
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
                          <Label htmlFor={`${formId}-url-${platformId}`} className="text-sm font-medium">
                            {platform.name} URL
                          </Label>
                          <Input
                            id={`${formId}-url-${platformId}`}
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
                    <Label htmlFor={`${formId}-schedule`}>Schedule Active Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Only scan during specific hours
                    </p>
                  </div>
                </div>
                <Switch
                  id={`${formId}-schedule`}
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
                        <SelectTrigger aria-label="Start time" className="min-h-[44px]">
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
                        <SelectTrigger aria-label="End time" className="min-h-[44px]">
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
                          className={`px-3 py-2 min-h-[44px] min-w-[44px] text-sm rounded-md border transition-colors ${
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
                      <SelectTrigger aria-label="Timezone" className="min-h-[44px]">
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
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button type="submit" disabled={isLoading} className="bg-teal-500 text-black hover:bg-teal-600 w-full sm:w-auto min-h-[44px]">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Monitor
              </Button>
              <Link href="/dashboard/monitors" className="w-full sm:w-auto">
                <Button type="button" variant="outline" className="w-full sm:w-auto min-h-[44px]">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
