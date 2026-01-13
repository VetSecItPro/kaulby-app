import { Inngest } from "inngest";

// Create Inngest client
export const inngest = new Inngest({
  id: "kaulby",
  name: "Kaulby",
});

// Event types for type safety
export type Events = {
  "monitor/reddit.scan": {
    data: {
      monitorId: string;
    };
  };
  "monitor/hackernews.scan": {
    data: {
      monitorId: string;
    };
  };
  "content/analyze": {
    data: {
      resultId: string;
      userId: string;
    };
  };
  "alert/send": {
    data: {
      alertId: string;
      resultIds: string[];
    };
  };
  "alert/digest.send": {
    data: {
      userId: string;
      frequency: "daily" | "weekly";
    };
  };
  "user/welcome.email": {
    data: {
      userId: string;
      email: string;
      name?: string;
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
};
