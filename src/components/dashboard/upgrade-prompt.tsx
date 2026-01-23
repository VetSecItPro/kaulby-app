"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Lock, ArrowRight, Check, Sparkles, Clock, Eye, Users } from "lucide-react";
import { PLANS, PlanKey } from "@/lib/plans";
import type { UpgradePrompt } from "@/lib/limits";
import Link from "next/link";

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  currentPlan?: PlanKey;
  suggestedPlan: PlanKey;
  feature?: string;
}

export function UpgradePromptDialog({
  isOpen,
  onClose,
  title,
  description,
  suggestedPlan,
}: UpgradePromptProps) {
  const plan = PLANS[suggestedPlan];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">{plan.name} Plan</span>
              <Badge variant="secondary">${plan.price}/mo</Badge>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {plan.features.slice(0, 5).map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
            <Link href="/pricing">
              Upgrade to {plan.name}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CONVERSION-FOCUSED UPGRADE MODAL
// ============================================================================

interface ConversionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: UpgradePrompt;
  socialProof?: {
    proUsersCount: number;
    mentionsTrackedThisWeek: number;
    message: string;
  };
}

export function ConversionUpgradeModal({
  isOpen,
  onClose,
  prompt,
  socialProof,
}: ConversionUpgradeModalProps) {
  const plan = PLANS[prompt.suggestedPlan];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/25">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <DialogTitle className="text-center text-xl">{prompt.title}</DialogTitle>
          <DialogDescription className="text-center text-base">
            {prompt.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Benefit highlight */}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-purple-600/10 border border-primary/20 p-4">
            <p className="text-sm font-medium text-foreground">{prompt.benefit}</p>
          </div>

          {/* Urgency message */}
          {prompt.urgency && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{prompt.urgency}</p>
            </div>
          )}

          {/* Plan features */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">{plan.name}</span>
              <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white">
                ${plan.price}/mo
              </Badge>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {plan.features.slice(0, 6).map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Social proof */}
          {socialProof && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{socialProof.message}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            asChild
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25"
          >
            <Link href="/pricing">
              {prompt.ctaText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UpgradeCardProps {
  title: string;
  description: string;
  suggestedPlan: PlanKey;
  compact?: boolean;
}

export function UpgradeCard({ title, description, suggestedPlan, compact = false }: UpgradeCardProps) {
  const plan = PLANS[suggestedPlan];

  if (compact) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/25">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pricing">Upgrade</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-2 border-muted-foreground/25">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium mb-2">Upgrade to {plan.name} for:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {plan.features.slice(0, 4).map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild className="w-full">
            <Link href="/pricing">
              Upgrade to {plan.name} - ${plan.price}/mo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface FeatureLockProps {
  feature: string;
  requiredPlan: PlanKey;
  children?: React.ReactNode;
}

export function FeatureLock({ feature, requiredPlan, children }: FeatureLockProps) {
  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-4">
          <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium text-sm">{feature}</p>
          <p className="text-xs text-muted-foreground mb-3">
            Available on {PLANS[requiredPlan].name} plan
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pricing">
              Upgrade
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface FeatureBadgeProps {
  requiredPlan: PlanKey;
}

export function FeatureBadge({ requiredPlan }: FeatureBadgeProps) {
  return (
    <Badge variant="outline" className="ml-2 text-xs font-normal">
      <Lock className="h-3 w-3 mr-1" />
      {PLANS[requiredPlan].name}
    </Badge>
  );
}

// ============================================================================
// BLURRED AI ANALYSIS TEASER
// ============================================================================

interface BlurredAiAnalysisProps {
  aiSummary?: string;
  sentiment?: string;
  painPointCategory?: string;
}

export function BlurredAiAnalysis({ aiSummary, sentiment, painPointCategory }: BlurredAiAnalysisProps) {
  // Generate fake/placeholder content if none provided
  const displaySummary = aiSummary || "This mention discusses a common pain point about product onboarding. The author is asking for solutions to improve their workflow...";

  return (
    <div className="relative group">
      {/* Blurred content */}
      <div className="blur-sm select-none pointer-events-none">
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {sentiment || "positive"}
            </Badge>
            {painPointCategory && (
              <Badge variant="outline" className="text-xs">
                {painPointCategory.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {displaySummary}
          </p>
        </div>
      </div>

      {/* Overlay with unlock CTA */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background/90 via-background/50 to-transparent rounded-lg">
        <div className="text-center px-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 mb-2 shadow-lg shadow-primary/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm font-medium mb-1">AI Analysis Ready</p>
          <p className="text-xs text-muted-foreground mb-3">
            Unlock insights on every result
          </p>
          <Button size="sm" asChild className="bg-gradient-to-r from-primary to-purple-600">
            <Link href="/pricing">
              Unlock AI
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HIDDEN RESULTS BANNER
// ============================================================================

interface HiddenResultsBannerProps {
  hiddenCount: number;
  totalCount: number;
}

export function HiddenResultsBanner({ hiddenCount, totalCount }: HiddenResultsBannerProps) {
  if (hiddenCount <= 0) return null;

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-purple-600/5">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-md shadow-primary/20">
            <Eye className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              +{hiddenCount} more results waiting
            </p>
            <p className="text-xs text-muted-foreground">
              You&apos;re seeing 3 of {totalCount} mentions. Upgrade to see all.
            </p>
          </div>
        </div>
        <Button size="sm" asChild className="bg-gradient-to-r from-primary to-purple-600 shadow-md shadow-primary/20">
          <Link href="/pricing">
            See All Results
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// REFRESH DELAY BANNER - Full-width gold banner with live countdown timer
// ============================================================================

interface RefreshDelayBannerProps {
  delayHours: number;
  nextRefreshAt?: Date | null;
  subscriptionStatus?: string; // "free" | "pro" | "enterprise"
}

export function RefreshDelayBanner({ delayHours, nextRefreshAt, subscriptionStatus = "free" }: RefreshDelayBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Calculate and format time remaining with seconds for live countdown
  const calculateTimeRemaining = () => {
    if (!nextRefreshAt) return `${delayHours}h 00m 00s`;
    const now = new Date();
    const diff = nextRefreshAt.getTime() - now.getTime();
    if (diff <= 0) return "refreshing...";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    // Always show full format for clear countdown
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    return `${seconds}s`;
  };

  // Update timer every second
  useEffect(() => {
    setTimeRemaining(calculateTimeRemaining());
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextRefreshAt, delayHours]);

  // Team (enterprise) is on the highest tier - no upgrade available
  const isHighestTier = subscriptionStatus === "enterprise";

  return (
    <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-md bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-600/40">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
        <p className="text-sm text-foreground">
          Results refresh in{" "}
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {timeRemaining}
          </span>
        </p>
      </div>
      {!isHighestTier && (
        <Button size="sm" asChild className="h-6 px-2 text-xs bg-yellow-600 text-black hover:bg-yellow-500">
          <Link href="/pricing">
            Upgrade
          </Link>
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// INLINE UPGRADE CTA (for use within cards/lists)
// ============================================================================

interface InlineUpgradeCtaProps {
  message: string;
  ctaText?: string;
}

export function InlineUpgradeCta({ message, ctaText = "Upgrade" }: InlineUpgradeCtaProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/10">
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xs text-muted-foreground flex-1">{message}</span>
      <Button size="sm" variant="ghost" asChild className="h-6 px-2 text-xs text-primary hover:text-primary">
        <Link href="/pricing">
          {ctaText}
          <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}
