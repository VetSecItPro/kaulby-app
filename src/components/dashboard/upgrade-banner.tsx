"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Clock, Eye, Bell, X } from "lucide-react";
import { useState, useEffect } from "react";
import { tracking } from "@/lib/tracking";

interface UpgradeBannerProps {
  plan: string;
  variant?: "full" | "compact" | "inline";
  context?: "dashboard" | "results" | "monitors";
}

export function UpgradeBanner({ plan, variant = "full", context = "dashboard" }: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  // Track impression when banner is shown
  useEffect(() => {
    if (plan === "free" && !dismissed && !hasTrackedImpression) {
      tracking.upgradePromptShown(context, plan);
      setHasTrackedImpression(true);
    }
  }, [plan, dismissed, context, hasTrackedImpression]);

  // Only show for free users
  if (plan !== "free" || dismissed) {
    return null;
  }

  const handleUpgradeClick = () => {
    tracking.upgradeClicked(context, "pro", `banner-${variant}`);
  };

  const painPoints = [
    {
      icon: Clock,
      title: "24-hour delay",
      description: "Your results are delayed by 24 hours",
      cta: "Get 4-hour refresh with Pro",
    },
    {
      icon: Eye,
      title: "Limited visibility",
      description: "Only see your last 3 results",
      cta: "See unlimited results",
    },
    {
      icon: Bell,
      title: "No alerts",
      description: "Missing important mentions?",
      cta: "Get instant alerts",
    },
  ];

  // Rotate pain points based on context
  const painPoint = context === "results"
    ? painPoints[1]
    : context === "monitors"
      ? painPoints[2]
      : painPoints[0];

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <painPoint.icon className="h-4 w-4 text-amber-500" />
        <span>{painPoint.description}</span>
        <Link href="/dashboard/settings" className="text-primary hover:underline ml-1" onClick={handleUpgradeClick}>
          Upgrade
        </Link>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Upgrade to Pro</p>
              <p className="text-xs text-muted-foreground">
                Get 4-hour refresh, all 16 platforms, and full AI analysis
              </p>
            </div>
          </div>
          <Link href="/dashboard/settings" onClick={handleUpgradeClick}>
            <Button size="sm" className="shrink-0">
              Upgrade
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Full variant
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 relative overflow-hidden">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Unlock the full power of Kaulby</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {painPoints.map((point) => (
                <div key={point.title} className="flex items-start gap-2">
                  <point.icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{point.title}</p>
                    <p className="text-xs text-muted-foreground">{point.cta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link href="/dashboard/settings" onClick={handleUpgradeClick}>
              <Button className="w-full">
                Start 14-Day Free Trial
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center">
              No credit card required
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Specific upgrade prompts for different contexts
export function ResultsLimitBanner({
  visibleCount,
  totalCount,
  plan
}: {
  visibleCount: number;
  totalCount: number;
  plan: string;
}) {
  if (plan !== "free" || totalCount <= visibleCount) {
    return null;
  }

  const hiddenCount = totalCount - visibleCount;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-500/10">
            <Eye className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {hiddenCount} more {hiddenCount === 1 ? "mention" : "mentions"} hidden
            </p>
            <p className="text-xs text-muted-foreground">
              Upgrade to Pro to see all your results
            </p>
          </div>
        </div>
        <Link href="/dashboard/settings">
          <Button size="sm" variant="outline" className="shrink-0">
            View All
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function DelayedResultsBanner({ plan }: { plan: string }) {
  if (plan !== "free") {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-md px-2 py-1">
      <Clock className="h-3 w-3" />
      <span>Results delayed 24 hours</span>
      <Link href="/dashboard/settings" className="underline ml-1">
        Upgrade
      </Link>
    </div>
  );
}
