import { PostHog } from "posthog-node";

// Server-side PostHog client
export const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || "", {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  flushAt: 1, // Flush immediately for serverless
  flushInterval: 0,
});

// Capture server-side event
export function captureEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  posthog.capture({
    distinctId: params.distinctId,
    event: params.event,
    properties: params.properties,
  });
}

// Identify user
export function identifyUser(params: {
  distinctId: string;
  properties?: Record<string, unknown>;
}) {
  posthog.identify({
    distinctId: params.distinctId,
    properties: params.properties,
  });
}

// Shutdown on process exit
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await posthog.shutdown();
  });
}
