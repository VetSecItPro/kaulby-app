import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  uuid,
  integer,
  real,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "free",
  "pro",
  "team",
]);

export const platformEnum = pgEnum("platform", [
  "reddit",
  "hackernews",
  "producthunt",
  "devto",           // Developer blog articles
  "googlereviews",
  "trustpilot",
  "appstore",
  "playstore",
  "quora",
  "youtube",         // Video comments and discussions
  "g2",              // Software reviews
  "yelp",            // Local business reviews
  "amazonreviews",   // Product reviews
  // NEW PLATFORMS (Phase 2 - Developer/Indie focus)
  "indiehackers",    // Indie Hackers community posts
  "github",          // GitHub Issues and Discussions
  "hashnode",        // Hashnode blog articles
  // Phase 5 - Social media
  "x",               // X (Twitter) via xAI x_search API
]);

export const alertChannelEnum = pgEnum("alert_channel", [
  "email",
  "slack",
  "in_app",
  "teams",
]);

export const alertFrequencyEnum = pgEnum("alert_frequency", [
  "instant",
  "daily",
  "weekly",
  "monthly",
]);

export const sentimentEnum = pgEnum("sentiment", [
  "positive",
  "negative",
  "neutral",
]);

export const painPointCategoryEnum = pgEnum("pain_point_category", [
  "competitor_mention",
  "pricing_concern",
  "feature_request",
  "support_need",
  "negative_experience",
  "positive_feedback",
  "general_discussion",
]);

// Conversation category - GummySearch-style content classification
// Helps users quickly filter for the most valuable discussions
export const conversationCategoryEnum = pgEnum("conversation_category", [
  "pain_point",       // Frustration, complaint, problem description
  "solution_request", // Actively seeking recommendations/alternatives
  "advice_request",   // Looking for guidance, how-to questions
  "money_talk",       // Budget discussions, pricing questions, ROI talk
  "hot_discussion",   // Trending/viral threads with high engagement
]);

// Monitor type - keyword-based or AI-powered discovery
export const monitorTypeEnum = pgEnum("monitor_type", [
  "keyword",     // Traditional keyword-based monitoring
  "ai_discovery", // AI-powered semantic discovery (Pro/Enterprise)
]);

// Workspace role enum with granular permissions
export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",   // Full control: billing, delete workspace, manage all members
  "admin",   // Can invite/remove members (except owner), manage all monitors
  "editor",  // Can create/edit monitors and view all results
  "viewer",  // Read-only: view monitors and results, no editing
]);

// Invite status enum
export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
]);

// Activity log action types for workspace audit trail
export const activityActionEnum = pgEnum("activity_action", [
  // Monitor actions
  "monitor_created",
  "monitor_updated",
  "monitor_deleted",
  "monitor_paused",
  "monitor_resumed",
  "monitor_duplicated",
  // Member actions
  "member_invited",
  "member_joined",
  "member_removed",
  "member_role_changed",
  // Workspace actions
  "workspace_created",
  "workspace_updated",
  "workspace_settings_changed",
  // API & Webhook actions
  "api_key_created",
  "api_key_revoked",
  "webhook_created",
  "webhook_updated",
  "webhook_deleted",
]);

// Workspaces - team containers for Enterprise users
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // DB: FK constraint to users.id exists at DB level (SET NULL on delete) — declared via db:push
  // Cannot use inline .references() here due to circular dependency with users.workspaceId
  ownerId: text("owner_id"), // Clerk user ID of workspace owner
  seatLimit: integer("seat_limit").default(3).notNull(),
  seatCount: integer("seat_count").default(1).notNull(), // Current number of members
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("workspaces_owner_id_idx").on(table.ownerId),
]);

// Activity logs - audit trail for workspace actions
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: activityActionEnum("action").notNull(),
  // Target entity info (what was affected)
  targetType: text("target_type"), // "monitor", "member", "webhook", etc.
  targetId: text("target_id"), // ID of the affected entity
  targetName: text("target_name"), // Human-readable name (e.g., monitor name, member email)
  // Additional context stored as JSON
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  // IP and user agent for security auditing
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Task DL.3: soft-delete column so retention can stage deletes with a 30d grace window.
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("activity_logs_workspace_id_idx").on(table.workspaceId),
  index("activity_logs_user_id_idx").on(table.userId),
  index("activity_logs_created_at_idx").on(table.createdAt),
  // FIX-220: Composite index for workspace activity queries ordered by time
  index("activity_logs_workspace_created_idx").on(table.workspaceId, table.createdAt),
]);

