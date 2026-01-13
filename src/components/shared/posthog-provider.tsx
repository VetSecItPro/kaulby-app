"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { hasAnalyticsConsent } from "./cookie-consent";

// PostHog project API keys start with 'phc_'
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Validate PostHog configuration
const isPostHogConfigured = (): boolean => {
  if (!POSTHOG_KEY) return false;

  // PostHog Project API keys must start with 'phc_'
  if (!POSTHOG_KEY.startsWith("phc_")) {
    if (typeof window !== "undefined") {
      console.warn(
        "[PostHog] Invalid API key format. Project API keys start with 'phc_'. " +
          "You may have copied the wrong key. Go to PostHog → Settings → Project API Key."
      );
    }
    return false;
  }

  return true;
};

let posthogInitialized = false;

function initPostHog() {
  if (posthogInitialized || typeof window === "undefined") return;
  if (!isPostHogConfigured()) return;
  if (!hasAnalyticsConsent()) return;

  try {
    posthog.init(POSTHOG_KEY!, {
      api_host: POSTHOG_HOST || "https://us.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      persistence: "localStorage",
      autocapture: false,
      disable_session_recording: true,
      advanced_disable_feature_flags: true,
      advanced_disable_feature_flags_on_first_load: true,
      // Respect Do Not Track
      respect_dnt: true,
      // Only store essential data
      property_denylist: ["$ip"],
      loaded: (ph) => {
        posthogInitialized = true;
        if (process.env.NODE_ENV === "development") {
          ph.debug();
        }
      },
    });
  } catch (error) {
    console.warn("[PostHog] Failed to initialize:", error);
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") {
      setIsReady(true);
      return;
    }

    // Check for consent and initialize if allowed
    if (hasAnalyticsConsent() && !posthogInitialized) {
      initPostHog();
    }

    // Listen for consent changes
    const handleConsentChange = () => {
      if (hasAnalyticsConsent() && !posthogInitialized) {
        initPostHog();
      } else if (!hasAnalyticsConsent() && posthogInitialized) {
        // User revoked consent - opt out
        try {
          posthog.opt_out_capturing();
          posthog.reset();
        } catch {
          // Ignore errors
        }
      }
    };

    window.addEventListener("cookieConsentChange", handleConsentChange);
    setIsReady(true);

    return () => {
      window.removeEventListener("cookieConsentChange", handleConsentChange);
    };
  }, []);

  // Always render children - PostHog is optional analytics
  if (!isReady) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Identify user with PostHog when signed in (only if consented)
export function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isPostHogConfigured() || !posthogInitialized) return;
    if (!hasAnalyticsConsent()) return;

    if (isLoaded && user) {
      try {
        // Only identify with minimal data
        posthog.identify(user.id, {
          // Don't send email or PII unless necessary
          createdAt: user.createdAt,
        });
      } catch (error) {
        console.warn("[PostHog] Failed to identify user:", error);
      }
    }
  }, [user, isLoaded]);

  return null;
}
