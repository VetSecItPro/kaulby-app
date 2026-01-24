"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Radio,
  Bell,
  BarChart3,
  Sparkles,
  X,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const CHECKLIST_STORAGE_KEY = "kaulby_onboarding_checklist";
const CHECKLIST_DISMISSED_KEY = "kaulby_onboarding_dismissed";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  checkFn?: () => Promise<boolean>;
}

const checklistItems: ChecklistItem[] = [
  {
    id: "create_monitor",
    title: "Create your first monitor",
    description: "Set up keywords and platforms to track",
    href: "/dashboard/monitors/new",
    icon: Radio,
  },
  {
    id: "view_results",
    title: "Check your results",
    description: "See mentions and AI analysis",
    href: "/dashboard/results",
    icon: Sparkles,
  },
  {
    id: "setup_alerts",
    title: "Configure alerts",
    description: "Get notified of new mentions",
    href: "/dashboard/settings",
    icon: Bell,
  },
  {
    id: "view_analytics",
    title: "Explore analytics",
    description: "Track trends and sentiment over time",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
];

interface OnboardingChecklistProps {
  hasMonitors?: boolean;
  hasResults?: boolean;
  hasAlerts?: boolean;
}

export function OnboardingChecklist({
  hasMonitors = false,
  hasResults = false,
  hasAlerts = false,
}: OnboardingChecklistProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    setMounted(true);

    const dismissed = localStorage.getItem(CHECKLIST_DISMISSED_KEY);
    if (dismissed === "true") {
      setIsDismissed(true);
      return;
    }

    const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompletedItems(new Set(parsed));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Update completion based on props
  useEffect(() => {
    if (!mounted) return;

    setCompletedItems((prev) => {
      const newCompleted = new Set(prev);

      if (hasMonitors) newCompleted.add("create_monitor");
      if (hasResults) newCompleted.add("view_results");
      if (hasAlerts) newCompleted.add("setup_alerts");

      // Save to localStorage
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(Array.from(newCompleted)));
      return newCompleted;
    });
  }, [hasMonitors, hasResults, hasAlerts, mounted]);

  // Mark item as manually completed (for view-only items)
  const markCompleted = (itemId: string) => {
    const newCompleted = new Set(completedItems);
    newCompleted.add(itemId);
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(Array.from(newCompleted)));
    setCompletedItems(newCompleted);
  };

  const handleDismiss = () => {
    localStorage.setItem(CHECKLIST_DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  // Calculate progress
  const completedCount = completedItems.size;
  const totalCount = checklistItems.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Don't show if dismissed or all completed
  if (!mounted || isDismissed || completedCount === totalCount) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 z-50 w-80 bg-card border rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-teal-500/10">
            <Rocket className="h-4 w-4 text-teal-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Getting Started</h3>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {totalCount} completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Checklist items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-2 pt-0 space-y-1">
              {checklistItems.map((item) => {
                const isCompleted = completedItems.has(item.id);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      // Mark analytics/results as viewed when clicked
                      if (item.id === "view_analytics" || item.id === "view_results") {
                        markCompleted(item.id);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      isCompleted
                        ? "bg-teal-500/5 hover:bg-teal-500/10"
                        : "hover:bg-accent"
                    )}
                  >
                    <div
                      className={cn(
                        "p-1.5 rounded-full",
                        isCompleted ? "bg-teal-500/10" : "bg-muted"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-teal-500" />
                      ) : (
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isCompleted && "text-muted-foreground line-through"
                        )}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                    {!isCompleted && (
                      <Circle className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Hook to reset the checklist (useful for testing)
export function useOnboardingChecklist() {
  const resetChecklist = () => {
    localStorage.removeItem(CHECKLIST_STORAGE_KEY);
    localStorage.removeItem(CHECKLIST_DISMISSED_KEY);
    window.location.reload();
  };

  const showChecklist = () => {
    localStorage.removeItem(CHECKLIST_DISMISSED_KEY);
    window.location.reload();
  };

  return { resetChecklist, showChecklist };
}
