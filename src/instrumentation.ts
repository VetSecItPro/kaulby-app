import * as Sentry from "@sentry/nextjs";

export async function register() {
  // SEC-CFG-001: validate required env vars at server boot. The env module
  // throws with a structured error naming each missing/malformed var so
  // misconfiguration surfaces in the deploy log instead of failing at the
  // first webhook call. Runs in nodejs runtime only — edge runtime has a
  // different env surface and Vercel-specific gating.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
