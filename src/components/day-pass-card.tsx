"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Timer, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayPassCardProps {
  dayPassExpiresAt: string | null;
  onPurchase?: () => void;
  isPurchasing?: boolean;
  className?: string;
  variant?: "full" | "compact";
}

export function DayPassCard({
  dayPassExpiresAt,
  onPurchase,
  isPurchasing = false,
  className,
  variant = "full",
}: DayPassCardProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!dayPassExpiresAt) {
      setIsActive(false);
      setTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(dayPassExpiresAt);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setIsActive(false);
        setTimeRemaining(null);
        return;
      }

      setIsActive(true);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining({ hours, minutes, seconds });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [dayPassExpiresAt]);

  // Compact variant for dashboard header or sidebar
  if (variant === "compact" && isActive && timeRemaining) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full", className)}>
        <Timer className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">
          Day Pass: {String(timeRemaining.hours).padStart(2, "0")}:
          {String(timeRemaining.minutes).padStart(2, "0")}:
          {String(timeRemaining.seconds).padStart(2, "0")}
        </span>
      </div>
    );
  }

  // Active day pass - show countdown
  if (isActive && timeRemaining) {
    return (
      <Card className={cn("border-primary bg-primary/5", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Day Pass Active
            </CardTitle>
            <Badge variant="default" className="gap-1">
              <Zap className="h-3 w-3" />
              Pro Access
            </Badge>
          </div>
          <CardDescription>
            Full Pro features unlocked for the next {timeRemaining.hours}h {timeRemaining.minutes}m
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums">
                {String(timeRemaining.hours).padStart(2, "0")}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Hours</div>
            </div>
            <div className="text-3xl font-bold text-muted-foreground">:</div>
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums">
                {String(timeRemaining.minutes).padStart(2, "0")}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Minutes</div>
            </div>
            <div className="text-3xl font-bold text-muted-foreground">:</div>
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums">
                {String(timeRemaining.seconds).padStart(2, "0")}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Seconds</div>
            </div>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Enjoying Pro? Consider upgrading for continuous access.
          </p>
        </CardContent>
      </Card>
    );
  }

  // No active day pass - show purchase option
  return (
    <Card className={cn("bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            24-Hour Day Pass
          </CardTitle>
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
            One-time $10
          </Badge>
        </div>
        <CardDescription>
          Need Pro features just for today? Get instant 24-hour access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            Full Pro features for 24 hours
          </li>
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            All 16 platforms unlocked
          </li>
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            Unlimited results & AI analysis
          </li>
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            No subscription required
          </li>
        </ul>
        <Button
          onClick={onPurchase}
          disabled={isPurchasing}
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          {isPurchasing ? "Processing..." : "Get Day Pass - $10"}
        </Button>
      </CardContent>
    </Card>
  );
}
