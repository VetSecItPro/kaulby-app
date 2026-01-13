"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import posthog from "posthog-js";

// Check if PostHog is properly configured
const isPostHogConfigured = (): boolean => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  return !!key && key.startsWith("phc_");
};

function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Don't capture if PostHog isn't configured or initialized
    if (!isPostHogConfigured()) return;

    // Check if posthog is actually loaded and ready
    if (!posthog.__loaded) return;

    if (pathname) {
      try {
        let url = window.origin + pathname;
        if (searchParams?.toString()) {
          url = url + `?${searchParams.toString()}`;
        }
        posthog.capture("$pageview", {
          $current_url: url,
        });
      } catch {
        // Silently fail - analytics should never break the app
      }
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogPageView() {
  // Don't render at all if not configured
  if (!isPostHogConfigured()) return null;

  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}
