"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Radio,
  Search,
  Bell,
  BarChart3,
  Users,
  Webhook,
  Sparkles,
  ArrowRight,
  PlusCircle,
} from "lucide-react";

// Animated illustration wrapper
function IllustrationWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn("relative", className)}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

// Abstract illustration components
function MonitorIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        {/* Background circles */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-4 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30"
        />
        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Radio className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Floating elements */}
        <motion.div
          animate={{ y: [-4, 4, -4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary/40 flex items-center justify-center"
        >
          <Sparkles className="w-3 h-3 text-primary" aria-hidden="true" />
        </motion.div>
      </div>
    </IllustrationWrapper>
  );
}

function ResultsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-primary/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Search className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Animated search rings */}
        <motion.div
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-full border-2 border-primary/30"
        />
      </div>
    </IllustrationWrapper>
  );
}

function AlertsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 to-primary/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ rotate: [-5, 5, -5] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Bell className="w-12 h-12 text-primary" aria-hidden="true" />
          </motion.div>
        </div>
      </div>
    </IllustrationWrapper>
  );
}

function AnalyticsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/20 to-primary/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <BarChart3 className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Animated bars */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
          {[0.3, 0.6, 0.4, 0.8, 0.5].map((height, i) => (
            <motion.div
              key={i}
              animate={{ scaleY: [height, 1, height] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              className="w-1 h-4 bg-primary/40 rounded-full origin-bottom"
            />
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
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-primary/20"
        />
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
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/20 to-primary/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Webhook className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Connection dots */}
        <motion.div
          animate={{ x: [0, 20, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute top-1/2 right-0 w-2 h-2 rounded-full bg-primary"
        />
      </div>
    </IllustrationWrapper>
  );
}

function InsightsIllustration() {
  return (
    <IllustrationWrapper className="w-32 h-32 mx-auto mb-6">
      <div className="relative w-full h-full">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-amber-500/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-12 h-12 text-primary" aria-hidden="true" />
        </div>
        {/* Floating sparkles */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              y: [-10, -20, -10],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.5,
            }}
            className="absolute"
            style={{
              top: "20%",
              left: `${30 + i * 20}%`,
            }}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
          </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex flex-col items-center justify-center text-center",
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
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center text-center py-12"
    >
      <div className="relative w-24 h-24 mb-6">
        {/* Radar animation */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-1/2 bg-gradient-to-b from-primary to-transparent origin-bottom" />
        </motion.div>

        {/* Concentric circles */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.2], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
            className="absolute inset-0 rounded-full border border-primary/30"
            style={{ margin: `${i * 8}px` }}
          />
        ))}

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-primary"
          />
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Scanning for mentions...</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        {monitorName
          ? `"${monitorName}" is actively scanning. Results will appear here soon.`
          : "Your monitors are actively scanning. New mentions will appear here."}
      </p>
    </motion.div>
  );
}
