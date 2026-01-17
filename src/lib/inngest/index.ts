// Inngest module exports
export { inngest, type Events } from "./client";
export { monitorReddit } from "./functions/monitor-reddit";
export { monitorHackerNews } from "./functions/monitor-hackernews";
export { monitorProductHunt } from "./functions/monitor-producthunt";
export { monitorGoogleReviews } from "./functions/monitor-googlereviews";
export { monitorTrustpilot } from "./functions/monitor-trustpilot";
export { monitorAppStore } from "./functions/monitor-appstore";
export { monitorPlayStore } from "./functions/monitor-playstore";
export { monitorQuora } from "./functions/monitor-quora";
export { monitorDevTo } from "./functions/monitor-devto";
export { scanOnDemand } from "./functions/scan-on-demand";
export { analyzeContent } from "./functions/analyze-content";
export { sendAlert, sendDailyDigest, sendWeeklyDigest } from "./functions/send-alerts";
export { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
export { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries, cleanupWebhookDeliveries } from "./functions/webhook-delivery";

// All functions for the Inngest handler
import { monitorReddit } from "./functions/monitor-reddit";
import { monitorHackerNews } from "./functions/monitor-hackernews";
import { monitorProductHunt } from "./functions/monitor-producthunt";
import { monitorGoogleReviews } from "./functions/monitor-googlereviews";
import { monitorTrustpilot } from "./functions/monitor-trustpilot";
import { monitorAppStore } from "./functions/monitor-appstore";
import { monitorPlayStore } from "./functions/monitor-playstore";
import { monitorQuora } from "./functions/monitor-quora";
import { monitorDevTo } from "./functions/monitor-devto";
import { scanOnDemand } from "./functions/scan-on-demand";
import { analyzeContent } from "./functions/analyze-content";
import { sendAlert, sendDailyDigest, sendWeeklyDigest } from "./functions/send-alerts";
import { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
import { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries, cleanupWebhookDeliveries } from "./functions/webhook-delivery";

export const functions = [
  monitorReddit,
  monitorHackerNews,
  monitorProductHunt,
  monitorGoogleReviews,
  monitorTrustpilot,
  monitorAppStore,
  monitorPlayStore,
  monitorQuora,
  monitorDevTo,
  scanOnDemand,
  analyzeContent,
  sendAlert,
  sendDailyDigest,
  sendWeeklyDigest,
  dataRetention,
  resetUsageCounters,
  cleanupAiLogs,
  sendWebhookEvent,
  processWebhookDelivery,
  retryWebhookDeliveries,
  cleanupWebhookDeliveries,
];
