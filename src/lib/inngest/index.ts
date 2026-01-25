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
// New platforms (Phase 3)
export { monitorYouTube } from "./functions/monitor-youtube";
export { monitorG2 } from "./functions/monitor-g2";
export { monitorYelp } from "./functions/monitor-yelp";
export { monitorAmazon } from "./functions/monitor-amazon";
// New platforms (Phase 4 - Developer/Indie focus)
export { monitorIndieHackers } from "./functions/monitor-indiehackers";
export { monitorGitHub } from "./functions/monitor-github";
export { monitorDevTo } from "./functions/monitor-devto";
export { monitorHashnode } from "./functions/monitor-hashnode";
export { scanOnDemand } from "./functions/scan-on-demand";
export { analyzeContent } from "./functions/analyze-content";
export { analyzeContentBatch, shouldUseBatchMode } from "./functions/analyze-content-batch";
export { sendAlert, sendDailyDigest, sendWeeklyDigest, sendMonthlyDigest } from "./functions/send-alerts";
export { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
export { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries, cleanupWebhookDeliveries } from "./functions/webhook-delivery";
export { scheduledAccountDeletion } from "./functions/account-deletion";
export { detectCrisis } from "./functions/crisis-detection";
export { resetStuckScans } from "./functions/reset-stuck-scans";
export { checkBudgetAlerts } from "./functions/budget-alerts";
export { collectCommunityStats, fetchSubredditStats, getLatestStats, ALL_TRACKED_SUBREDDITS } from "./functions/community-stats";
export { detectInactiveUsers, sendReengagement } from "./functions/reengagement";
export { sendScheduledReports } from "./functions/send-scheduled-reports";

// All functions for the Inngest handler
import { monitorReddit } from "./functions/monitor-reddit";
import { monitorHackerNews } from "./functions/monitor-hackernews";
import { monitorProductHunt } from "./functions/monitor-producthunt";
import { monitorGoogleReviews } from "./functions/monitor-googlereviews";
import { monitorTrustpilot } from "./functions/monitor-trustpilot";
import { monitorAppStore } from "./functions/monitor-appstore";
import { monitorPlayStore } from "./functions/monitor-playstore";
import { monitorQuora } from "./functions/monitor-quora";
// New platforms (Phase 3)
import { monitorYouTube } from "./functions/monitor-youtube";
import { monitorG2 } from "./functions/monitor-g2";
import { monitorYelp } from "./functions/monitor-yelp";
import { monitorAmazon } from "./functions/monitor-amazon";
// New platforms (Phase 4 - Developer/Indie focus)
import { monitorIndieHackers } from "./functions/monitor-indiehackers";
import { monitorGitHub } from "./functions/monitor-github";
import { monitorDevTo } from "./functions/monitor-devto";
import { monitorHashnode } from "./functions/monitor-hashnode";
import { scanOnDemand } from "./functions/scan-on-demand";
import { analyzeContent } from "./functions/analyze-content";
import { analyzeContentBatch } from "./functions/analyze-content-batch";
import { sendAlert, sendDailyDigest, sendWeeklyDigest, sendMonthlyDigest } from "./functions/send-alerts";
import { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
import { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries, cleanupWebhookDeliveries } from "./functions/webhook-delivery";
import { scheduledAccountDeletion } from "./functions/account-deletion";
import { detectCrisis } from "./functions/crisis-detection";
import { resetStuckScans } from "./functions/reset-stuck-scans";
import { checkBudgetAlerts } from "./functions/budget-alerts";
import { collectCommunityStats, fetchSubredditStats } from "./functions/community-stats";
import { detectInactiveUsers, sendReengagement } from "./functions/reengagement";
import { sendScheduledReports } from "./functions/send-scheduled-reports";

export const functions = [
  monitorReddit,
  monitorHackerNews,
  monitorProductHunt,
  monitorGoogleReviews,
  monitorTrustpilot,
  monitorAppStore,
  monitorPlayStore,
  monitorQuora,
  // New platforms (Phase 3)
  monitorYouTube,
  monitorG2,
  monitorYelp,
  monitorAmazon,
  // New platforms (Phase 4 - Developer/Indie focus)
  monitorIndieHackers,
  monitorGitHub,
  monitorDevTo,
  monitorHashnode,
  scanOnDemand,
  analyzeContent,
  analyzeContentBatch,
  sendAlert,
  sendDailyDigest,
  sendWeeklyDigest,
  sendMonthlyDigest,
  dataRetention,
  resetUsageCounters,
  cleanupAiLogs,
  sendWebhookEvent,
  processWebhookDelivery,
  retryWebhookDeliveries,
  cleanupWebhookDeliveries,
  scheduledAccountDeletion,
  detectCrisis,
  resetStuckScans,
  checkBudgetAlerts,
  collectCommunityStats,
  fetchSubredditStats,
  // Churn prevention
  detectInactiveUsers,
  sendReengagement,
  // Scheduled reports
  sendScheduledReports,
];
