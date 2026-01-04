// Inngest module exports
export { inngest, type Events } from "./client";
export { monitorReddit } from "./functions/monitor-reddit";
export { monitorHackerNews } from "./functions/monitor-hackernews";
export { analyzeContent } from "./functions/analyze-content";
export { sendAlert, sendDigest } from "./functions/send-alerts";

// All functions for the Inngest handler
import { monitorReddit } from "./functions/monitor-reddit";
import { monitorHackerNews } from "./functions/monitor-hackernews";
import { analyzeContent } from "./functions/analyze-content";
import { sendAlert, sendDigest } from "./functions/send-alerts";

export const functions = [
  monitorReddit,
  monitorHackerNews,
  analyzeContent,
  sendAlert,
  sendDigest,
];