// Users table - synced with Clerk
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  // DB: UNIQUE enforces no duplicate emails at DB level — FIX-011
  email: text("email").notNull().unique(),
  name: text("name"),
  timezone: text("timezone").default("America/New_York").notNull(), // IANA timezone (auto-detected from browser)
  isAdmin: boolean("is_admin").default(false).notNull(), // DB: Security agent verified — no bypasses exist — FIX-010
  isBanned: boolean("is_banned").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  // Onboarding tracking
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  // Workspace membership (Enterprise feature)
  // DB: SET NULL intentional — user record survives workspace deletion — FIX-023
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  workspaceRole: workspaceRoleEnum("workspace_role"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("free").notNull(),
  subscriptionId: text("subscription_id"),
  // Polar.sh fields (new payment provider)
  polarCustomerId: text("polar_customer_id").unique(),
  polarSubscriptionId: text("polar_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  // Founding member tracking (first 1,000 Pro/Team subscribers)
  isFoundingMember: boolean("is_founding_member").default(false).notNull(),
  foundingMemberNumber: integer("founding_member_number"), // DB: Business logic constrains to 1-1000 — FIX-108
  foundingMemberPriceId: text("founding_member_price_id"), // Polar product ID they locked in
  // Day Pass - 24hr Pro access for $10
  dayPassExpiresAt: timestamp("day_pass_expires_at"), // When the day pass expires (null = no active pass)
  dayPassPurchaseCount: integer("day_pass_purchase_count").default(0).notNull(), // Track repeat buyers
  lastDayPassPurchasedAt: timestamp("last_day_pass_purchased_at"), // Last purchase timestamp
  // Account deletion - 7 day cooldown before permanent deletion
  deletionRequestedAt: timestamp("deletion_requested_at"), // When user requested deletion (null = not requested)
  // Third-party integrations (HubSpot, Salesforce, etc.)
  integrations: jsonb("integrations").$type<Record<string, unknown>>(),
  // Activity tracking for churn detection
  lastActiveAt: timestamp("last_active_at"), // Last meaningful activity (dashboard visit, monitor action)
  reengagementEmailSentAt: timestamp("reengagement_email_sent_at"), // Prevent duplicate re-engagement emails
  reengagementOptOut: boolean("reengagement_opt_out").default(false).notNull(), // User opted out of re-engagement emails
  trialWinbackSentAt: timestamp("trial_winback_sent_at"), // Prevent duplicate trial win-back emails
  // Scheduled PDF Reports (Team tier feature)
  reportSchedule: text("report_schedule").default("off"), // 'off' | 'weekly' | 'monthly'
  reportDay: integer("report_day").default(1), // Day of week (1=Mon) for weekly, day of month for monthly
  reportLastSentAt: timestamp("report_last_sent_at"), // Track last report sent to prevent duplicates
  // White-label report customization (Team tier)
  reportBranding: jsonb("report_branding").$type<{
    companyName?: string;     // Custom company name (replaces "Kaulby" in header)
    logoUrl?: string;          // Custom logo URL
    primaryColor?: string;     // Hex color for headers/accents
    footerText?: string;       // Custom footer text
    hideKaulbyBranding?: boolean; // Remove "Powered by Kaulby" footer
  }>(),
  // Email digest pause feature
  digestPaused: boolean("digest_paused").default(false).notNull(), // Pause emails while keeping monitors active
  // Weekly digest opt-out (Task 2.4 — Monday 9am cron for pro/team users)
  weeklyDigestEnabled: boolean("weekly_digest_enabled").default(true).notNull(),
  // Terms of Service acceptance tracking — legal paper trail
  tosAcceptedAt: timestamp("tos_accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("users_timezone_idx").on(table.timezone),
  index("users_email_idx").on(table.email),
  index("users_subscription_status_idx").on(table.subscriptionStatus),
  index("users_last_active_at_idx").on(table.lastActiveAt),
  index("users_deletion_requested_at_idx").on(table.deletionRequestedAt),
  // DB: Verified for workspace member lookups — FIX-116
  index("users_workspace_id_idx").on(table.workspaceId),
]);

// Audiences - collections of monitors grouped by topic/project (GummySearch-style)
export const audiences = pgTable("audiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Workspace ID for team ownership - allows transfer when members leave
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"), // Hex color for UI (e.g., "#3b82f6")
  icon: text("icon"), // Lucide icon name (e.g., "briefcase", "rocket")
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("audiences_user_id_idx").on(table.userId),
  index("audiences_workspace_id_idx").on(table.workspaceId),
]);

