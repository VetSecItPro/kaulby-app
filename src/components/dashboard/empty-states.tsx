"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Radio,
  Search,
  Bell,
  BarChart3,
  Users,
  Webhook,
  Wand2,
  ArrowRight,
  PlusCircle,
} from "lucide-react";

// Animated illustration wrapper
function IllustrationWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("relative animate-[fadeScaleIn_0.5s_ease-out_both]", className)}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
      <div className="relative">{children}</div>
    </div>
  );
}

// Abstract illustration components
function MonitorIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        {/* Background circles */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 animate-[pulse_6s_ease-in-out_infinite_reverse]" />
        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Radio className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Floating element */}
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary/40 flex items-center justify-center animate-[float_4s_ease-in-out_infinite]">
          <Wand2 className="w-3 h-3 text-primary" aria-hidden="true" />
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function ResultsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-primary/20 animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Search className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Animated search ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-[pingOnce_2s_ease-out_infinite]" />
      </div>
    </IllustrationWrapper>
  );
}

function AlertsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 to-primary/20 animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-[bellRing_3s_ease-in-out_infinite]">
            <Bell className="w-12 h-12 text-primary" aria-hidden="true" />
          </div>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function AnalyticsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/20 to-primary/20 animate-[pulse_3500ms_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <BarChart3 className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Animated bars */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
          {[
            "animate-[barPulse_1.5s_ease-in-out_infinite_0ms]",
            "animate-[barPulse_1.5s_ease-in-out_infinite_100ms]",
            "animate-[barPulse_1.5s_ease-in-out_infinite_200ms]",
            "animate-[barPulse_1.5s_ease-in-out_infinite_300ms]",
            "animate-[barPulse_1.5s_ease-in-out_infinite_400ms]",
          ].map((cls, i) => (
            <div key={i} className={cn("w-1 h-4 bg-primary/40 rounded-full origin-bottom", cls)} />
          ))}
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function AudienceIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-primary/20 animate-[pulse_3s_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Users className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function WebhookIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/20 to-primary/20 animate-[pulse_3s_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Webhook className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Connection dot */}
        <div className="absolute top-1/2 right-0 w-2 h-2 rounded-full bg-primary animate-[connectionDot_2s_ease-in-out_infinite]" />
      </div>
    </IllustrationWrapper>
  );
}

function InsightsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-amber-500/20 animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Wand2 className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Floating sparkles */}
        {[
          { delay: "0ms", left: "30%" },
          { delay: "500ms", left: "50%" },
          { delay: "1000ms", left: "70%" },
        ].map((s, i) => (
          <div
            key={i}
            className="absolute animate-[sparkleFloat_2s_ease-in-out_infinite]"
            style={{ top: "20%", left: s.left, animationDelay: s.delay }}
          >
            <Wand2 className="w-3 h-3 text-amber-400" />
          </div>
        ))}
      </div>
    </IllustrationWrapper>
  );
}

// Empty state component types
type EmptyStateType =
  | "monitors"
  | "results"
  | "alerts"
  | "analytics"
  | "audiences"
  | "webhooks"
  | "insights";

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

const EMPTY_STATE_CONFIG: Record<
  EmptyStateType,
  {
    illustration: () => JSX.Element;
    defaultTitle: string;
    defaultDescription: string;
    defaultActionLabel: string;
    defaultActionHref: string;
  }
> = {
  monitors: {
    illustration: MonitorIllustration,
    defaultTitle: "Ready to start listening?",
    defaultDescription: "Create your first monitor and we'll start tracking mentions of your brand across the web.",
    defaultActionLabel: "Create Monitor",
    defaultActionHref: "/dashboard/monitors/new",
  },
  results: {
    illustration: ResultsIllustration,
    defaultTitle: "Your mentions are on the way!",
    defaultDescription: "Your monitors are actively scanning. Results will appear here as we find matching mentions.",
    defaultActionLabel: "View Monitors",
    defaultActionHref: "/dashboard/monitors",
  },
  alerts: {
    illustration: AlertsIllustration,
    defaultTitle: "Stay in the loop",
    defaultDescription: "Set up alerts to get notified when we find new mentions via email, Slack, or Discord.",
    defaultActionLabel: "Configure Alerts",
    defaultActionHref: "/dashboard/settings",
  },
  analytics: {
    illustration: AnalyticsIllustration,
    defaultTitle: "Insights are brewing",
    defaultDescription: "Analytics will light up once we've collected enough mentions to show meaningful trends.",
    defaultActionLabel: "Create Monitor",
    defaultActionHref: "/dashboard/monitors/new",
  },
  audiences: {
    illustration: AudienceIllustration,
    defaultTitle: "Group your communities",
    defaultDescription: "Create audiences to organize communities and focus your monitoring where it matters most.",
    defaultActionLabel: "Create Audience",
    defaultActionHref: "/dashboard/audiences/new",
  },
  webhooks: {
    illustration: WebhookIllustration,
    defaultTitle: "Connect your tools",
    defaultDescription: "Set up webhooks to receive real-time notifications in your own systems.",
    defaultActionLabel: "Add Webhook",
    defaultActionHref: "/dashboard/webhooks",
  },
  insights: {
    illustration: InsightsIllustration,
    defaultTitle: "AI insights are warming up",
    defaultDescription: "We'll surface AI-powered insights as soon as we've analyzed enough mentions.",
    defaultActionLabel: "View Results",
    defaultActionHref: "/dashboard/results",
  },
};

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[type];
  const Illustration = config.illustration;

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-[fadeSlideUp_0.5s_ease-out_both]",
        compact ? "py-8" : "py-12",
        className
      )}
    >
      {!compact && <Illustration />}

      <h3 className={cn("font-semibold", compact ? "text-base mb-1" : "text-xl mb-2")}>
        {title || config.defaultTitle}
      </h3>

      <p className={cn(
        "text-muted-foreground max-w-sm",
        compact ? "text-sm mb-4" : "text-base mb-6"
      )}>
        {description || config.defaultDescription}
      </p>

      {(actionHref || onAction) && (
        onAction ? (
          <Button onClick={onAction} size={compact ? "sm" : "default"} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {actionLabel || config.defaultActionLabel}
          </Button>
        ) : (
          <Link href={actionHref || config.defaultActionHref}>
            <Button size={compact ? "sm" : "default"} className="gap-2">
              {actionLabel || config.defaultActionLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )
      )}
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card className="border-dashed border-2 border-muted-foreground/20">
      <CardContent className="p-0">
        {content}
      </CardContent>
    </Card>
  );
}

// Scanning state - shown when monitors are active but no results yet
export function ScanningState({ monitorName }: { monitorName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 animate-[fadeIn_0.3s_ease-out_both]">
      <div className="relative w-24 h-24 mb-6">
        {/* Radar sweep line */}
        <div className="absolute inset-0 animate-spin [animation-duration:3s]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-1/2 bg-gradient-to-b from-primary to-transparent origin-bottom" />
        </div>

        {/* Concentric circles */}
        {[
          { margin: "8px", delay: "0s" },
          { margin: "16px", delay: "0.5s" },
          { margin: "24px", delay: "1s" },
        ].map((ring, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-primary/30 animate-[radarRing_2s_ease-out_infinite]"
            style={{ margin: ring.margin, animationDelay: ring.delay }}
          />
        ))}

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Scanning for mentions...</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        {monitorName
          ? `"${monitorName}" is actively scanning. Results will appear here soon.`
          : "Your monitors are actively scanning. New mentions will appear here."}
      </p>
    </div>
  );
}
