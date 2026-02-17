"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

const CONSENT_KEY = "kaulby:analytics-consent";

type ConsentState = "granted" | "denied" | null;

function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === "granted" || val === "denied") return val;
  return null;
}

/**
 * Check whether analytics consent has been granted.
 * Exported so tracking.ts can gate PostHog initialization.
 */
export function hasAnalyticsConsent(): boolean {
  return getStoredConsent() === "granted";
}

/**
 * Initialize PostHog client-side after consent is granted.
 */
async function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !key.startsWith("phc_")) return;

  try {
    const posthog = (await import("posthog-js")).default;
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: host || "https://us.i.posthog.com",
        ui_host: "https://us.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
        persistence: "localStorage",
        autocapture: false,
      });
    }
  } catch {
    // Silently fail — analytics should never break the app
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    if (consent === null) {
      // No decision yet — show banner
      setVisible(true);
    } else if (consent === "granted") {
      // Already accepted — initialize PostHog
      initPostHog();
    }
    // "denied" — do nothing
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    setVisible(false);
    initPostHog();
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 pointer-events-none">
      <div className="mx-auto max-w-lg pointer-events-auto rounded-xl border border-border/60 bg-background/95 backdrop-blur-md shadow-lg p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Analytics for a better experience</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Kaulby uses anonymous site analytics to understand which features
              are used and where things break. We don&apos;t track your browsing
              habits, sell data, or build ad profiles. This data stays internal
              and helps us improve the product for you.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDecline}
            className="text-xs"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="text-xs"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
