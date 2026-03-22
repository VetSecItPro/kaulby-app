"use client";

import { useState, useEffect, useMemo, useId } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, X, Loader2, Trash2, Lock, AlertCircle, Clock, Globe, Link2, Search } from "lucide-react";
import Link from "next/link";
import type { PlanLimits } from "@/lib/plans";
import { COMMON_TIMEZONES, WEEKDAYS } from "@/lib/monitor-schedule";

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
}

const ALL_PLATFORMS: PlatformDef[] = [
  // Keyword-searchable
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions", tier: "free", needsUrl: false, category: "keyword" },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions", tier: "pro", needsUrl: false, category: "keyword" },
  { id: "indiehackers", name: "Indie Hackers", description: "Indie makers and solo founders", tier: "pro", needsUrl: false, category: "keyword" },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews", tier: "pro", needsUrl: false, category: "keyword" },
  { id: "github", name: "GitHub", description: "Issues and discussions", tier: "pro", needsUrl: false, category: "keyword" },
  { id: "x", name: "X (Twitter)", description: "Posts and conversations on X", tier: "pro", needsUrl: false, category: "keyword" },
  { id: "devto", name: "Dev.to", description: "Developer blog posts and discussions", tier: "team", needsUrl: false, category: "keyword" },
  { id: "hashnode", name: "Hashnode", description: "Tech blog network", tier: "team", needsUrl: false, category: "keyword" },
  { id: "quora", name: "Quora", description: "Q&A discussions", tier: "team", needsUrl: false, category: "keyword" },
  // URL-required
  { id: "youtube", name: "YouTube", description: "Video comments and discussions", tier: "pro", needsUrl: true, category: "url_required", urlPlaceholder: "https://www.youtube.com/@channel or video URL", urlHelp: "Paste your YouTube channel URL or a specific video URL to monitor comments." },
  { id: "appstore", name: "App Store", description: "iOS app reviews", tier: "team", needsUrl: true, category: "url_required", urlPlaceholder: "https://apps.apple.com/us/app/name/id123456", urlHelp: "Open your app in the App Store, tap Share, and copy the link." },
  { id: "playstore", name: "Play Store", description: "Android app reviews", tier: "team", needsUrl: true, category: "url_required", urlPlaceholder: "https://play.google.com/store/apps/details?id=com.app", urlHelp: "Open your app in Google Play, tap Share, and copy the link." },
  { id: "amazonreviews", name: "Amazon Reviews", description: "Product reviews on Amazon", tier: "team", needsUrl: true, category: "url_required", urlPlaceholder: "https://amazon.com/dp/B08N5WRWNW or ASIN", urlHelp: "Copy your product's Amazon URL, or find the ASIN in the product details section." },
  // Business listing (optional URL)
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews on Google", tier: "pro", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.google.com/maps/place/... or Place ID", urlHelp: "Optional — paste your Google Maps URL for more accurate results, or we'll search by company name." },
  { id: "trustpilot", name: "Trustpilot", description: "Customer reviews and ratings", tier: "pro", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.trustpilot.com/review/example.com", urlHelp: "Optional — paste your Trustpilot page URL for exact results, or we'll search by company name." },
  { id: "g2", name: "G2", description: "Software reviews and ratings", tier: "team", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.g2.com/products/your-product/reviews", urlHelp: "Optional — paste your G2 product URL for exact results, or we'll search by company name." },
  { id: "yelp", name: "Yelp", description: "Local business reviews", tier: "team", needsUrl: false, optionalUrl: true, category: "business_listing", urlPlaceholder: "https://www.yelp.com/biz/business-name-city", urlHelp: "Optional — paste your Yelp page URL for exact results, or we'll search by company name." },
];

interface EditMonitorFormProps {
  monitorId: string;
  limits: PlanLimits;
  userPlan: string;
}

export function EditMonitorForm({ monitorId, limits, userPlan }: EditMonitorFormProps) {
  const formId = useId();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleStartHour, setScheduleStartHour] = useState(9);
  const [scheduleEndHour, setScheduleEndHour] = useState(17);
  const [scheduleDays, setScheduleDays] = useState<number[]>(WEEKDAYS);
  const [scheduleTimezone, setScheduleTimezone] = useState("America/New_York");

  const isPaidUser = userPlan !== "free";
  const isTeamUser = userPlan === "team";
  const keywordLimit = limits.keywordsPerMonitor;
  const keywordsRemaining = keywordLimit - keywords.length;
  const isAtKeywordLimit = keywords.length >= keywordLimit;

  const isPlatformLocked = (platformTier: string): boolean => {
    if (platformTier === "free") return false;
    if (platformTier === "pro") return !isPaidUser;
    if (platformTier === "team") return !isTeamUser;
    return true;
  };

  const getUpgradePlanName = () => {
    if (userPlan === "free") return "Pro";
    if (userPlan === "pro") return "Team";
    return null;
  };
  const upgradePlanName = getUpgradePlanName();

  const selectedByCategory = useMemo(() => {
    const keyword = selectedPlatforms.filter(id => ALL_PLATFORMS.find(p => p.id === id)?.category === "keyword");
    const urlRequired = selectedPlatforms.filter(id => ALL_PLATFORMS.find(p => p.id === id)?.category === "url_required");
    const businessListing = selectedPlatforms.filter(id => ALL_PLATFORMS.find(p => p.id === id)?.category === "business_listing");
    return { keyword, urlRequired, businessListing };
  }, [selectedPlatforms]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadMonitor() {
      try {
        const response = await fetch(`/api/monitors/${monitorId}`, { signal: abortController.signal });
        if (!response.ok) {
          if (response.status === 404) { router.push("/dashboard/monitors"); return; }
          throw new Error("Failed to load monitor");
        }
        const data = await response.json();
        setName(data.monitor.name);
        setCompanyName(data.monitor.companyName || "");
        setKeywords(data.monitor.keywords || []);
        setSelectedPlatforms(data.monitor.platforms);
        setPlatformUrls(data.monitor.platformUrls || {});
        setIsActive(data.monitor.isActive);
        setScheduleEnabled(data.monitor.scheduleEnabled ?? false);
        setScheduleStartHour(data.monitor.scheduleStartHour ?? 9);
        setScheduleEndHour(data.monitor.scheduleEndHour ?? 17);
        setScheduleDays(data.monitor.scheduleDays ?? WEEKDAYS);
        setScheduleTimezone(data.monitor.scheduleTimezone ?? "America/New_York");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load monitor");
      } finally {
        if (!abortController.signal.aborted) setIsLoading(false);
      }
    }
    loadMonitor();
    return () => abortController.abort();
  }, [monitorId, router]);

  const addKeyword = () => {
    if (isAtKeywordLimit) return;
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => setKeywords(keywords.filter((k) => k !== keyword));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
  };

  const handlePlatformToggle = (platformId: string, checked: boolean) => {
    if (checked) {
      setSelectedPlatforms((prev) => [...prev, platformId]);
    } else {
      setSelectedPlatforms((prev) => prev.filter((p) => p !== platformId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter a monitor name"); return; }
    if (!companyName.trim()) { setError("Please enter the company/brand name to monitor"); return; }
    if (selectedPlatforms.length === 0) { setError("Please select at least one platform"); return; }

    const missingUrls = selectedPlatforms
      .filter(p => ALL_PLATFORMS.find(ap => ap.id === p)?.needsUrl)
      .filter(p => !platformUrls[p]?.trim());
    if (missingUrls.length > 0) {
      const names = missingUrls.map(p => ALL_PLATFORMS.find(ap => ap.id === p)?.name).join(", ");
      setError(`Please provide a URL for: ${names}`);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/monitors/${monitorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), companyName: companyName.trim(), keywords,
          platforms: selectedPlatforms, platformUrls, isActive,
          scheduleEnabled, scheduleStartHour, scheduleEndHour, scheduleDays, scheduleTimezone,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update monitor");
      }
      router.push(`/dashboard/monitors/${monitorId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this monitor? This action cannot be undone.")) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/monitors/${monitorId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete monitor");
      }
      router.push("/dashboard/monitors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
                  {platform.tier === "team" ? "Team" : "Pro"}
                </Badge>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{platform.description}</p>
        </div>
      </label>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/monitors/${monitorId}`}>
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit Monitor</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Update your monitor settings.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Section 1: Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Monitor Details</CardTitle>
              <CardDescription>Configure what you want to track across platforms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${formId}-companyName`}>Company / Brand Name</Label>
                <Input
                  id={`${formId}-companyName`}
                  placeholder="e.g., High Rise Coffee, Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="off"
                  aria-invalid={!!error}
                  aria-describedby={error ? `${formId}-form-error` : undefined}
                  className="dark-input placeholder:text-gray-400 hover:border-teal-500 focus:border-teal-500 min-h-[44px]"
                />
                <p className="text-xs text-muted-foreground">
                  The company or brand you want to monitor. We&apos;ll search for this name across selected platforms.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`${formId}-active`}>Active</Label>
                  <p className="text-sm text-muted-foreground">Enable or disable this monitor</p>
                </div>
                <Switch id={`${formId}-active`} checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Platforms — grouped by category */}
          <Card>
            <CardHeader>
              <CardTitle>Platforms</CardTitle>
              <CardDescription>
                {isTeamUser
                  ? "All 17 platforms available. Different platforms need different inputs."
                  : isPaidUser
                    ? "9 Pro platforms available. Upgrade to Team for all 17."
                    : "Upgrade to Pro for 9 platforms or Team for all 17."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Discussion & Social */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-teal-500" />
                  <Label className="text-sm font-semibold">Discussion & Social Platforms</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Search by keywords — your company name and keywords find relevant posts and discussions.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ALL_PLATFORMS.filter(p => p.category === "keyword").map(renderPlatformCard)}
                </div>
              </div>

              {/* Product & App */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-amber-500" />
                  <Label className="text-sm font-semibold">Product & App Platforms</Label>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-500 border-amber-500/30">URL required</Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Monitor a specific product page. Paste your product&apos;s URL below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ALL_PLATFORMS.filter(p => p.category === "url_required").map(renderPlatformCard)}
                </div>

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
              </div>

              {/* Review & Listing */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-semibold">Review & Listing Platforms</Label>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-500 border-blue-500/30">URL optional</Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  We search by company name automatically. Adding your listing URL improves accuracy.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ALL_PLATFORMS.filter(p => p.category === "business_listing").map(renderPlatformCard)}
                </div>

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

          {/* Section 3: Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Search Keywords</CardTitle>
              <CardDescription>
                Your company name is always searched. Add extra terms to catch more mentions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`${formId}-keywords`}>
                    Additional Keywords <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <span className={`text-xs font-medium ${
                    isAtKeywordLimit ? "text-amber-500" : keywordsRemaining <= 2 ? "text-amber-500/80" : "text-muted-foreground"
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
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Schedule */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <Label htmlFor={`${formId}-schedule`}>Schedule Active Hours</Label>
                      <p className="text-sm text-muted-foreground">Only scan during specific hours</p>
                    </div>
                  </div>
                  <Switch id={`${formId}-schedule`} checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                </div>

                {scheduleEnabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Select value={String(scheduleStartHour)} onValueChange={(v) => setScheduleStartHour(parseInt(v))}>
                          <SelectTrigger aria-label="Start time" className="min-h-[44px]"><SelectValue /></SelectTrigger>
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
                        <Select value={String(scheduleEndHour)} onValueChange={(v) => setScheduleEndHour(parseInt(v))}>
                          <SelectTrigger aria-label="End time" className="min-h-[44px]"><SelectValue /></SelectTrigger>
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
                            onClick={() => setScheduleDays((prev) => prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort())}
                            className={`px-3 py-2 min-h-[44px] min-w-[44px] text-sm rounded-md border transition-colors ${
                              scheduleDays.includes(i) ? "bg-teal-500 text-black border-teal-500" : "bg-background hover:bg-muted"
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select value={scheduleTimezone} onValueChange={setScheduleTimezone}>
                        <SelectTrigger aria-label="Timezone" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMMON_TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
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

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 sm:gap-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="min-h-[44px]"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Monitor
            </Button>
            <div className="flex gap-3">
              <Link href={`/dashboard/monitors/${monitorId}`}>
                <Button type="button" variant="outline" className="min-h-[44px]">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSaving} className="bg-teal-500 text-black hover:bg-teal-600 min-h-[44px]">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