// Audience-Monitor junction table - links monitors to audiences
export const audienceMonitors = pgTable("audience_monitors", {
  audienceId: uuid("audience_id")
    .notNull()
    .references(() => audiences.id, { onDelete: "cascade" }),
  monitorId: uuid("monitor_id")
    .notNull()
    .references(() => monitors.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  // DB: Composite PK prevents duplicate relationships — FIX-100
  primaryKey({ columns: [table.audienceId, table.monitorId] }),
  index("audience_monitors_audience_idx").on(table.audienceId),
  index("audience_monitors_monitor_idx").on(table.monitorId),
]);

// Communities - subreddits, HN, etc.
export const communities = pgTable("communities", {
  id: uuid("id").primaryKey().defaultRandom(),
  audienceId: uuid("audience_id")
    .notNull()
    .references(() => audiences.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  identifier: text("identifier").notNull(), // subreddit name, etc.
  metadata: jsonb("metadata"), // size, activity level, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("communities_audience_id_idx").on(table.audienceId),
]);

// Monitors - keyword/topic trackers
export const monitors = pgTable("monitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Workspace ID for team ownership - allows transfer when members leave
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "set null" }),
  name: text("name").notNull(), // Display name for the monitor
  companyName: text("company_name").notNull().default(""), // DB: Made NOT NULL with default — FIX-106 resolved
  keywords: text("keywords").array().notNull(), // Additional keywords to track alongside company name
  // Monitor type: keyword (traditional) or ai_discovery (semantic AI-based)
  monitorType: monitorTypeEnum("monitor_type").default("keyword").notNull(),
  // AI Discovery settings (used when monitorType is "ai_discovery")
  discoveryPrompt: text("discovery_prompt"), // Natural language description of what to find
  // Advanced boolean search query (Pro feature)
  // Supports: "exact phrase", title:, body:, author:, subreddit:, NOT, OR, AND
  searchQuery: text("search_query"),
  // Platform-specific URLs (for Google Reviews, Trustpilot, App Store, Play Store)
  // Format: { googlereviews: "url", trustpilot: "url", ... }
  platformUrls: jsonb("platform_urls").$type<Record<string, string>>(),
  // COA 4 W2.5: GitHub real-time webhook per-monitor registration.
  // When set, the /api/webhooks/github receiver verifies incoming payloads
  // against THIS monitor's secret for THIS monitor's repo. User copies the
  // URL + secret from the monitor settings UI and pastes into their repo's
  // Settings → Webhooks. See `.github/runbooks/github-webhooks.md`.
  // Format: "owner/repo" (e.g. "VetSecItPro/kaulby-app")
  githubRepoFullName: text("github_repo_full_name"),
  // Shared HMAC secret — random 32-byte hex, generated on monitor creation
  // and shown to the user ONCE during webhook setup. Never logged; never
  // included in API responses beyond the initial setup view.
  githubWebhookSecret: text("github_webhook_secret"),
  filters: jsonb("filters"), // pain_point, solution_requests, etc.
  platforms: platformEnum("platforms").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  // COA 4 W1.10: silent-failure observability. Set when a scheduled scan fails
  // for this monitor (scraper error, API failure, etc.). Cleared on next success.
  // Rendered as a red dot + "Last check failed X minutes ago" tooltip on the
  // monitor card so operators can see broken scans without digging into logs.
  lastCheckFailedAt: timestamp("last_check_failed_at"),
  lastCheckFailedReason: text("last_check_failed_reason"),
  newMatchCount: integer("new_match_count").default(0).notNull(),
  // Manual scan tracking
  lastManualScanAt: timestamp("last_manual_scan_at"), // When the user last triggered a manual scan
  isScanning: boolean("is_scanning").default(false).notNull(), // Whether a scan is currently in progress
  scanProgress: jsonb("scan_progress").$type<{
    step: string;
    platformsTotal: number;
    platformsCompleted: number;
    platformResults: Record<string, number>;
    currentPlatform: string | null;
    startedAt: string;
  }>(), // Live progress for scan stepper UI
  // Batch AI analysis - for cost-efficient analysis of large volumes (>50 results)
  batchAnalysis: jsonb("batch_analysis"), // Stores BatchSummaryResult from batch-summary.ts
  lastBatchAnalyzedAt: timestamp("last_batch_analyzed_at"), // When batch analysis was last run
  // Monitor scheduling - set active hours for monitoring
  scheduleEnabled: boolean("schedule_enabled").default(false).notNull(),
  scheduleStartHour: integer("schedule_start_hour").default(9), // DB: Valid range 0-23 — FIX-107
  scheduleEndHour: integer("schedule_end_hour").default(17), // 0-23, default 5 PM
  scheduleDays: integer("schedule_days").array(), // 0=Sun, 1=Mon, ..., 6=Sat. null = all days
  scheduleTimezone: text("schedule_timezone").default("America/New_York"), // IANA timezone
  // Crisis detection thresholds (configurable per monitor, Team tier only)
  crisisThresholds: jsonb("crisis_thresholds").$type<{
    negativeSpikePct: number;       // Percentage increase to trigger (default: 50)
    viralEngagement: number;         // Engagement score for viral detection (default: 100)
    minNegativeCount: number;        // Minimum negative count before alerting (default: 5)
    volumeSpikeMultiplier: number;   // Multiplier for volume spike detection (default: 2)
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("monitors_user_id_idx").on(table.userId),
  index("monitors_workspace_id_idx").on(table.workspaceId),
  index("monitors_audience_id_idx").on(table.audienceId),
  index("monitors_is_active_idx").on(table.isActive),
  index("monitors_is_active_platforms_idx").on(table.isActive, table.platforms),
  index("monitors_last_checked_at_idx").on(table.lastCheckedAt),
]);

// Alerts - notification settings
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  monitorId: uuid("monitor_id")
    .notNull()
    .references(() => monitors.id, { onDelete: "cascade" }),
  channel: alertChannelEnum("channel").notNull(),
  frequency: alertFrequencyEnum("frequency").notNull(),
  destination: text("destination").notNull(), // email address, slack webhook, etc.
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("alerts_monitor_id_idx").on(table.monitorId),
  uniqueIndex("alerts_monitor_channel_dest_idx").on(table.monitorId, table.channel, table.destination),
]);

