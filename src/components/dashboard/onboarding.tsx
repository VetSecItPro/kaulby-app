"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell,
  Activity,
  ArrowRight,
  ArrowLeft,
  Check,
  Rocket,
  Target,
  Zap,
  Search,
  Briefcase,
  Code,
  ShoppingCart,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userPlan?: "free" | "pro" | "enterprise";
}

// Pre-built monitor templates for quick setup
const MONITOR_TEMPLATES = [
  {
    id: "brand",
    icon: Briefcase,
    title: "Brand Monitoring",
    description: "Track mentions of your brand or company name",
    placeholder: "Your brand name",
    suggestedKeywords: ["reviews", "alternatives", "vs"],
  },
  {
    id: "competitor",
    icon: Target,
    title: "Competitor Tracking",
    description: "Monitor what people say about competitors",
    placeholder: "Competitor name",
    suggestedKeywords: ["problems with", "switching from", "hate"],
  },
  {
    id: "tech",
    icon: Code,
    title: "Tech/Framework",
    description: "Follow discussions about technologies you use",
    placeholder: "e.g., React, Python, AWS",
    suggestedKeywords: ["help with", "how to", "best practices"],
  },
  {
    id: "product",
    icon: ShoppingCart,
    title: "Product Category",
    description: "Track interest in your product category",
    placeholder: "e.g., project management, CRM",
    suggestedKeywords: ["looking for", "recommend", "best"],
  },
  {
    id: "custom",
    icon: Sparkles,
    title: "Custom Keywords",
    description: "Start from scratch with your own keywords",
    placeholder: "Enter any keyword",
    suggestedKeywords: [],
  },
];

// All available platforms
const ALL_PLATFORMS = [
  { id: "reddit", name: "Reddit", description: "Discussions across communities" },
  { id: "hackernews", name: "Hacker News", description: "Tech & startup news" },
  { id: "producthunt", name: "Product Hunt", description: "Product launches" },
  { id: "googlereviews", name: "Google Reviews", description: "Business reviews" },
  { id: "trustpilot", name: "Trustpilot", description: "Company reviews" },
  { id: "appstore", name: "App Store", description: "iOS app reviews" },
  { id: "playstore", name: "Play Store", description: "Android app reviews" },
  { id: "quora", name: "Quora", description: "Q&A discussions" },
  { id: "devto", name: "Dev.to", description: "Developer community" },
];

// Free tier only gets Reddit
const FREE_PLATFORMS = ALL_PLATFORMS.filter(p => p.id === "reddit");

const STEPS = [
  { id: 1, title: "Welcome" },
  { id: 2, title: "What to Track" },
  { id: 3, title: "Keywords" },
  { id: 4, title: "Platforms" },
];

