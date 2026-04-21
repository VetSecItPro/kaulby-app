"use client";

// Tier 2 Task 2.3: typed CLIENT-side event taxonomy.
// Complements server-side `analytics.ts` (Task 1.4) — same discipline, same
// contract: extending = add a key to ClientAnalyticsEvents and call track() at
// the call site. The typed map prevents event-name drift across UI instrumentation.
//
// Init is already owned by `components/shared/cookie-consent.tsx` — this
// wrapper reuses the globally loaded PostHog instance (or no-ops if the user
// declined cookies, keys are absent, or we're in dev/test). Never breaks the
// UI; analytics failures must be invisible.

export type ClientAnalyticsEvents = {
  "ui.monitor_card_clicked": {
    fromPage: string;
    monitorId: string;
  };
  "ui.result_card_clicked": {
    resultId: string;
    platform: string;
  };
  "ui.filter_applied": {
    filterType: "sentiment" | "platform" | "category" | "time_range" | "sort";
    value: string;
  };
  "ui.tab_switched": {
    pageSection: string;
    tabName: string;
  };
  "ui.cta_clicked": {
    ctaName: string;
    location: string;
  };
  "ui.insights_range_changed": {
    range: string;
  };
};

// Lazy posthog-js import. Mirrors tracking.ts pattern: dynamic import avoids
// pulling the 30KB PostHog bundle into any client entrypoint that doesn't
// actually fire events. Consent is checked inside — declined users get a no-op.
let _posthog: typeof import("posthog-js").default | null = null;

async function getPostHog() {
  if (typeof window === "undefined") return null;
  // Dev/test: silent no-op so local work doesn't pollute analytics.
  if (process.env.NODE_ENV !== "production") return null;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || !key.startsWith("phc_")) return null;

  if (_posthog) return _posthog;
  try {
    const { hasAnalyticsConsent } = await import("@/components/shared/cookie-consent");
    if (!hasAnalyticsConsent()) return null;
    const mod = await import("posthog-js");
    _posthog = mod.default;
    return _posthog;
  } catch {
    return null;
  }
}

/**
 * Typed wrapper around posthog.capture for CLIENT-side UI events.
 * Use this instead of calling posthog.capture directly so event names + prop
 * shapes are type-checked against ClientAnalyticsEvents.
 *
 * Safe to call from any client component — returns a promise that resolves
 * to void. Errors and missing-posthog are swallowed. Never throws.
 */
export async function track<K extends keyof ClientAnalyticsEvents>(
  event: K,
  props: ClientAnalyticsEvents[K]
): Promise<void> {
  try {
    const posthog = await getPostHog();
    if (!posthog || !posthog.__loaded) return;
    posthog.capture(event, props as Record<string, unknown>);
  } catch {
    // Silently fail — analytics must never break the UI.
  }
}
