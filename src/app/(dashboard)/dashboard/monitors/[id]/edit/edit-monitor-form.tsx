"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, X, Loader2, Trash2, Lock, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { PlanLimits } from "@/lib/plans";

// All available platforms (12 total)
const ALL_PLATFORMS = [
  { id: "reddit", name: "Reddit", description: "Track subreddits and discussions", tier: "free" },
  { id: "hackernews", name: "Hacker News", description: "Tech and startup discussions", tier: "pro" },
  { id: "producthunt", name: "Product Hunt", description: "Product launches and reviews", tier: "pro" },
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews on Google", tier: "pro" },
  { id: "trustpilot", name: "Trustpilot", description: "Customer reviews and ratings", tier: "pro" },
  { id: "appstore", name: "App Store", description: "iOS app reviews", tier: "pro" },
  { id: "playstore", name: "Play Store", description: "Android app reviews", tier: "pro" },
  { id: "quora", name: "Quora", description: "Q&A discussions", tier: "pro" },
  // New platforms
  { id: "youtube", name: "YouTube", description: "Video comments and discussions", tier: "pro" },
  { id: "g2", name: "G2", description: "Software reviews and ratings", tier: "pro" },
  { id: "yelp", name: "Yelp", description: "Local business reviews", tier: "pro" },
  { id: "amazonreviews", name: "Amazon Reviews", description: "Product reviews on Amazon", tier: "pro" },
];

interface EditMonitorFormProps {
  monitorId: string;
  limits: PlanLimits;
  userPlan: string;
}

export function EditMonitorForm({ monitorId, limits, userPlan }: EditMonitorFormProps) {
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

  const isPaidUser = userPlan !== "free";
  const keywordLimit = limits.keywordsPerMonitor;
  const keywordsRemaining = keywordLimit - keywords.length;
  const isAtKeywordLimit = keywords.length >= keywordLimit;

  // Get upgrade plan name
  const getUpgradePlanName = () => {
    if (userPlan === "free") return "Pro";
    if (userPlan === "pro") return "Team";
    return null;
  };

  const upgradePlanName = getUpgradePlanName();

  useEffect(() => {
    async function loadMonitor() {
      try {
        const response = await fetch(`/api/monitors/${monitorId}`);
        if (!response.ok) throw new Error("Failed to load monitor");
        const data = await response.json();
        setName(data.monitor.name);
        setCompanyName(data.monitor.companyName || "");
        setKeywords(data.monitor.keywords || []);
        setSelectedPlatforms(data.monitor.platforms);
        setIsActive(data.monitor.isActive);
      } catch {
        setError("Failed to load monitor");
      } finally {
        setIsLoading(false);
      }
    }
    loadMonitor();
  }, [monitorId]);

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

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable this monitor
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {/* Keywords (Optional) with Counter */}
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
                {isPaidUser ? "All 12 platforms available" : "Upgrade to Pro to unlock all platforms"}
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
                        onCheckedChange={() => togglePlatform(platform.id)}
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