// Results - found content
export const results = pgTable("results", {
  id: uuid("id").primaryKey().defaultRandom(),
  monitorId: uuid("monitor_id")
    .notNull()
    .references(() => monitors.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  author: text("author"),
  postedAt: timestamp("posted_at"),
  sentiment: sentimentEnum("sentiment"),
  sentimentScore: real("sentiment_score"),
  painPointCategory: painPointCategoryEnum("pain_point_category"),
  // Conversation category - GummySearch-style classification for quick filtering
  conversationCategory: conversationCategoryEnum("conversation_category"),
  conversationCategoryConfidence: real("conversation_category_confidence"), // 0.0 to 1.0
  engagementScore: integer("engagement_score"), // For hot_discussion detection (upvotes + comments)
  // Lead scoring - identifies high-intent posts (Phase 5)
  leadScore: integer("lead_score"), // 0-100 composite score
  leadScoreFactors: jsonb("lead_score_factors").$type<{
    intent: number;        // 0-40 - Intent signals ("looking for", "need a tool", etc.)
    engagement: number;    // 0-20 - Upvotes, comments indicate reach
    recency: number;       // 0-15 - Newer posts = fresher leads
    authorQuality: number; // 0-15 - Karma, account age, history
    category: number;      // 0-10 - Solution requests score higher
    total: number;         // 0-100 - Sum of all factors
  }>(),
  aiSummary: text("ai_summary"),
  // Digest tracking - prevent sending same result multiple times
  lastSentInDigestAt: timestamp("last_sent_in_digest_at"),
  aiAnalysis: jsonb("ai_analysis"), // Full AI analysis JSON (Pro: sentiment+painpoint+summary, Team: comprehensive)
  metadata: jsonb("metadata"),
  // User interaction tracking
  isViewed: boolean("is_viewed").default(false).notNull(),
  viewedAt: timestamp("viewed_at"),
  isClicked: boolean("is_clicked").default(false).notNull(),
  clickedAt: timestamp("clicked_at"),
  isSaved: boolean("is_saved").default(false).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  // Batch analysis flag - true if this result was part of a batch analysis instead of individual AI analysis
  batchAnalyzed: boolean("batch_analyzed").default(false).notNull(),
  // AI analysis outcome tracking — nullable so legacy rows (pre-migration) stay null.
  // true = analyzed successfully. false = analysis failed, sentiment is null (not fabricated).
  // Why: prior fallback set sentiment='neutral' on AI failure, silently poisoning sentiment data.
  aiAnalyzed: boolean("ai_analyzed"),
  aiError: text("ai_error"), // truncated error message when aiAnalyzed=false; null otherwise
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("results_batch_analyzed_idx").on(table.batchAnalyzed),
  index("results_ai_analyzed_idx").on(table.aiAnalyzed),
  index("results_created_at_idx").on(table.createdAt),
  index("results_platform_idx").on(table.platform),
  index("results_sentiment_idx").on(table.sentiment),
  index("results_conversation_category_idx").on(table.conversationCategory),
  index("results_lead_score_idx").on(table.leadScore),
  index("results_source_url_idx").on(table.sourceUrl),
  index("results_monitor_created_idx").on(table.monitorId, table.createdAt),
  index("results_monitor_hidden_created_idx").on(table.monitorId, table.isHidden, table.createdAt),
  index("results_engagement_score_idx").on(table.engagementScore),
  index("results_last_sent_in_digest_idx").on(table.lastSentInDigestAt),
  index("results_is_saved_idx").on(table.isSaved),
  index("results_posted_at_idx").on(table.postedAt),
  // DB: Composite index for dashboard queries filtering by view/hide state — FIX-005
  index("results_viewed_hidden_idx").on(table.isViewed, table.isHidden),
  // DB: Composite index for high-intent lead queries — FIX-020
  index("results_lead_score_viewed_hidden_idx").on(table.leadScore, table.isViewed, table.isHidden),
  // DB: Dashboard query optimization — FIX-113
  index("results_hidden_created_idx").on(table.isHidden, table.createdAt),
  // Tier 1 Task 1.1: Composite index for dashboard insights sentiment filter
  // and crisis detection's negative-sentiment spike query. Covers
  // WHERE monitor_id IN (...) AND sentiment = ? AND is_hidden = ?
  // ORDER BY created_at DESC LIMIT N — the shape of the "Negative attention"
  // and "Pain points" dashboard cards and the 24h crisis-detection window.
  index("results_monitor_sentiment_hidden_created_idx").on(
    table.monitorId,
    table.sentiment,
    table.isHidden,
    table.createdAt.desc()
  ),
  // Tier 1 Task 1.1: Composite index for "Engage Today" + reengagement queries
  // that sort by engagement_score DESC then recency. Covers
  // WHERE monitor_id IN (...) AND is_hidden = false
  // ORDER BY engagement_score DESC, created_at DESC LIMIT N.
  index("results_monitor_engagement_created_idx").on(
    table.monitorId,
    table.engagementScore.desc(),
    table.createdAt.desc()
  ),
]);

// AI Logs - for cost tracking
export const aiLogs = pgTable("ai_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  costUsd: real("cost_usd"),
  latencyMs: integer("latency_ms"),
  traceId: text("trace_id"), // Langfuse trace ID
  // Cost attribution columns — SET NULL on delete preserves logs for cost tracking
  monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "set null" }),
  resultId: uuid("result_id").references(() => results.id, { onDelete: "set null" }),
  analysisType: text("analysis_type"), // "sentiment" | "pain_points" | "summary" | "comprehensive" | "categorization"
  cacheHit: boolean("cache_hit").default(false),
  platform: text("platform"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ai_logs_user_id_idx").on(table.userId),
  index("ai_logs_created_at_idx").on(table.createdAt),
  index("ai_logs_monitor_id_idx").on(table.monitorId),
  index("ai_logs_analysis_type_idx").on(table.analysisType),
  index("ai_logs_cache_hit_idx").on(table.cacheHit),
  index("ai_logs_result_id_idx").on(table.resultId),
]);

