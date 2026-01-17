"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { OnboardingWizard } from "./onboarding";

interface OnboardingContextType {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  dismissOnboarding: () => void;
  resetOnboarding: () => void;
  hasCompletedOnboarding: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const ONBOARDING_STORAGE_KEY = "kaulby_onboarding_completed";

interface OnboardingProviderProps {
  children: ReactNode;
  isNewUser: boolean;
  userName?: string;
}

// Safe localStorage helper to handle errors gracefully
function safeLocalStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        // localStorage may be unavailable (private browsing, storage quota, etc.)
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Silently fail - not critical for app functionality
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Silently fail
      }
    },
  };
}

export function OnboardingProvider({ children, isNewUser, userName }: OnboardingProviderProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    setMounted(true);
    const storage = safeLocalStorage();
    const completed = storage.getItem(ONBOARDING_STORAGE_KEY);
    const hasCompleted = completed === "true";
    setHasCompletedOnboarding(hasCompleted);

    // Show onboarding for new users who haven't completed it
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (isNewUser && !hasCompleted) {
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
    safeLocalStorage().setItem(ONBOARDING_STORAGE_KEY, "true");
    setHasCompletedOnboarding(true);
  };

  const resetOnboarding = () => {
    safeLocalStorage().removeItem(ONBOARDING_STORAGE_KEY);
    setHasCompletedOnboarding(false);
    setShowOnboarding(true);
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
        resetOnboarding,
      }}
    >
      {children}
      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={dismissOnboarding}
        userName={userName}
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
