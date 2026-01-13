"use client";

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
import { Zap, Lock, ArrowRight, Check } from "lucide-react";
import { PLANS, PlanKey } from "@/lib/stripe";
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
    <Dialog open={isOpen} onOpenChange={onClose}>
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
