import * as Sentry from "@sentry/nextjs";

// Gate session replay behind same cookie consent that PostHog uses
const CONSENT_KEY = "kaulby:analytics-consent";
const hasConsent =
  typeof window !== "undefined" &&
  localStorage.getItem(CONSENT_KEY) === "granted";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  replaysOnErrorSampleRate: hasConsent ? 1.0 : 0,
  replaysSessionSampleRate: hasConsent ? 0.01 : 0, // 1% baseline session replay, only with consent

  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  // Filter out non-actionable client errors
  ignoreErrors: [
    // Browser/extension noise
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",
    /^Non-Error promise rejection captured/,
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    /ChunkLoadError/,
    /Loading chunk/,
    // Next.js navigation (not real errors)
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
    "cancelled",
  ],

  // Ignore errors from browser extensions
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
  ],
});