// Budget Alerts - admin cost monitoring and alerting
export const budgetAlerts = pgTable("budget_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g., "Daily AI Cost Limit"
  period: text("period").notNull(), // "daily" | "weekly" | "monthly"
  thresholdUsd: real("threshold_usd").notNull(), // e.g., 50.00
  warningPercent: integer("warning_percent").default(80).notNull(), // Alert at 80% of threshold
  isActive: boolean("is_active").default(true).notNull(),
  notifyEmail: text("notify_email"), // Email to notify (null = no email)
  notifySlack: text("notify_slack"), // Slack webhook URL (null = no slack)
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastNotifiedAt: timestamp("last_notified_at"),
  currentPeriodSpend: real("current_period_spend").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Budget Alert History - log of triggered alerts
export const budgetAlertHistory = pgTable("budget_alert_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => budgetAlerts.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  spendUsd: real("spend_usd").notNull(),
  thresholdUsd: real("threshold_usd").notNull(),
  percentOfThreshold: real("percent_of_threshold").notNull(),
  alertType: text("alert_type").notNull(), // "warning" | "exceeded"
  notificationSent: boolean("notification_sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("budget_alert_history_alert_id_idx").on(table.alertId),
  index("budget_alert_history_created_at_idx").on(table.createdAt),
]);

// Error Logs - application error tracking for admin dashboard
export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: text("level").notNull(), // "error" | "warning" | "fatal"
  source: text("source").notNull(), // "api" | "inngest" | "ai" | "webhook" | "auth"
  message: text("message").notNull(),
  stack: text("stack"),
  context: jsonb("context").$type<Record<string, unknown>>(), // Additional context (userId, monitorId, etc.)
  requestId: text("request_id"), // For correlating related errors
  userId: text("user_id"), // Optional - which user triggered it
  endpoint: text("endpoint"), // API endpoint or function name
  statusCode: integer("status_code"), // HTTP status code if applicable
  duration: integer("duration"), // Duration in ms if applicable
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"), // Admin who resolved it
  notes: text("notes"), // Admin notes about resolution
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Soft-delete marker for retention policy (90d resolved / 1y unresolved, then 30d grace)
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("error_logs_level_idx").on(table.level),
  index("error_logs_source_idx").on(table.source),
  index("error_logs_created_at_idx").on(table.createdAt),
  index("error_logs_resolved_idx").on(table.resolved),
  index("error_logs_user_id_idx").on(table.userId),
]);

// Usage - monthly usage tracking per billing period
export const usage = pgTable("usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  resultsCount: integer("results_count").default(0).notNull(),
  aiCallsCount: integer("ai_calls_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("usage_user_id_period_idx").on(table.userId, table.periodStart),
]);

// Webhook status enum
export const webhookStatusEnum = pgEnum("webhook_status", [
  "pending",
  "success",
  "failed",
  "retrying",
]);

// Webhooks - custom webhook endpoints for team tier users
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"), // For HMAC signature verification
  isActive: boolean("is_active").default(true).notNull(),
  events: jsonb("events").$type<string[]>().default(["new_result"]), // Which events to send
  headers: jsonb("headers").$type<Record<string, string>>(), // Custom headers
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // DB: Index for webhook delivery queries filtering active webhooks — FIX-006
  index("webhooks_is_active_idx").on(table.isActive),
  index("webhooks_user_id_idx").on(table.userId),
]);

// Webhook Deliveries - tracks each delivery attempt with retry logic
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // e.g., "new_result", "monitor_triggered"
  payload: jsonb("payload").notNull(), // The data sent to the webhook
  status: webhookStatusEnum("status").default("pending").notNull(),
  statusCode: integer("status_code"), // HTTP status code from response
  responseBody: text("response_body"), // Response from the webhook endpoint
  errorMessage: text("error_message"), // Error message if failed
  attemptCount: integer("attempt_count").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(5).notNull(),
  nextRetryAt: timestamp("next_retry_at"), // When to retry (null if not scheduled)
  completedAt: timestamp("completed_at"), // When delivery was successful or gave up
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Task DL.3: soft-delete column so retention can stage deletes with a 30d grace window.
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("webhook_deliveries_webhook_id_idx").on(table.webhookId),
  index("webhook_deliveries_status_retry_idx").on(table.status, table.nextRetryAt),
  index("webhook_deliveries_status_created_idx").on(table.status, table.createdAt),
]);

// API Keys - for Team tier API access
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // User-friendly name (e.g., "Production API Key")
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for identification (e.g., "kaulby_a")
  keyHash: text("key_hash").notNull(), // SHA-256 hash of the full key
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration
  isActive: boolean("is_active").default(true).notNull(),
  // Rate limiting
  requestCount: integer("request_count").default(0).notNull(), // Total requests made
  dailyRequestCount: integer("daily_request_count").default(0).notNull(), // Today's requests
  dailyRequestResetAt: timestamp("daily_request_reset_at"), // When to reset daily count
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"), // When the key was revoked
}, (table) => [
  index("api_keys_user_id_idx").on(table.userId),
  index("api_keys_key_hash_idx").on(table.keyHash),
  // DB: Auth lookup optimization — FIX-101
  index("api_keys_auth_lookup_idx").on(table.keyHash, table.isActive),
]);

// Workspace Invites - pending team invitations for Enterprise
export const workspaceInvites = pgTable("workspace_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(), // Email of the person being invited
  invitedBy: text("invited_by").notNull(), // Clerk user ID of the inviter
  token: text("token").notNull().unique(), // Unique token for invite link
  status: inviteStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Invite expires after 7 days
  acceptedAt: timestamp("accepted_at"), // When the invite was accepted
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("workspace_invites_workspace_id_idx").on(table.workspaceId),
  index("workspace_invites_workspace_status_idx").on(table.workspaceId, table.status),
]);

