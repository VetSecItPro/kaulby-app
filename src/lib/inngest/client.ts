import { Inngest } from "inngest";

// Create Inngest client
export const inngest = new Inngest({
  id: "kaulby",
  name: "Kaulby",
});

// Event types for type safety
export type Events = {
  "content/analyze": {
    data: {
      resultId: string;
      userId: string;
    };
  };
  "content/analyze-batch": {
    data: {
      monitorId: string;
      userId: string;
      platform: string;
      resultIds: string[];
      totalCount: number;
    };
  };
  "webhook/send": {
    data: {
      userId: string;
      eventType: string;
      data: Record<string, unknown>;
    };
  };
  "webhook/process-delivery": {
    data: {
      deliveryId: string;
    };
  };
  "monitor/scan.requested": {
    data: {
      monitorId: string;
      userId: string;
    };
  };
  "monitor/scan-now": {
    data: {
      monitorId: string;
      userId: string;
    };
  };
  "user/deletion.scheduled": {
    data: {
      userId: string;
      email: string;
      scheduledAt: string; // ISO timestamp when deletion was requested
    };
  };
  "user/reengagement.send": {
    data: {
      userId: string;
      email: string;
      name?: string;
      daysSinceActive: number;
      stats: {
        activeMonitors: number;
        newMentions: number;
        topMention?: {
          title: string;
          platform: string;
          url: string;
        };
      };
    };
  };
  "user/trial-expiry.winback": {
    data: {
      userId: string;
      email: string;
      name?: string;
      stats: {
        totalMentions: number;
        platforms: number;
        topMention?: {
          title: string;
          platform: string;
          url: string;
        };
      };
    };
  };
  // COA 4 W2.4: GitHub webhook receiver fan-out. The receiver verifies the
  // signature and immediately responds 200; actual payload processing happens
  // asynchronously in the github-webhook-processor Inngest function.
  "github/webhook.received": {
    data: {
      event: string; // value of X-GitHub-Event header (issues, pull_request, ...)
      deliveryId: string; // value of X-GitHub-Delivery header (replay-detection id)
      installationId: number | null;
      repoFullName: string | null; // "owner/name"
      action: string | null; // payload.action (opened, edited, created, ...)
      // COA 4 W2.5: set when signature was verified against a per-monitor secret.
      // null when verified against the env-level GITHUB_WEBHOOK_SECRET fallback.
      monitorId: string | null;
      userId: string | null;
      payload: Record<string, unknown>; // raw JSON-parsed payload
    };
  };
};
