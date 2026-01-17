"use client";

import { useState, useEffect } from "react";
import { OnboardingWizard } from "./onboarding";

interface OnboardingTriggerProps {
  showOnboarding: boolean;
  userName?: string;
  userPlan: "free" | "pro" | "enterprise";
}

export function OnboardingTrigger({ showOnboarding, userName, userPlan }: OnboardingTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show the onboarding wizard if the user hasn't completed it
    if (showOnboarding) {
      // Small delay to let the page render first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showOnboarding]);

  const handleClose = async () => {
    setIsOpen(false);
    // Mark as completed even if they skip (so it doesn't show again)
    try {
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
    } catch {
      // Silently fail - they can always restart from getting started guide
    }
  };

  return (
    <OnboardingWizard
      isOpen={isOpen}
      onClose={handleClose}
      userName={userName}
      userPlan={userPlan}
    />
  );
}
