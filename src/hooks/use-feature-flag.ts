"use client";

import { useState, useEffect } from "react";
import { hasAnalyticsConsent } from "@/components/shared/cookie-consent";

/**
 * Hook to read a PostHog feature flag value.
 *
 * Returns `undefined` while loading, then the flag value (boolean or string).
 * If PostHog is not loaded or consent was denied, returns the fallback.
 *
 * Usage:
 *   const showNewDashboard = useFeatureFlag("new-dashboard", false);
 */
export function useFeatureFlag<T extends boolean | string = boolean>(
  flag: string,
  fallback: T
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !hasAnalyticsConsent()) {
      setValue(fallback);
      return;
    }

    async function check() {
      try {
        const posthog = (await import("posthog-js")).default;
        if (!posthog.__loaded) {
          setValue(fallback);
          return;
        }

        // Check if flags are already loaded
        const current = posthog.getFeatureFlag(flag);
        if (current !== undefined) {
          setValue(current as T);
          return;
        }

        // Wait for flags to load
        posthog.onFeatureFlags(() => {
          const val = posthog.getFeatureFlag(flag);
          setValue((val ?? fallback) as T);
        });
      } catch {
        setValue(fallback);
      }
    }

    check();
  }, [flag, fallback]);

  return value;
}
