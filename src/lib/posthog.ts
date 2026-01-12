import { PostHog } from "posthog-node";

// Server-side PostHog client - lazy initialized
let posthogClient: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (!posthogClient && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
      flushAt: 1, // Flush immediately for serverless
      flushInterval: 0,
    });
  }
  return posthogClient;
}

// Export for backwards compatibility (may be null if key not set)
export const posthog = {
  capture: (params: Parameters<PostHog["capture"]>[0]) => getPostHog()?.capture(params),
  identify: (params: Parameters<PostHog["identify"]>[0]) => getPostHog()?.identify(params),
  shutdown: () => getPostHog()?.shutdown(),
};

// Capture server-side event
export function captureEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  getPostHog()?.capture({
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
  getPostHog()?.identify({
    distinctId: params.distinctId,
    properties: params.properties,
  });
}

// Shutdown on process exit
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await getPostHog()?.shutdown();
  });
}
