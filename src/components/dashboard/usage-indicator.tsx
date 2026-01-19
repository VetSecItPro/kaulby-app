"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp } from "lucide-react";
import { PLANS, PlanKey } from "@/lib/plans";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UsageBarProps {
  label: string;
  current: number;
  limit: number;
  unit?: string;
}

export function UsageBar({ label, current, limit, unit = "" }: UsageBarProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isWarning = percentage >= 80;
  const isOver = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          "font-medium",
          isOver && "text-red-500",
          isWarning && !isOver && "text-amber-500"
        )}>
          {current}{unit} / {isUnlimited ? "Unlimited" : `${limit}${unit}`}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={cn(
            "h-2",
            isOver && "[&>div]:bg-red-500",
            isWarning && !isOver && "[&>div]:bg-amber-500"
          )}
        />
      )}
    </div>
  );
}

interface UsageCardProps {
  plan: PlanKey;
  monitors: { current: number; limit: number };
  resultsThisPeriod: { current: number; limit: number };
  showUpgrade?: boolean;
}

export function UsageCard({ plan, monitors, resultsThisPeriod, showUpgrade = true }: UsageCardProps) {
  const planData = PLANS[plan];
  const isAtLimit = monitors.current >= monitors.limit && monitors.limit !== -1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Usage</CardTitle>
          <Badge variant={plan === "free" ? "secondary" : "default"}>
            {planData.name} Plan
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <UsageBar
          label="Monitors"
          current={monitors.current}
          limit={monitors.limit}
        />
        <UsageBar
          label="Results this period"
          current={resultsThisPeriod.current}
          limit={resultsThisPeriod.limit}
        />

        {showUpgrade && plan !== "enterprise" && (
          <div className={cn(
            "pt-3 border-t",
            isAtLimit && "animate-pulse"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isAtLimit ? "You've reached your limit" : "Need more?"}
                </span>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/pricing">
                  Upgrade
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UsageSidebarProps {
  plan: PlanKey;
  monitors: { current: number; limit: number };
}

export function UsageSidebar({ plan, monitors }: UsageSidebarProps) {
  const planData = PLANS[plan];
  const percentage = monitors.limit === -1 ? 0 : Math.round((monitors.current / monitors.limit) * 100);
  const isWarning = percentage >= 80;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Plan</span>
        <Badge variant="secondary" className="text-xs">
          {planData.name}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Monitors</span>
          <span className={cn(
            "font-medium",
            isWarning && "text-amber-500"
          )}>
            {monitors.current}/{monitors.limit === -1 ? "∞" : monitors.limit}
          </span>
        </div>
        {monitors.limit !== -1 && (
          <Progress
            value={percentage}
            className={cn(
              "h-1.5",
              isWarning && "[&>div]:bg-amber-500"
            )}
          />
        )}
      </div>

      {plan !== "enterprise" && (
        <Button size="sm" variant="outline" className="w-full text-xs" asChild>
          <Link href="/pricing">
            Upgrade to {plan === "free" ? "Pro" : "Team"}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      )}
    </div>
  );
}
