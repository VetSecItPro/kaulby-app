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
import { ArrowLeft, X, Loader2, Sparkles, Lock, AlertCircle, Clock, Wand2, Search, CheckCircle2, Globe, Link2, Info } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { SearchQueryInput } from "@/components/search-query-input";
import type { PlanLimits } from "@/lib/plans";
import { COMMON_TIMEZONES, WEEKDAYS } from "@/lib/monitor-schedule";

// Platform categories for context-aware grouping
type PlatformCategory = "keyword" | "url_required" | "business_listing";

interface PlatformDef {
  id: string;
  name: string;
  description: string;
  tier: string;
  needsUrl: boolean;
  optionalUrl?: boolean;
  urlPlaceholder?: string;
  urlHelp?: string;
  category: PlatformCategory;
  keywordTips?: string;
}

// All 16 platforms with tier-based access and category grouping
const ALL_PLATFORMS: PlatformDef[] = [
  // Keyword-searchable platforms (search by terms, no URL needed)
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions", tier: "free", needsUrl: false, category: "keyword", keywordTips: "Use broad topic terms, industry phrases, and competitor names" },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions", tier: "solo", needsUrl: false, category: "keyword", keywordTips: "Best for tech companies, dev tools, and startup topics" },
  { id: "indiehackers", name: "Indie Hackers", description: "Indie makers and solo founders", tier: "solo", needsUrl: false, category: "keyword", keywordTips: "Works well with product names and business topics" },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews", tier: "solo", needsUrl: false, category: "keyword", keywordTips: "Product names, categories, and launch-related terms" },
  { id: "github", name: "GitHub", description: "Issues and discussions", tier: "solo", needsUrl: false, category: "keyword", keywordTips: "Repository names, library names, and technical terms" },
  { id: "x", name: "X (Twitter)", description: "Posts and conversations on X", tier: "solo", needsUrl: false, category: "keyword", keywordTips: "Include hashtags (#industry) and @handles for better results" },
  { id: "devto", name: "Dev.to", description: "Developer blog posts and discussions", tier: "growth", needsUrl: false, category: "keyword", keywordTips: "Tech topics, frameworks, and programming concepts" },
  { id: "hashnode", name: "Hashnode", description: "Tech blog network", tier: "growth", needsUrl: false, category: "keyword", keywordTips: "Developer topics, frameworks, and technical tutorials" },
  // quora: deferred — see .mdmp/apify-platform-cost-audit-2026-04-21.md
  // URL-required platforms (need a specific product/app/video URL)
  { id: "youtube", name: "YouTube", description: "Video comments and discussions", tier: "solo", needsUrl: true, category: "url_required", urlPlaceholder: "https://www.youtube.com/@channel or video URL", urlHelp: "Paste your YouTube channel URL or a specific video URL to monitor comments." },
  { id: "appstore", name: "App Store", description: "iOS app reviews", tier: "growth", needsUrl: true, category: "url_required", urlPlaceholder: "https://apps.apple.com/us/app/name/id123456", urlHelp: "Open your app in the App Store, tap Share, and copy the link." },
  { id: "playstore", name: "Play Store", description: "Android app reviews", tier: "growth", needsUrl: true, category: "url_required", urlPlaceholder: "https://play.google.com/store/apps/details?id=com.app", urlHelp: "Open your app in Google Play, tap Share, and copy the link." },
  { id: "amazonreviews", name: "Amazon Reviews", description: "Product reviews on Amazon", tier: "growth", needsUrl: true, category: "url_required", urlPlaceholder: "https://amazon.com/dp/B08N5WRWNW or ASIN", urlHelp: "Copy your product's Amazon URL, or find the ASIN in the product details section." },
  // Business listing platforms (optional URL for better accuracy, searches by name otherwise)
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews on Google", tier: "solo", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.google.com/maps/place/... or Place ID", urlHelp: "Optional — paste your Google Maps URL for more accurate results, or we'll search by company name." },
  { id: "trustpilot", name: "Trustpilot", description: "Customer reviews and ratings", tier: "solo", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.trustpilot.com/review/example.com", urlHelp: "Optional — paste your Trustpilot page URL for exact results, or we'll search by company name." },
  { id: "g2", name: "G2", description: "Software reviews and ratings", tier: "growth", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.g2.com/products/your-product/reviews", urlHelp: "Optional — paste your G2 product URL for exact results, or we'll search by company name." },
  { id: "yelp", name: "Yelp", description: "Local business reviews", tier: "growth", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.yelp.com/biz/business-name-city", urlHelp: "Optional — paste your Yelp page URL for exact results, or we'll search by company name." },
];

// Platform-aware keyword suggestions based on company name AND selected platforms
function generateKeywordSuggestions(companyName: string, selectedPlatforms: string[]): string[] {
  const name = companyName.trim();
  if (!name) return [];

  const suggestions: string[] = [];

  // Always suggest company-related terms
  suggestions.push(
    `${name} review`,
    `${name} alternative`,
    `${name} vs`,
  );

  // Platform-specific suggestions
  const hasReddit = selectedPlatforms.includes("reddit");
  const hasX = selectedPlatforms.includes("x");
  const hasHN = selectedPlatforms.includes("hackernews");
  const hasDevTo = selectedPlatforms.includes("devto") || selectedPlatforms.includes("hashnode");

  if (hasReddit) {
    suggestions.push(
      `looking for ${name.split(" ")[0].toLowerCase()}`,
      `recommend ${name.split(" ")[0].toLowerCase()}`,
      `problems with ${name}`,
    );
  }

  if (hasX) {
    suggestions.push(
      `#${name.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")}`,
    );
  }

  if (hasHN || hasDevTo) {
    suggestions.push(
      `best ${name.split(" ")[0].toLowerCase()}`,
    );
  }

  // General high-intent keywords
  suggestions.push(
    "switching from",
    "better than",
  );

  // Remove duplicates and return top 8
  return Array.from(new Set(suggestions)).slice(0, 8);
}

interface NewMonitorFormProps {
  limits: PlanLimits;
  userPlan: string;
}

type MonitorType = "keyword" | "ai_discovery";

export function NewMonitorForm({ limits, userPlan }: NewMonitorFormProps) {
  const formId = useId();
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
  const isTeamUser = userPlan === "growth";
  const keywordLimit = limits.keywordsPerMonitor;
  const keywordsRemaining = keywordLimit - keywords.length;
  const isAtKeywordLimit = keywords.length >= keywordLimit;

  // Check if a platform is locked based on user's tier
  const isPlatformLocked = (platformTier: string): boolean => {
    if (platformTier === "free") return false;
    if (platformTier === "solo") return !isPaidUser;
    if (platformTier === "growth") return !isTeamUser;
    return true;
  };

  // Categorize selected platforms
  const selectedByCategory = useMemo(() => {
    const keyword = selectedPlatforms.filter(id => ALL_PLATFORMS.find(p => p.id === id)?.category === "keyword");
    const urlRequired = selectedPlatforms.filter(id => ALL_PLATFORMS.find(p => p.id === id)?.category === "url_required");
    const businessListing = selectedPlatforms.filter(id => ALL_PLATFORMS.find(p => p.id === id)?.category === "business_listing");
    return { keyword, urlRequired, businessListing };
  }, [selectedPlatforms]);

  // Platform-aware keyword suggestions
  const keywordSuggestions = useMemo(
    () => generateKeywordSuggestions(companyName || name, selectedPlatforms),
    [companyName, name, selectedPlatforms]
  );

  // Context-aware helper text for keywords based on selected platforms
  const keywordHelperText = useMemo(() => {
    const tips: string[] = [];
    const selected = selectedPlatforms.map(id => ALL_PLATFORMS.find(p => p.id === id)).filter(Boolean) as PlatformDef[];
    const keywordPlatforms = selected.filter(p => p.category === "keyword");

    if (keywordPlatforms.length === 0) return null;

    const names = keywordPlatforms.slice(0, 3).map(p => p.name).join(", ");
    const more = keywordPlatforms.length > 3 ? ` +${keywordPlatforms.length - 3} more` : "";
    tips.push(`Keywords search across ${names}${more}.`);

    if (selectedPlatforms.includes("reddit")) {
      tips.push("For Reddit, use broad topic terms and phrases people actually search for — not just your company name.");
    }
    if (selectedPlatforms.includes("x")) {
      tips.push("For X, include #hashtags and @handles for better coverage.");
    }
    if (selectedPlatforms.includes("devto") || selectedPlatforms.includes("hashnode")) {
      tips.push("For Dev.to/Hashnode, use tech-related single-word tags (e.g., react, devops) alongside your brand terms.");
    }

    return tips;
  }, [selectedPlatforms]);

  // Warnings for URL-required platforms without URLs
  const urlWarnings = useMemo(() => {
    return selectedByCategory.urlRequired
      .filter(id => !platformUrls[id]?.trim())
      .map(id => {
        const platform = ALL_PLATFORMS.find(p => p.id === id);
        return platform ? `${platform.name} requires a URL to work. Without one, this platform will be skipped.` : null;
      })
      .filter(Boolean) as string[];
  }, [selectedByCategory.urlRequired, platformUrls]);

  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    if (!name || name === `${companyName} Monitor` || name === "Monitor") {
      setName(value ? `${value} Monitor` : "");
    }
  };

  const handlePlatformToggle = (platformId: string, checked: boolean) => {
    if (checked) {
      setSelectedPlatforms((prev) => [...prev, platformId]);
    } else {
      setSelectedPlatforms((prev) => prev.filter((p) => p !== platformId));
    }
  };

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

    if (!companyName.trim()) {
      setError("Please enter the company/brand name to monitor");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("Please select at least one platform");
      return;
    }

    if (monitorType === "ai_discovery" && !discoveryPrompt.trim()) {
      setError("Please describe what you want to find for AI Discovery mode");
      return;
    }

    // Validate required platform URLs
    const missingUrls = selectedPlatforms
      .filter(p => ALL_PLATFORMS.find(ap => ap.id === p)?.needsUrl)
      .filter(p => !platformUrls[p]?.trim());
    if (missingUrls.length > 0) {
      const names = missingUrls.map(p => ALL_PLATFORMS.find(ap => ap.id === p)?.name).join(", ");
      setError(`Please provide a URL for: ${names}`);
      return;
    }

    const monitorName = name.trim() || `${companyName.trim()} Monitor`;

    setIsLoading(true);

    try {
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: monitorName,
          companyName: companyName.trim(),
          monitorType,
          keywords: monitorType === "keyword" ? keywords : [],
          searchQuery: monitorType === "keyword" && searchQuery.trim() ? searchQuery.trim() : undefined,
          discoveryPrompt: monitorType === "ai_discovery" ? discoveryPrompt.trim() : undefined,
          platforms: selectedPlatforms,
          platformUrls,
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

  const getUpgradePlanName = () => {
    if (userPlan === "free") return "Pro";
    if (userPlan === "solo") return "Team";
    return null;
  };

  const upgradePlanName = getUpgradePlanName();

  // Render a platform checkbox card
  const renderPlatformCard = (platform: PlatformDef) => {
    const isLocked = isPlatformLocked(platform.tier);
    const isSelected = selectedPlatforms.includes(platform.id);

    return (
      <label
        key={platform.id}
        htmlFor={`${formId}-platform-${platform.id}`}
        className={`flex items-center space-x-3 rounded-lg border p-3 min-h-[52px] transition-colors ${
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
              handlePlatformToggle(platform.id, checked);
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
                  {platform.tier === "growth" ? "Team" : "Pro"}
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
  };

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
            Set up a monitor to track mentions across platforms.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Section 1: Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Monitor Details</CardTitle>
              <CardDescription>
                Enter your brand name and choose how you want to monitor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company/Brand Name */}
              <div className="space-y-2">
                <Label htmlFor={`${formId}-companyName`}>Company / Brand Name</Label>
                <Input
                  id={`${formId}-companyName`}
                  placeholder="e.g., Alexander's Mexican Restaurant, Acme Corp"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={error ? `${formId}-form-error` : undefined}
                  className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 min-h-[44px] text-base"
                />
                <p className="text-xs text-muted-foreground">
                  The company or brand you want to monitor. We&apos;ll search for this name across selected platforms.
                </p>
              </div>

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

              {/* Monitor Mode Selection */}
              <div className="space-y-3">
                <Label>Monitor Mode</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <button
                    type="button"
                    onClick={() => { if (isPaidUser) setMonitorType("ai_discovery"); }}
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

              {/* AI Discovery Prompt */}
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
                    placeholder={"e.g., People who are frustrated with their current project management tool and looking for alternatives\n\nor\n\nDevelopers asking for recommendations on API testing tools"}
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
            </CardContent>
          </Card>

          {/* Section 2: Platforms — grouped by category */}
          <Card>
            <CardHeader>
              <CardTitle>Platforms</CardTitle>
              <CardDescription>
                {isTeamUser
                  ? "All 16 platforms available. Different platforms need different inputs — we'll guide you."
                  : isPaidUser
                    ? "9 Pro platforms available. Upgrade to Team for all 17."
                    : "Upgrade to Pro for 9 platforms or Team for all 17."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Group 1: Keyword-searchable platforms */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-teal-500" />
                  <Label className="text-sm font-semibold">Discussion & Social Platforms</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  These platforms search by keywords. Your company name and keywords are used to find relevant posts, discussions, and articles.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ALL_PLATFORMS.filter(p => p.category === "keyword").map(renderPlatformCard)}
                </div>
              </div>

              {/* Group 2: URL-required platforms */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-amber-500" />
                  <Label className="text-sm font-semibold">Product & App Platforms</Label>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-500 border-amber-500/30">URL required</Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  These platforms monitor a specific product page. You&apos;ll need to paste your product&apos;s URL below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ALL_PLATFORMS.filter(p => p.category === "url_required").map(renderPlatformCard)}
                </div>

                {/* Inline URL inputs for selected URL-required platforms */}
                {selectedByCategory.urlRequired.length > 0 && (
                  <div className="space-y-3 mt-2 pl-2 border-l-2 border-amber-500/30">
                    {selectedByCategory.urlRequired.map((platformId) => {
                      const platform = ALL_PLATFORMS.find(p => p.id === platformId);
                      if (!platform) return null;
                      const isEmpty = !platformUrls[platformId]?.trim();
                      return (
                        <div key={platformId} className="space-y-1.5">
                          <Label htmlFor={`${formId}-url-${platformId}`} className="text-sm">
                            {platform.name} URL <span className="text-red-400">*</span>
                          </Label>
                          <Input
                            id={`${formId}-url-${platformId}`}
                            placeholder={platform.urlPlaceholder}
                            value={platformUrls[platformId] || ""}
                            onChange={(e) => setPlatformUrls(prev => ({ ...prev, [platformId]: e.target.value }))}
                            autoComplete="off"
                            className={`dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 ${isEmpty ? "border-amber-500/50" : "border-green-500/50"}`}
                          />
                          <p className="text-xs text-muted-foreground">{platform.urlHelp}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* URL warnings */}
                {urlWarnings.length > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      {urlWarnings.map((warning, i) => (
                        <p key={i} className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Group 3: Business listing platforms */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-semibold">Review & Listing Platforms</Label>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-500 border-blue-500/30">URL optional</Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  We&apos;ll search by your company name automatically. Adding your listing URL improves accuracy.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ALL_PLATFORMS.filter(p => p.category === "business_listing").map(renderPlatformCard)}
                </div>

                {/* Inline URL inputs for selected business listing platforms */}
                {selectedByCategory.businessListing.length > 0 && (
                  <div className="space-y-3 mt-2 pl-2 border-l-2 border-blue-500/30">
                    {selectedByCategory.businessListing.map((platformId) => {
                      const platform = ALL_PLATFORMS.find(p => p.id === platformId);
                      if (!platform) return null;
                      return (
                        <div key={platformId} className="space-y-1.5">
                          <Label htmlFor={`${formId}-url-${platformId}`} className="text-sm">
                            {platform.name} URL <span className="text-muted-foreground font-normal">(optional)</span>
                          </Label>
                          <Input
                            id={`${formId}-url-${platformId}`}
                            placeholder={platform.urlPlaceholder}
                            value={platformUrls[platformId] || ""}
                            onChange={(e) => setPlatformUrls(prev => ({ ...prev, [platformId]: e.target.value }))}
                            autoComplete="off"
                            className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500"
                          />
                          <p className="text-xs text-muted-foreground">{platform.urlHelp}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Keywords & Search — context-aware */}
          {monitorType === "keyword" && (
            <Card>
              <CardHeader>
                <CardTitle>Search Keywords</CardTitle>
                <CardDescription>
                  {selectedByCategory.keyword.length > 0
                    ? "Add keywords to find relevant discussions. Your company name is always searched automatically."
                    : "Select discussion platforms above to enable keyword search."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Context-aware platform tips */}
                {keywordHelperText && keywordHelperText.length > 0 && (
                  <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-teal-500" />
                      <span className="text-xs font-semibold text-teal-500">Keyword tips for your platforms</span>
                    </div>
                    <ul className="space-y-1">
                      {keywordHelperText.map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground">{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Keyword input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${formId}-keywords`}>
                      Additional Keywords <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
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

                  {/* Smart keyword suggestions */}
                  {keywordSuggestions.length > 0 && !isAtKeywordLimit && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Suggested keywords{selectedPlatforms.length > 0 ? " for your platforms" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {keywordSuggestions
                          .filter(s => !keywords.includes(s))
                          .slice(0, keywordsRemaining)
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
                    Your company name &quot;{companyName || "..."}&quot; is always searched automatically. Add extra terms to catch more mentions.
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
              </CardContent>
            </Card>
          )}

          {/* Section 4: Schedule */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
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
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p id={`${formId}-form-error`} role="alert" className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4">
            <Link href="/dashboard/monitors" className="w-full sm:w-auto">
              <Button type="button" variant="outline" className="w-full sm:w-auto min-h-[44px]">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isLoading} className="bg-teal-500 text-black hover:bg-teal-600 w-full sm:w-auto min-h-[44px]">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Monitor
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
