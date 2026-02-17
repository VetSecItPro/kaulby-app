"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { hasAnalyticsConsent } from "@/components/shared/cookie-consent";

/**
 * PostHog identity sync — identifies the current Clerk user in PostHog
 * so feature flags, analytics, and cohorts are tied to the right person.
 *
 * Place this inside the Clerk provider in the app layout.
 */
export function PostHogIdentify() {
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (!hasAnalyticsConsent()) return;

    async function identify() {
      try {
        const posthog = (await import("posthog-js")).default;
        if (posthog.__loaded) {
          posthog.identify(userId!);
        }
      } catch {
        // Silently fail
      }
    }

    identify();
  }, [userId]);

  return null;
}
