import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  // Filter out non-actionable errors
  ignoreErrors: [
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
    "DYNAMIC_SERVER_USAGE",
    /AbortError/,
    /ECONNRESET/,
    /ECONNREFUSED/,
    /ETIMEDOUT/,
    /fetch failed/,
  ],

  // Scrub sensitive data from breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "http" && breadcrumb.data?.url) {
      // Remove API keys from URLs
      breadcrumb.data.url = breadcrumb.data.url
        .replace(/token=[^&]+/g, "token=[REDACTED]")
        .replace(/key=[^&]+/g, "key=[REDACTED]");
    }
    return breadcrumb;
  },
});
