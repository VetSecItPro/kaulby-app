// Inngest module exports
export { inngest, type Events } from "./client";
export { monitorReddit } from "./functions/monitor-reddit";
export { monitorHackerNews } from "./functions/monitor-hackernews";
export { monitorProductHunt } from "./functions/monitor-producthunt";
export { analyzeContent } from "./functions/analyze-content";
export { sendAlert, sendDigest, sendWeeklyDigest } from "./functions/send-alerts";
export { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
export { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries, cleanupWebhookDeliveries } from "./functions/webhook-delivery";

// All functions for the Inngest handler
import { monitorReddit } from "./functions/monitor-reddit";
import { monitorHackerNews } from "./functions/monitor-hackernews";
import { monitorProductHunt } from "./functions/monitor-producthunt";
import { analyzeContent } from "./functions/analyze-content";
import { sendAlert, sendDigest, sendWeeklyDigest } from "./functions/send-alerts";
import { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
import { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries, cleanupWebhookDeliveries } from "./functions/webhook-delivery";

export const functions = [
  monitorReddit,
  monitorHackerNews,
  monitorProductHunt,
  analyzeContent,
  sendAlert,
  sendDigest,
  sendWeeklyDigest,
  dataRetention,
  resetUsageCounters,
  cleanupAiLogs,
  sendWebhookEvent,
  processWebhookDelivery,
  retryWebhookDeliveries,
  cleanupWebhookDeliveries,
];