export function OnboardingWizard({ isOpen, onClose, userName, userPlan = "free" }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [monitorName, setMonitorName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["reddit"]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Get available platforms based on user's plan
  const availablePlatforms = userPlan === "free" ? FREE_PLATFORMS : ALL_PLATFORMS;
  const progress = (step / STEPS.length) * 100;

  const addKeyword = (keyword?: string) => {
    const k = (keyword || keywordInput).trim();
    if (k && !keywords.includes(k)) {
      setKeywords([...keywords, k]);
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

  const selectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    // Don't pre-fill monitor name - use placeholder instead so user can type freely
    setStep(3);
  };

  const handleNext = () => {
    if (step < STEPS.length) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleCreateMonitor = async () => {
    setError("");

    if (keywords.length === 0) {
      setError("Please add at least one keyword");
      return;
    }

    if (selectedPlatforms.length === 0) {
      setError("Please select at least one platform");
      return;
    }

    setIsCreating(true);

    try {
      // Create the monitor
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: monitorName || "My First Monitor",
          keywords,
          platforms: selectedPlatforms,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create monitor");
      }

      // Mark onboarding as complete
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      onClose();
      router.push("/dashboard/monitors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsCreating(false);
    }
  };

  const template = MONITOR_TEMPLATES.find((t) => t.id === selectedTemplate);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <Progress value={progress} className="h-1 absolute top-0 left-0 right-0 rounded-t-lg" />

        {/* Step 1: Welcome */}
        {step === 1 && (
          <>
            <DialogHeader className="pt-4">
              {/* Kaulby Logo */}
              <div className="mx-auto mb-4">
                <img
                  src="/icon-512.png"
                  alt="Kaulby"
                  className="h-16 w-16 rounded-xl"
                />
              </div>
              <DialogTitle className="text-center text-xl">
                {userName ? `Welcome, ${userName}!` : "Welcome to Kaulby"}
              </DialogTitle>
              <DialogDescription className="text-center">
                Let&apos;s set up your first monitor in under 60 seconds.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <p className="text-center text-muted-foreground">
                Kaulby monitors Reddit, Hacker News, and Product Hunt for conversations that matter to your business.
              </p>
              <div className="grid gap-3">
                <FeatureItem
                  icon={Search}
                  title="Find conversations"
                  description="Track keywords across multiple platforms automatically"
                />
                <FeatureItem
                  icon={Activity}
                  title="AI-powered insights"
                  description="Understand sentiment and pain points instantly"
                />
                <FeatureItem
                  icon={Bell}
                  title="Never miss a mention"
                  description="Get notified when someone talks about you"
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={handleSkip}>
                Skip for now
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: What to Track */}
        {step === 2 && (
          <>
            <DialogHeader className="pt-4">
              {/* Kaulby Logo */}
              <div className="mx-auto mb-4">
                <img
                  src="/icon-512.png"
                  alt="Kaulby"
                  className="h-16 w-16 rounded-xl"
                />
              </div>
              <DialogTitle className="text-center text-xl">
                What do you want to track?
              </DialogTitle>
              <DialogDescription className="text-center">
                Choose a template to get started quickly
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 grid gap-2">
              {MONITOR_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => selectTemplate(tmpl.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:bg-muted/50",
                    selectedTemplate === tmpl.id && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <tmpl.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{tmpl.title}</p>
                    <p className="text-xs text-muted-foreground">{tmpl.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Keywords */}
        {step === 3 && (
          <>
            <DialogHeader className="pt-4">
              {/* Kaulby Logo */}
              <div className="mx-auto mb-4">
                <img
                  src="/icon-512.png"
                  alt="Kaulby"
                  className="h-16 w-16 rounded-xl"
                />
              </div>
              <DialogTitle className="text-center text-xl">
                Add your keywords
              </DialogTitle>
              <DialogDescription className="text-center">
                Enter your brand and any related terms
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Monitor Name */}
              <div className="space-y-2">
                <Label htmlFor="monitor-name">Monitor Name</Label>
                <Input
                  id="monitor-name"
                  placeholder={template?.id !== "custom" ? `${template?.title} Monitor` : "e.g., Brand Mentions"}
                  value={monitorName}
                  onChange={(e) => setMonitorName(e.target.value)}
                />
              </div>

              {/* Keyword Input */}
              <div className="space-y-2">
                <Label htmlFor="keyword-input">Keywords</Label>
                <div className="flex gap-2">
                  <Input
                    id="keyword-input"
                    placeholder={template?.placeholder || "Enter a keyword"}
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <Button type="button" variant="outline" onClick={() => addKeyword()}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Keywords List */}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="gap-1 py-1">
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

              {/* Suggested Keywords */}
              {template && template.suggestedKeywords.length > 0 && keywords.length < 3 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Suggested additions</Label>
                  <div className="flex flex-wrap gap-2">
                    {template.suggestedKeywords
                      .filter((k) => !keywords.includes(k))
                      .map((suggestion) => (
                        <Badge
                          key={suggestion}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10"
                          onClick={() => addKeyword(suggestion)}
                        >
                          + {suggestion}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Free plan: up to 3 keywords per monitor
              </p>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                className="gap-2"
                disabled={keywords.length === 0}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Platforms & Create */}
        {step === 4 && (
          <>
            <DialogHeader className="pt-4">
              {/* Kaulby Logo */}
              <div className="mx-auto mb-4">
                <img
                  src="/icon-512.png"
                  alt="Kaulby"
                  className="h-16 w-16 rounded-xl"
                />
              </div>
              <DialogTitle className="text-center text-xl">
                Choose platforms to monitor
              </DialogTitle>
              <DialogDescription className="text-center">
                Select where you want to track mentions
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {userPlan === "free" ? (
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Free plan monitors <strong>Reddit</strong> only.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upgrade to Pro for all 9 platforms including Hacker News, Product Hunt, and more.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 max-h-[200px] overflow-y-auto">
                  {availablePlatforms.map((platform) => (
                    <label
                      key={platform.id}
                      htmlFor={`onboarding-platform-${platform.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:bg-muted/50",
                        selectedPlatforms.includes(platform.id) && "border-primary bg-primary/5"
                      )}
                    >
                      <Checkbox
                        id={`onboarding-platform-${platform.id}`}
                        checked={selectedPlatforms.includes(platform.id)}
                        onCheckedChange={(checked) => {
                          if (typeof checked === "boolean") {
                            setSelectedPlatforms((prev) =>
                              checked
                                ? [...prev, platform.id]
                                : prev.filter((p) => p !== platform.id)
                            );
                          }
                        }}
                      />
                      <div>
                        <p className="font-medium text-sm">{platform.name}</p>
                        <p className="text-xs text-muted-foreground">{platform.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium mb-2">Your monitor:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p><strong>Name:</strong> {monitorName || "My First Monitor"}</p>
                  <p><strong>Keywords:</strong> {keywords.join(", ")}</p>
                  <p><strong>Platforms:</strong> {selectedPlatforms.map(p =>
                    ALL_PLATFORMS.find(pl => pl.id === p)?.name
                  ).join(", ")}</p>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleCreateMonitor}
                className="gap-2"
                disabled={isCreating || selectedPlatforms.length === 0}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Monitor
                    <Rocket className="h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step indicators */}
        <div className="flex justify-center gap-2 pb-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id <= step && setStep(s.id)}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                step === s.id ? "bg-primary w-4" : s.id < step ? "bg-primary/50" : "bg-muted"
              )}
              disabled={s.id > step}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Welcome banner for returning users with no monitors
interface WelcomeBannerProps {
  onDismiss: () => void;
}

export function WelcomeBanner({ onDismiss }: WelcomeBannerProps) {
  const router = useRouter();

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Get started with Kaulby</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first monitor to start tracking mentions across Reddit, Hacker News, and more.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={() => router.push("/dashboard/monitors/new")} className="gap-2">
                  <Target className="h-4 w-4" />
                  Create Monitor
                </Button>
                <Button variant="ghost" onClick={onDismiss}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick start guide component - dynamic based on user data
interface QuickStartGuideProps {
  hasMonitors: boolean;
  hasResults: boolean;
  hasAlerts?: boolean;
  onDismiss?: () => void;
}

export function QuickStartGuide({ hasMonitors, hasResults, hasAlerts = false, onDismiss }: QuickStartGuideProps) {
  const router = useRouter();

  const steps = [
    {
      completed: hasMonitors,
      title: "Create your first monitor",
      description: "Set up keywords to track mentions",
      action: () => router.push("/dashboard/monitors/new"),
      actionLabel: hasMonitors ? "View" : "Create",
      actionHref: hasMonitors ? "/dashboard/monitors" : "/dashboard/monitors/new",
    },
    {
      completed: hasResults,
      title: "Review your results",
      description: "See what people are saying",
      action: () => router.push("/dashboard/results"),
      actionLabel: "View",
      actionHref: "/dashboard/results",
    },
    {
      completed: hasAlerts,
      title: "Set up notifications",
      description: "Get alerted to new mentions",
      action: () => router.push("/dashboard/settings"),
      actionLabel: "Configure",
      actionHref: "/dashboard/settings",
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const allCompleted = completedCount === steps.length;
  const progressPercent = (completedCount / steps.length) * 100;

  // Don't show if all steps are completed
  if (allCompleted && onDismiss) {
    return null;
  }

  return (
    <Card className={cn(
      "border-2 transition-all",
      allCompleted ? "border-green-500/20" : "border-primary/20"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Getting Started
          </CardTitle>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {allCompleted ? "All done!" : `${completedCount} of ${steps.length} completed`}
            </span>
            <span className="font-medium text-primary">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3 transition-all",
                step.completed ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30" : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                    step.completed
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {step.completed ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div>
                  <p className={cn(
                    "font-medium text-sm",
                    step.completed && "text-green-700 dark:text-green-400"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant={step.completed ? "ghost" : "default"}
                onClick={step.action}
                className="shrink-0 w-[110px] justify-center rounded-full"
              >
                {step.actionLabel}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ))}
        </div>

        {/* Upgrade prompt for completed free users */}
        {hasMonitors && hasResults && (
          <div className="mt-4 rounded-lg bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/10 p-3">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Ready to level up?</p>
                <p className="text-xs text-muted-foreground">Upgrade to Pro for unlimited results and AI insights</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/settings")}>
                Upgrade
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact checklist for sidebar or smaller spaces
interface CompactChecklistProps {
  hasMonitors: boolean;
  hasResults: boolean;
}

export function CompactChecklist({ hasMonitors, hasResults }: CompactChecklistProps) {
  const router = useRouter();

  if (hasMonitors && hasResults) return null;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Getting Started</p>
      <div className="space-y-1">
        <ChecklistItem
          completed={hasMonitors}
          label="Create a monitor"
          onClick={() => router.push("/dashboard/monitors/new")}
        />
        <ChecklistItem
          completed={hasResults}
          label="View your results"
          onClick={() => router.push("/dashboard/results")}
        />
      </div>
    </div>
  );
}

function ChecklistItem({
  completed,
  label,
  onClick,
}: {
  completed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full text-left text-sm rounded px-2 py-1 transition-colors",
        completed ? "text-green-600 dark:text-green-400" : "hover:bg-muted"
      )}
    >
      <div className={cn(
        "h-4 w-4 rounded-full flex items-center justify-center",
        completed ? "bg-green-100 dark:bg-green-900/30" : "border border-muted-foreground/30"
      )}>
        {completed && <Check className="h-2.5 w-2.5" />}
      </div>
      <span className={completed ? "line-through" : ""}>{label}</span>
    </button>
  );
}
