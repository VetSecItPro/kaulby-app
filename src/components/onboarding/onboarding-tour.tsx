"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { CallBackProps, Step } from "react-joyride";
import { useRouter } from "next/navigation";

// Dynamically import Joyride to avoid SSR issues
const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

const TOUR_STORAGE_KEY = "kaulby_onboarding_completed";

// Tour steps configuration
const tourSteps: Step[] = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "Welcome to Kaulby!",
    content: "Let's take a quick tour to help you get started with monitoring your brand across the web.",
  },
  {
    target: '[data-tour="monitors"]',
    placement: "auto",
    title: "Your Monitors",
    content: "Monitors track keywords across platforms like Reddit, Hacker News, and more. Create your first monitor to start tracking mentions.",
  },
  {
    target: '[data-tour="create-monitor"]',
    placement: "auto",
    title: "Create a Monitor",
    content: "Click here to create your first monitor. Add keywords, select platforms, and start tracking in minutes.",
  },
  {
    target: '[data-tour="results"]',
    placement: "auto",
    title: "View Results",
    content: "All your mentions appear here. See sentiment analysis, pain points, and AI summaries for each result.",
  },
  {
    target: '[data-tour="analytics"]',
    placement: "auto",
    title: "Analytics Dashboard",
    content: "Track trends over time, see sentiment breakdowns, and identify which platforms drive the most mentions.",
  },
  {
    target: '[data-tour="insights"]',
    placement: "auto",
    title: "AI Insights",
    content: "Get AI-powered insights about your brand perception, common pain points, and actionable recommendations.",
  },
  {
    target: '[data-tour="settings"]',
    placement: "auto",
    title: "Settings & Alerts",
    content: "Configure email alerts, manage your subscription, and customize your experience.",
  },
];

// Custom styles for the tour
const tourStyles = {
  options: {
    primaryColor: "hsl(172, 66%, 50%)", // teal-500 (primary)
    zIndex: 10000,
    arrowColor: "hsl(0, 0%, 12%)",
    backgroundColor: "hsl(0, 0%, 12%)",
    textColor: "hsl(0, 0%, 98%)",
    overlayColor: "rgba(0, 0, 0, 0.7)",
  },
  tooltip: {
    borderRadius: "12px",
    padding: "20px",
  },
  tooltipTitle: {
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "8px",
  },
  tooltipContent: {
    fontSize: "14px",
    lineHeight: "1.6",
  },
  buttonNext: {
    backgroundColor: "hsl(172, 66%, 50%)",
    color: "#000",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: 500,
  },
  buttonBack: {
    color: "hsl(0, 0%, 65%)",
    marginRight: "8px",
  },
  buttonSkip: {
    color: "hsl(0, 0%, 65%)",
  },
  spotlight: {
    borderRadius: "8px",
  },
};

interface OnboardingTourProps {
  isNewUser?: boolean;
  forceStart?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ isNewUser = false, forceStart = false, onComplete }: OnboardingTourProps) {
  const router = useRouter();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeSteps, setActiveSteps] = useState<Step[]>(tourSteps);

  // Filter steps to only include those with visible targets
  const computeActiveSteps = useCallback(() => {
    const visible = tourSteps.filter((step) => {
      if (step.target === "body") return true;
      const selector = step.target as string;
      const elements = document.querySelectorAll(selector);
      // Check if at least one matching element is visible
      for (const el of elements) {
        if (el instanceof HTMLElement && el.offsetParent !== null) {
          return true;
        }
      }
      return false;
    });
    setActiveSteps(visible);
  }, []);

  // Check if tour should run
  useEffect(() => {
    setMounted(true);

    if (forceStart) {
      // Delay to let DOM render, then compute visible steps
      const timer = setTimeout(() => {
        computeActiveSteps();
        setRun(true);
      }, 200);
      return () => clearTimeout(timer);
    }

    // Check localStorage for completion
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed && isNewUser) {
      // Small delay to let the page render
      const timer = setTimeout(() => {
        computeActiveSteps();
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isNewUser, forceStart, computeActiveSteps]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    // Handle tour completion
    if (status === "finished" || status === "skipped") {
      setRun(false);
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      onComplete?.();
      return;
    }

    // Handle step changes
    if (type === "step:after") {
      if (action === "next") {
        setStepIndex(index + 1);
      } else if (action === "prev") {
        setStepIndex(index - 1);
      }
    }

    // Navigate to specific pages for certain steps
    if (type === "step:before") {
      const stepTarget = activeSteps[index]?.target;

      // If we're on the monitors step and not on monitors page, navigate
      if (stepTarget === '[data-tour="create-monitor"]') {
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/monitors")) {
          router.push("/dashboard/monitors");
        }
      }
    }
  }, [router, onComplete, activeSteps]);

  if (!mounted) return null;

  return (
    <Joyride
      steps={activeSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      spotlightClicks
      disableOverlayClose
      callback={handleCallback}
      styles={tourStyles}
      locale={{
        back: "Back",
        close: "Close",
        last: "Get Started!",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
}

// Hook to manually trigger the tour
export function useOnboardingTour() {
  const [shouldRun, setShouldRun] = useState(false);

  const startTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setShouldRun(true);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  }, []);

  const isTourCompleted = useCallback(() => {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  }, []);

  return { shouldRun, startTour, resetTour, isTourCompleted };
}
