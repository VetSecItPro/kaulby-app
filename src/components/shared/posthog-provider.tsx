"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { Component, useEffect, useState, type ReactNode } from "react";
import { hasAnalyticsConsent } from "./cookie-consent";

// Error boundary for PostHog - silently fails without breaking app
class PostHogErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[PostHog] Error boundary caught:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.children;
    }
    return this.props.children;
  }
}

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

    // Delay PostHog initialization to not block main thread
    // Use requestIdleCallback for non-critical analytics
    const initAnalytics = () => {
      if (hasAnalyticsConsent() && !posthogInitialized) {
        initPostHog();
      }
    };

    // Initialize after page is idle, or after 2 seconds max
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback(initAnalytics, { timeout: 2000 });
    } else {
      setTimeout(initAnalytics, 1000);
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

  return (
    <PostHogErrorBoundary>
      <PHProvider client={posthog}>{children}</PHProvider>
    </PostHogErrorBoundary>
  );
}

// Identify user with PostHog when signed in (only if consented)
// TODO: Re-enable with proper Clerk integration after Clerk is stable
export function PostHogIdentify() {
  // Disabled for now - will re-enable when Clerk integration is stable
  return null;
}
