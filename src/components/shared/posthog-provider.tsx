"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// PostHog project API keys start with 'phc_'
// If you have a different prefix, you have the wrong key type
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

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only run on client and only once
    if (typeof window === "undefined" || posthogInitialized) {
      setIsReady(true);
      return;
    }

    if (!isPostHogConfigured()) {
      setIsReady(true);
      return;
    }

    try {
      posthog.init(POSTHOG_KEY!, {
        api_host: POSTHOG_HOST || "https://us.posthog.com",
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage",
        autocapture: false,
        disable_session_recording: true,
        advanced_disable_feature_flags: true, // Disable feature flags to prevent 401
        advanced_disable_feature_flags_on_first_load: true,
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

    setIsReady(true);
  }, []);

  // Always render children - PostHog is optional analytics
  if (!isReady) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Identify user with PostHog when signed in
export function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isPostHogConfigured() || !posthogInitialized) return;

    if (isLoaded && user) {
      try {
        posthog.identify(user.id, {
          email: user.emailAddresses[0]?.emailAddress,
          name: user.fullName,
          createdAt: user.createdAt,
        });
      } catch (error) {
        console.warn("[PostHog] Failed to identify user:", error);
      }
    }
  }, [user, isLoaded]);

  return null;
}
