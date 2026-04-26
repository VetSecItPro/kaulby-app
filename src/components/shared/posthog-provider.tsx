"use client";

import { useEffect, type ReactNode } from "react";

// Task 2.3: PostHog client-side provider.
//
// Why a provider at all if cookie-consent.tsx already inits PostHog? Two reasons:
// 1. Explicit composition - the layout shows *where* analytics is wired.
// 2. SPA route-change pageview tracking - cookie-consent only fires init; we
//    rely on PostHog's built-in capture_pageview, but this provider gives us a
//    single hook point if we need to add custom pageview logic later.
//
// Init is INTENTIONALLY skipped in non-production environments and when the
// publishable key is missing, so local dev + CI never ship noise to PostHog.

async function ensurePostHog() {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || !key.startsWith("phc_")) return;

  try {
    // If the user granted consent earlier, init runs via cookie-consent on mount.
    // This guard re-checks in case consent was granted in another tab.
    const { hasAnalyticsConsent } = await import("@/components/shared/cookie-consent");
    if (!hasAnalyticsConsent()) return;

    const posthog = (await import("posthog-js")).default;
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
        persistence: "localStorage",
        autocapture: false,
        advanced_disable_feature_flags: true,
        advanced_disable_decide: true,
      });
    }
  } catch {
    // Silent - analytics never blocks the UI.
  }
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensurePostHog();
  }, []);

  return <>{children}</>;
}