// Community Growth - track community size over time (Phase 3)
// Used for community discovery and growth rate calculations
// DB: Consider UNIQUE on (platform, identifier, date) — FIX-109
export const communityGrowth = pgTable("community_growth", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: platformEnum("platform").notNull(),
  identifier: text("identifier").notNull(), // e.g., "r/SaaS", "Hacker News"
  memberCount: integer("member_count"),
  postCountDaily: integer("post_count_daily"), // Posts in last 24 hours
  engagementRate: real("engagement_rate"), // Average engagement per post
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => [
  index("community_growth_lookup_idx").on(table.platform, table.identifier, table.recordedAt),
  uniqueIndex("community_growth_platform_identifier_date_idx").on(table.platform, table.identifier, sql`DATE(${table.recordedAt})`),
]);

// Saved Searches - user-saved search queries (Phase 1)
// Allows users to save and reuse complex search queries
export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: text("query").notNull(), // The boolean search query string
  filters: jsonb("filters").$type<{
    platforms?: string[];
    categories?: string[];
    sentiments?: string[];
    dateRange?: { from?: string; to?: string };
  }>(),
  useCount: integer("use_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("saved_searches_user_id_idx").on(table.userId),
]);

// Email Tracking - track opens, clicks, and engagement for digest emails
export const emailEvents = pgTable("email_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emailType: text("email_type").notNull(), // 'daily_digest' | 'weekly_digest' | 'monthly_digest' | 'alert' | 'report'
  emailId: text("email_id").notNull(), // Unique ID for the sent email (for deduplication)
  eventType: text("event_type").notNull(), // 'sent' | 'opened' | 'clicked'
  linkUrl: text("link_url"), // Only for click events
  metadata: jsonb("metadata").$type<{
    userAgent?: string;
    ipCountry?: string;
    resultId?: string;
    monitorId?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Soft-delete marker for retention policy (90d 'sent' / 1y 'opened'+'clicked', then 30d grace)
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("email_events_user_id_idx").on(table.userId),
  index("email_events_email_id_idx").on(table.emailId),
  index("email_events_email_type_idx").on(table.emailType),
  // DB: Dedup optimization — FIX-118
  index("email_events_dedup_idx").on(table.emailId, table.eventType),
]);

// User feedback - bug reports, feature requests, support tickets
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userEmail: text("user_email"),
  userName: text("user_name"),
  category: text("category").notNull(), // "bug" | "feature" | "technical" | "billing" | "other"
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").default("open").notNull(), // "open" | "in_progress" | "resolved" | "closed"
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("feedback_user_id_idx").on(table.userId),
  index("feedback_status_idx").on(table.status),
  index("feedback_created_at_idx").on(table.createdAt),
]);

