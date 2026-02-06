"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, X, Loader2, Trash2, Lock, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import type { PlanLimits } from "@/lib/plans";
import { COMMON_TIMEZONES, WEEKDAYS } from "@/lib/monitor-schedule";

// All 17 platforms with tier-based access
// Pro tier (9 platforms): reddit, hackernews, indiehackers, producthunt, googlereviews, youtube, github, trustpilot, x
// Team tier (17 platforms): + devto, hashnode, appstore, playstore, quora, g2, yelp, amazonreviews
const ALL_PLATFORMS = [
  // Pro tier platforms (9)
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions", tier: "free" },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions", tier: "pro" },
  { id: "indiehackers", name: "Indie Hackers", description: "Indie makers and solo founders", tier: "pro" },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews", tier: "pro" },
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews on Google", tier: "pro" },
  { id: "youtube", name: "YouTube", description: "Video comments and discussions", tier: "pro" },
  { id: "github", name: "GitHub", description: "Issues and discussions", tier: "pro" },
  { id: "trustpilot", name: "Trustpilot", description: "Customer reviews and ratings", tier: "pro" },
  { id: "x", name: "X (Twitter)", description: "Posts and conversations on X", tier: "pro" },
  // Team tier only platforms (8 more)
  { id: "devto", name: "Dev.to", description: "Developer blog posts and discussions", tier: "team" },
  { id: "hashnode", name: "Hashnode", description: "Tech blog network", tier: "team" },
  { id: "appstore", name: "App Store", description: "iOS app reviews", tier: "team" },
  { id: "playstore", name: "Play Store", description: "Android app reviews", tier: "team" },
  { id: "quora", name: "Quora", description: "Q&A discussions", tier: "team" },
  { id: "g2", name: "G2", description: "Software reviews and ratings", tier: "team" },
  { id: "yelp", name: "Yelp", description: "Local business reviews", tier: "team" },
  { id: "amazonreviews", name: "Amazon Reviews", description: "Product reviews on Amazon", tier: "team" },
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
  const [isActive, setIsActive] = useState(true);
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

  // Get upgrade plan name
  const getUpgradePlanName = () => {
    if (userPlan === "free") return "Pro";
    if (userPlan === "pro") return "Team";
    return null;
  };

  const upgradePlanName = getUpgradePlanName();

  useEffect(() => {
    const abortController = new AbortController();

    async function loadMonitor() {
      try {
        const response = await fetch(`/api/monitors/${monitorId}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          if (response.status === 404) {
            // Monitor was deleted - redirect to monitors list
            router.push("/dashboard/monitors");
            return;
          }
          throw new Error("Failed to load monitor");
        }
        const data = await response.json();
        setName(data.monitor.name);
        setCompanyName(data.monitor.companyName || "");
        setKeywords(data.monitor.keywords || []);
        setSelectedPlatforms(data.monitor.platforms);
        setIsActive(data.monitor.isActive);
        // Load schedule settings
        setScheduleEnabled(data.monitor.scheduleEnabled ?? false);
        setScheduleStartHour(data.monitor.scheduleStartHour ?? 9);
        setScheduleEndHour(data.monitor.scheduleEndHour ?? 17);
        setScheduleDays(data.monitor.scheduleDays ?? WEEKDAYS);
        setScheduleTimezone(data.monitor.scheduleTimezone ?? "America/New_York");
      } catch (err) {
        // Ignore abort errors (happens during navigation)
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load monitor");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
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

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const togglePlatform = (platformId: string) => {
    const platform = ALL_PLATFORMS.find(p => p.id === platformId);
    const isLocked = platform?.tier !== "free" && !isPaidUser;
    if (isLocked) return;

    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
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

    setIsSaving(true);

    try {
      const response = await fetch(`/api/monitors/${monitorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim(),
          keywords, // Now optional
          platforms: selectedPlatforms,
          isActive,
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
    if (!confirm("Are you sure you want to delete this monitor? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/monitors/${monitorId}`, {
        method: "DELETE",
      });

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/monitors/${monitorId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Monitor</h1>
          <p className="text-muted-foreground">
            Update your monitor settings.
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
              <Label htmlFor={`${formId}-name`}>Monitor Name</Label>
              <Input
                id={`${formId}-name`}
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
              <Label htmlFor={`${formId}-companyName`}>Company/Brand Name</Label>
              <Input
                id={`${formId}-companyName`}
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

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor={`${formId}-active`}>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable this monitor
                </p>
              </div>
              <Switch
                id={`${formId}-active`}
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

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

            {/* Keywords (Optional) with Counter */}
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

              <p className="text-xs text-muted-foreground">
                Add additional keywords to find mentions like &quot;{companyName || "your company"} customer service&quot;.
              </p>
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
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <Label>Platforms</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {isTeamUser
                  ? "All 17 platforms available"
                  : isPaidUser
                    ? "9 Pro platforms available • Upgrade to Team for all 17"
                    : "Upgrade to Pro for 9 platforms or Team for all 17"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_PLATFORMS.map((platform) => {
                  const isLocked = isPlatformLocked(platform.tier);
                  const isSelected = selectedPlatforms.includes(platform.id);
                  return (
                    <label
                      key={platform.id}
                      htmlFor={`${formId}-platform-${platform.id}`}
                      className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                        isLocked
                          ? "opacity-60 cursor-not-allowed bg-muted/30"
                          : "cursor-pointer hover:bg-muted/50"
                      } ${isSelected ? "border-primary bg-primary/5" : ""}`}
                    >
                      <Checkbox
                        id={`${formId}-platform-${platform.id}`}
                        checked={isSelected}
                        disabled={isLocked}
                        onCheckedChange={() => togglePlatform(platform.id)}
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

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Monitor
              </Button>
              <div className="flex gap-4">
                <Link href={`/dashboard/monitors/${monitorId}`}>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSaving} className="bg-teal-500 text-black hover:bg-teal-600">
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
