"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useTransition } from "react";
import { OnboardingWizard } from "./onboarding";
import { completeOnboarding, resetOnboarding as resetOnboardingAction } from "@/app/(dashboard)/dashboard/actions";

interface OnboardingContextType {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  dismissOnboarding: () => void;
  resetOnboarding: () => void;
  hasCompletedOnboarding: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: ReactNode;
  isNewUser: boolean;
  userName?: string;
  userPlan?: "free" | "pro" | "enterprise";
}

export function OnboardingProvider({ children, isNewUser, userName, userPlan = "free" }: OnboardingProviderProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  // isNewUser from server is the source of truth (derived from database onboardingCompleted)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(!isNewUser);
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  // Show onboarding for new users on mount
  useEffect(() => {
    setMounted(true);

    // Show onboarding for new users who haven't completed it
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (isNewUser) {
      // Small delay to let the page render first
      timeoutId = setTimeout(() => {
        setShowOnboarding(true);
      }, 500);
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isNewUser]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    // Persist to database
    startTransition(async () => {
      await completeOnboarding();
    });
  };

  const handleResetOnboarding = () => {
    setHasCompletedOnboarding(false);
    setShowOnboarding(true);
    // Persist to database
    startTransition(async () => {
      await resetOnboardingAction();
    });
  };

  // Don't render onboarding until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <OnboardingContext.Provider
      value={{
        showOnboarding,
        setShowOnboarding,
        dismissOnboarding,
        hasCompletedOnboarding,
        resetOnboarding: handleResetOnboarding,
      }}
    >
      {children}
      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={dismissOnboarding}
        userName={userName}
        userPlan={userPlan}
      />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