// Notifications - in-app notification center
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // "alert" | "crisis" | "system"
  monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "set null" }),
  // DB: FK with SET NULL so notifications survive result deletion — FIX-INT-002
  resultId: uuid("result_id").references(() => results.id, { onDelete: "set null" }),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.isRead),
  index("notifications_monitor_id_idx").on(table.monitorId),
  index("notifications_result_id_idx").on(table.resultId),
]);

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(users),
  invites: many(workspaceInvites),
  monitors: many(monitors),
  audiences: many(audiences),
  activityLogs: many(activityLogs),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityLogs.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const workspaceInvitesRelations = relations(workspaceInvites, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvites.workspaceId],
    references: [workspaces.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.workspaceId],
    references: [workspaces.id],
  }),
  audiences: many(audiences),
  monitors: many(monitors),
  aiLogs: many(aiLogs),
  usage: many(usage),
  webhooks: many(webhooks),
  apiKeys: many(apiKeys),
  notifications: many(notifications),
  detectionKeywords: many(userDetectionKeywords),
  bookmarkCollections: many(bookmarkCollections),
  bookmarks: many(bookmarks),
  aiVisibilityChecks: many(aiVisibilityChecks),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const audiencesRelations = relations(audiences, ({ one, many }) => ({
  user: one(users, {
    fields: [audiences.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [audiences.workspaceId],
    references: [workspaces.id],
  }),
  communities: many(communities),
  monitors: many(monitors),
  audienceMonitors: many(audienceMonitors),
}));

export const audienceMonitorsRelations = relations(audienceMonitors, ({ one }) => ({
  audience: one(audiences, {
    fields: [audienceMonitors.audienceId],
    references: [audiences.id],
  }),
  monitor: one(monitors, {
    fields: [audienceMonitors.monitorId],
    references: [monitors.id],
  }),
}));

export const communitiesRelations = relations(communities, ({ one }) => ({
  audience: one(audiences, {
    fields: [communities.audienceId],
    references: [audiences.id],
  }),
}));

export const monitorsRelations = relations(monitors, ({ one, many }) => ({
  user: one(users, {
    fields: [monitors.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [monitors.workspaceId],
    references: [workspaces.id],
  }),
  audience: one(audiences, {
    fields: [monitors.audienceId],
    references: [audiences.id],
  }),
  alerts: many(alerts),
  results: many(results),
  audienceMonitors: many(audienceMonitors),
  aiVisibilityChecks: many(aiVisibilityChecks),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  monitor: one(monitors, {
    fields: [alerts.monitorId],
    references: [monitors.id],
  }),
}));

export const resultsRelations = relations(results, ({ one }) => ({
  monitor: one(monitors, {
    fields: [results.monitorId],
    references: [monitors.id],
  }),
}));

export const aiLogsRelations = relations(aiLogs, ({ one }) => ({
  user: one(users, {
    fields: [aiLogs.userId],
    references: [users.id],
  }),
}));

export const budgetAlertsRelations = relations(budgetAlerts, ({ many }) => ({
  history: many(budgetAlertHistory),
}));

export const budgetAlertHistoryRelations = relations(budgetAlertHistory, ({ one }) => ({
  alert: one(budgetAlerts, {
    fields: [budgetAlertHistory.alertId],
    references: [budgetAlerts.id],
  }),
}));

export const usageRelations = relations(usage, ({ one }) => ({
  user: one(users, {
    fields: [usage.userId],
    references: [users.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  user: one(users, {
    fields: [webhooks.userId],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  monitor: one(monitors, { fields: [notifications.monitorId], references: [monitors.id] }),
}));

// User Detection Keywords - custom keyword overrides per conversation category
// Users can customize which keywords trigger each detection category (Pro+)
export const userDetectionKeywords = pgTable("user_detection_keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // "pain_point" | "solution_request" | "advice_request" | "money_talk" | "hot_discussion"
  keywords: text("keywords").array().notNull(), // User's custom keywords for this category
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("user_detection_keywords_user_id_idx").on(table.userId),
  // DB: UNIQUE enforces one row per user+category at DB level — FIX-IDX-001
  uniqueIndex("user_detection_keywords_user_category_idx").on(table.userId, table.category),
]);

export const userDetectionKeywordsRelations = relations(userDetectionKeywords, ({ one }) => ({
  user: one(users, {
    fields: [userDetectionKeywords.userId],
    references: [users.id],
  }),
}));

// Bookmark Collections - user-created folders for organizing saved results
export const bookmarkCollections = pgTable("bookmark_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"), // Hex color for UI
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("bookmark_collections_user_id_idx").on(table.userId),
]);

// Bookmarks - link results to collections
export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  resultId: uuid("result_id")
    .notNull()
    .references(() => results.id, { onDelete: "cascade" }),
  collectionId: uuid("collection_id")
    .references(() => bookmarkCollections.id, { onDelete: "cascade" }),
  note: text("note"), // Optional note about why this was bookmarked
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("bookmarks_user_id_idx").on(table.userId),
  index("bookmarks_collection_id_idx").on(table.collectionId),
  index("bookmarks_result_id_idx").on(table.resultId),
  // DB: UNIQUE prevents duplicate bookmarks of same result by same user — FIX-IDX-002
  uniqueIndex("bookmarks_user_result_idx").on(table.userId, table.resultId),
]);

export const bookmarkCollectionsRelations = relations(bookmarkCollections, ({ one, many }) => ({
  user: one(users, {
    fields: [bookmarkCollections.userId],
    references: [users.id],
  }),
  bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  result: one(results, {
    fields: [bookmarks.resultId],
    references: [results.id],
  }),
  collection: one(bookmarkCollections, {
    fields: [bookmarks.collectionId],
    references: [bookmarkCollections.id],
  }),
}));

// SECURITY (SEC-INTEG-008): Webhook event deduplication table for idempotency
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  provider: text("provider").notNull().default("polar"),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("webhook_events_event_id_provider_idx").on(table.eventId, table.provider),
]);

// Shared Reports - public shareable report links for stakeholders
export const sharedReports = pgTable("shared_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "cascade" }),
  shareToken: text("share_token").notNull().unique(), // Random token for public URL
  title: text("title").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  reportData: jsonb("report_data").$type<Record<string, unknown>>().notNull(), // Snapshot of report data
  expiresAt: timestamp("expires_at"), // Optional expiry
  isActive: boolean("is_active").default(true).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("shared_reports_user_id_idx").on(table.userId),
  index("shared_reports_share_token_idx").on(table.shareToken),
  index("shared_reports_monitor_id_idx").on(table.monitorId),
]);

export const sharedReportsRelations = relations(sharedReports, ({ one }) => ({
  user: one(users, {
    fields: [sharedReports.userId],
    references: [users.id],
  }),
  monitor: one(monitors, {
    fields: [sharedReports.monitorId],
    references: [monitors.id],
  }),
}));

// Email delivery failure tracking — no silent failures
export const emailDeliveryFailures = pgTable("email_delivery_failures", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  emailType: text("email_type").notNull(), // 'alert' | 'digest' | 'report' | 'onboarding' | 'budget' | 'subscription'
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  errorMessage: text("error_message").notNull(),
  errorCode: text("error_code"), // HTTP status or Resend error code
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  nextRetryAt: timestamp("next_retry_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("email_failures_user_id_idx").on(table.userId),
  index("email_failures_unresolved_idx").on(table.resolvedAt, table.nextRetryAt),
]);

// AI Visibility Checks - track brand mentions in AI/LLM responses (Team tier)
export const aiVisibilityChecks = pgTable("ai_visibility_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "cascade" }),
  brandName: text("brand_name").notNull(),
  model: text("model").notNull(),
  query: text("query").notNull(),
  mentioned: boolean("mentioned").notNull(),
  position: text("position"), // "primary" | "secondary" | "not_found"
  context: text("context"),
  competitors: jsonb("competitors").$type<string[]>(),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
  // Soft-delete marker for tier-keyed retention (90d free / 1y pro / 2y team, then 30d grace)
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("ai_visibility_checks_user_id_idx").on(table.userId),
  index("ai_visibility_checks_monitor_id_idx").on(table.monitorId),
  index("ai_visibility_checks_checked_at_idx").on(table.checkedAt),
  index("ai_visibility_checks_user_checked_idx").on(table.userId, table.checkedAt),
]);

