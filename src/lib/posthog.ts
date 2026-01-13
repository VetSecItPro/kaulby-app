import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Validate PostHog configuration
const isPostHogConfigured = (): boolean => {
  if (!POSTHOG_KEY) return false;
  // PostHog Project API keys must start with 'phc_'
  if (!POSTHOG_KEY.startsWith("phc_")) {
    console.warn(
      "[PostHog Server] Invalid API key format. Project API keys start with 'phc_'. " +
      "Go to PostHog → Settings → Project API Key."
    );
    return false;
  }
  return true;
};

// Server-side PostHog client - lazy initialized
let posthogClient: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (!isPostHogConfigured()) return null;

  if (!posthogClient) {
    try {
      posthogClient = new PostHog(POSTHOG_KEY!, {
        host: POSTHOG_HOST || "https://us.posthog.com",
        flushAt: 1, // Flush immediately for serverless
        flushInterval: 0,
      });
    } catch (error) {
      console.warn("[PostHog Server] Failed to initialize:", error);
      return null;
    }
  }
  return posthogClient;
}

// Export for backwards compatibility (operations are no-ops if not configured)
export const posthog = {
  capture: (params: Parameters<PostHog["capture"]>[0]) => {
    try {
      getPostHog()?.capture(params);
    } catch {
      // Silently fail - analytics should never break the app
    }
  },
  identify: (params: Parameters<PostHog["identify"]>[0]) => {
    try {
      getPostHog()?.identify(params);
    } catch {
      // Silently fail
    }
  },
  shutdown: async () => {
    try {
      await getPostHog()?.shutdown();
    } catch {
      // Silently fail
    }
  },
};

// Capture server-side event
export function captureEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  try {
    getPostHog()?.capture({
      distinctId: params.distinctId,
      event: params.event,
      properties: params.properties,
    });
  } catch {
    // Silently fail
  }
}

// Identify user
export function identifyUser(params: {
  distinctId: string;
  properties?: Record<string, unknown>;
}) {
  try {
    getPostHog()?.identify({
      distinctId: params.distinctId,
      properties: params.properties,
    });
  } catch {
    // Silently fail
  }
}

// Shutdown on process exit (only in Node.js environment)
if (typeof process !== "undefined" && process.on) {
  process.on("beforeExit", async () => {
    await posthog.shutdown();
  });
}
