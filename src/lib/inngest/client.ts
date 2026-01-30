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
};