export const aiVisibilityChecksRelations = relations(aiVisibilityChecks, ({ one }) => ({
  user: one(users, {
    fields: [aiVisibilityChecks.userId],
    references: [users.id],
  }),
  monitor: one(monitors, {
    fields: [aiVisibilityChecks.monitorId],
    references: [monitors.id],
  }),
}));

// Chat Conversations - persistent AI chat history
export const chatConversations = pgTable("chat_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("chat_conversations_user_id_idx").on(table.userId),
  index("chat_conversations_updated_at_idx").on(table.updatedAt),
]);

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

// Chat Messages - individual messages within a conversation
export const chatMessageRoleEnum = pgEnum("chat_message_role", ["user", "assistant"]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: chatMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations").$type<{
    id: string;
    title: string;
    platform: string;
    sourceUrl: string;
    snippet: string;
    monitorName?: string;
  }[]>(),
  toolsUsed: jsonb("tools_used").$type<{ name: string; label: string }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Soft-delete marker for retention (1y soft-delete, 2y hard-delete)
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("chat_messages_conversation_id_idx").on(table.conversationId),
  index("chat_messages_created_at_idx").on(table.createdAt),
]);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

// ---------------------------------------------------------------------------
// Task 2.1 Phase A — cross-monitor result dedup (join table).
//
// Before this table, `results` was keyed 1:1 with a monitor, so if two of a
// user's monitors matched the same Reddit post we'd write two rows and run AI
// twice. `monitor_results` is a many-to-many join that lets a single canonical
// `results` row be linked to every monitor that matched it, keyed by the
// ingest-layer dedup tuple `(userId, sourceUrl)`.
//
// Phase A keeps `results.monitor_id` for read-path backward compatibility
// (dashboards, digests, alerts still filter by it). Phase B will drop that
// column and migrate readers through this join table.
// ---------------------------------------------------------------------------
export const monitorResults = pgTable("monitor_results", {
  monitorId: uuid("monitor_id").notNull().references(() => monitors.id, { onDelete: "cascade" }),
  resultId: uuid("result_id").notNull().references(() => results.id, { onDelete: "cascade" }),
  matchedAt: timestamp("matched_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.monitorId, table.resultId] }),
  index("monitor_results_monitor_idx").on(table.monitorId),
  index("monitor_results_result_idx").on(table.resultId),
]);

export const monitorResultsRelations = relations(monitorResults, ({ one }) => ({
  monitor: one(monitors, {
    fields: [monitorResults.monitorId],
    references: [monitors.id],
  }),
  result: one(results, {
    fields: [monitorResults.resultId],
    references: [results.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Audience = typeof audiences.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
export type Result = typeof results.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserDetectionKeyword = typeof userDetectionKeywords.$inferSelect;
export type BookmarkCollection = typeof bookmarkCollections.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type EmailDeliveryFailure = typeof emailDeliveryFailures.$inferSelect;
export type SharedReport = typeof sharedReports.$inferSelect;
export type AIVisibilityCheck = typeof aiVisibilityChecks.$inferSelect;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type MonitorResult = typeof monitorResults.$inferSelect;
export type NewMonitorResult = typeof monitorResults.$inferInsert;

// Task 2.2: Saved Views - persist filter combinations on the Results page so
// users can recall triage contexts (e.g. "Hot pain points", "Unread saved")
// in one click instead of re-applying 3-5 filter chips per visit.
export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull().$type<{
    categoryFilter?: string | null;
    sentimentFilter?: string | null;
    platformFilter?: string | null;
    statusFilter?: "all" | "unread" | "saved" | "hidden";
    leadScoreMin?: number | null;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("saved_views_user_idx").on(table.userId),
]);

export type SavedView = typeof savedViews.$inferSelect;
export type NewSavedView = typeof savedViews.$inferInsert;

// ---------------------------------------------------------------------------
// Task DL.2 Phase 1 — extract aiAnalysis JSONB out of the hot `results` table.
//
// `results.aiAnalysis` holds 2-5KB of JSON per row. At 10M rows that's
// 20-50GB of analysis JSON bloating the row cache and slowing every
// sequential/index scan of `results`, even when queries never touch the
// analysis column. Extracting it into a sibling 1:1 table cuts the working
// set of `results` scans by 30-50%.
//
// Phase 1 (this table, additive): writers dual-write to both columns.
// Phase 2 (future PR): one-shot backfill copies legacy rows.
// Phase 3 (future PR): drop `results.aiAnalysis`.
// ---------------------------------------------------------------------------
export const resultAnalyses = pgTable("result_analyses", {
  resultId: uuid("result_id")
    .primaryKey()
    .references(() => results.id, { onDelete: "cascade" }),
  analysis: jsonb("analysis").notNull(),
  // "pro" | "team" | "batch" — mirrors the tier field inside the analysis JSON.
  // Column-level so we can filter analyses by tier without deserializing JSON
  // (e.g. "find all team-tier analyses in the last hour").
  tier: text("tier").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const resultAnalysesRelations = relations(resultAnalyses, ({ one }) => ({
  result: one(results, {
    fields: [resultAnalyses.resultId],
    references: [results.id],
  }),
}));

export type ResultAnalysis = typeof resultAnalyses.$inferSelect;
export type NewResultAnalysis = typeof resultAnalyses.$inferInsert;
