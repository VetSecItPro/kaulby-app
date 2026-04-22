// Inngest module exports
export { inngest, type Events } from "./client";
export { monitorReddit } from "./functions/monitor-reddit";
export { monitorHackerNews } from "./functions/monitor-hackernews";
export { monitorProductHunt } from "./functions/monitor-producthunt";
export { monitorGoogleReviews } from "./functions/monitor-googlereviews";
export { monitorTrustpilot } from "./functions/monitor-trustpilot";
export { monitorAppStore } from "./functions/monitor-appstore";
export { monitorPlayStore } from "./functions/monitor-playstore";
// monitorQuora: deferred 2026-04-22 — platform removed from active tier list pending
// Team-tier-only reactivation with a custom Crawlee actor. See
// .mdmp/apify-platform-cost-audit-2026-04-21.md (§Quora) and monitor-quora.ts header.
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
// Phase 5 - Social media
export { monitorX } from "./functions/monitor-x";
export { scanOnDemand } from "./functions/scan-on-demand";
export { instantScan } from "./functions/instant-scan";
export { analyzeContent } from "./functions/analyze-content";
export { analyzeContentBatch } from "./functions/analyze-content-batch";
export { sendAlert, sendDailyDigest, sendWeeklyDigest, sendMonthlyDigest } from "./functions/send-alerts";
export { sendWeeklyDigestCron } from "./functions/send-weekly-digest";
export { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
// Task DL.3: cleanupWebhookDeliveries was removed — retention now handled by dataRetention.
export { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries } from "./functions/webhook-delivery";
export { scheduledAccountDeletion } from "./functions/account-deletion";
export { detectCrisis } from "./functions/crisis-detection";
export { resetStuckScans } from "./functions/reset-stuck-scans";
export { checkBudgetAlerts } from "./functions/budget-alerts";
export { collectCommunityStats, fetchSubredditStats, ALL_TRACKED_SUBREDDITS } from "./functions/community-stats";
export { detectInactiveUsers, sendReengagement } from "./functions/reengagement";
// Trial win-back
export { detectExpiredTrials, sendTrialWinback } from "./functions/trial-winback";
export { sendScheduledReports } from "./functions/send-scheduled-reports";
// Onboarding
export { onboardingFollowup } from "./functions/onboarding-followup";
// HubSpot CRM sync
export { syncHubspotContacts } from "./functions/sync-hubspot-contacts";
// AI Visibility
export { checkAIVisibilityJob } from "./functions/ai-visibility";
// Chat cleanup
export { chatCleanup } from "./functions/chat-cleanup";
// COA 4 W2.4: GitHub webhook async processor
export { githubWebhookProcessor } from "./functions/github-webhook-processor";

// All functions for the Inngest handler
import { monitorReddit } from "./functions/monitor-reddit";
import { monitorHackerNews } from "./functions/monitor-hackernews";
import { monitorProductHunt } from "./functions/monitor-producthunt";
import { monitorGoogleReviews } from "./functions/monitor-googlereviews";
import { monitorTrustpilot } from "./functions/monitor-trustpilot";
import { monitorAppStore } from "./functions/monitor-appstore";
import { monitorPlayStore } from "./functions/monitor-playstore";
// monitorQuora deferred — see export block above
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
// Phase 5 - Social media
import { monitorX } from "./functions/monitor-x";
import { scanOnDemand } from "./functions/scan-on-demand";
import { instantScan } from "./functions/instant-scan";
import { analyzeContent } from "./functions/analyze-content";
import { analyzeContentBatch } from "./functions/analyze-content-batch";
import { sendAlert, sendDailyDigest, sendWeeklyDigest, sendMonthlyDigest } from "./functions/send-alerts";
import { sendWeeklyDigestCron } from "./functions/send-weekly-digest";
import { dataRetention, resetUsageCounters, cleanupAiLogs } from "./functions/data-retention";
import { sendWebhookEvent, processWebhookDelivery, retryWebhookDeliveries } from "./functions/webhook-delivery";
import { scheduledAccountDeletion } from "./functions/account-deletion";
import { detectCrisis } from "./functions/crisis-detection";
import { resetStuckScans } from "./functions/reset-stuck-scans";
import { checkBudgetAlerts } from "./functions/budget-alerts";
import { collectCommunityStats, fetchSubredditStats } from "./functions/community-stats";
import { detectInactiveUsers, sendReengagement } from "./functions/reengagement";
// Trial win-back
import { detectExpiredTrials, sendTrialWinback } from "./functions/trial-winback";
import { sendScheduledReports } from "./functions/send-scheduled-reports";
// Onboarding
import { onboardingFollowup } from "./functions/onboarding-followup";
// HubSpot CRM sync
import { syncHubspotContacts } from "./functions/sync-hubspot-contacts";
// AI Visibility
import { checkAIVisibilityJob } from "./functions/ai-visibility";
// Chat cleanup
import { chatCleanup } from "./functions/chat-cleanup";
import { githubWebhookProcessor } from "./functions/github-webhook-processor";

export const functions = [
  monitorReddit,
  monitorHackerNews,
  monitorProductHunt,
  monitorGoogleReviews,
  monitorTrustpilot,
  monitorAppStore,
  monitorPlayStore,
  // monitorQuora deferred — not registered as an Inngest function
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
  // Phase 5 - Social media
  monitorX,
  scanOnDemand,
  instantScan,
  analyzeContent,
  analyzeContentBatch,
  sendAlert,
  sendDailyDigest,
  sendWeeklyDigest,
  sendWeeklyDigestCron,
  sendMonthlyDigest,
  dataRetention,
  resetUsageCounters,
  cleanupAiLogs,
  sendWebhookEvent,
  processWebhookDelivery,
  retryWebhookDeliveries,
  scheduledAccountDeletion,
  detectCrisis,
  resetStuckScans,
  checkBudgetAlerts,
  collectCommunityStats,
  fetchSubredditStats,
  // Churn prevention
  detectInactiveUsers,
  sendReengagement,
  // Trial win-back
  detectExpiredTrials,
  sendTrialWinback,
  // Scheduled reports
  sendScheduledReports,
  // Onboarding
  onboardingFollowup,
  // HubSpot CRM sync
  syncHubspotContacts,
  // AI Visibility
  checkAIVisibilityJob,
  // Chat cleanup
  chatCleanup,
  // COA 4 W2.4
  githubWebhookProcessor,
];
