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
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "free",
  "pro",
  "enterprise",
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
  ownerId: text("owner_id").notNull(), // Clerk user ID of workspace owner
  seatLimit: integer("seat_limit").default(5).notNull(),
  seatCount: integer("seat_count").default(1).notNull(), // Current number of members
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  // Scheduled PDF Reports (Team tier feature)
  reportSchedule: text("report_schedule").default("off"), // 'off' | 'weekly' | 'monthly'
  reportDay: integer("report_day").default(1), // Day of week (1=Mon) for weekly, day of month for monthly
  reportLastSentAt: timestamp("report_last_sent_at"), // Track last report sent to prevent duplicates
  // Email digest pause feature
  digestPaused: boolean("digest_paused").default(false).notNull(), // Pause emails while keeping monitors active
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
});

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
  companyName: text("company_name"), // DB: Should be NOT NULL — requires migration — FIX-106
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
  filters: jsonb("filters"), // pain_point, solution_requests, etc.
  platforms: platformEnum("platforms").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  newMatchCount: integer("new_match_count").default(0).notNull(),
  // Manual scan tracking
  lastManualScanAt: timestamp("last_manual_scan_at"), // When the user last triggered a manual scan
  isScanning: boolean("is_scanning").default(false).notNull(), // Whether a scan is currently in progress
  // Batch AI analysis - for cost-efficient analysis of large volumes (>50 results)
  batchAnalysis: jsonb("batch_analysis"), // Stores BatchSummaryResult from batch-summary.ts
  lastBatchAnalyzedAt: timestamp("last_batch_analyzed_at"), // When batch analysis was last run
  // Monitor scheduling - set active hours for monitoring
  scheduleEnabled: boolean("schedule_enabled").default(false).notNull(),
  scheduleStartHour: integer("schedule_start_hour").default(9), // DB: Valid range 0-23 — FIX-107
  scheduleEndHour: integer("schedule_end_hour").default(17), // 0-23, default 5 PM
  scheduleDays: integer("schedule_days").array(), // 0=Sun, 1=Mon, ..., 6=Sat. null = all days
  scheduleTimezone: text("schedule_timezone").default("America/New_York"), // IANA timezone
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("monitors_user_id_idx").on(table.userId),
  index("monitors_workspace_id_idx").on(table.workspaceId),
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
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("results_monitor_id_idx").on(table.monitorId),
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
  // DB: Indexes for dashboard queries filtering by view/hide state — FIX-005
  index("results_is_viewed_idx").on(table.isViewed),
  index("results_viewed_hidden_idx").on(table.isViewed, table.isHidden),
  // DB: Composite index for high-intent lead queries — FIX-020
  index("results_lead_score_viewed_hidden_idx").on(table.leadScore, table.isViewed, table.isHidden),
  // DB: Dashboard query optimization — FIX-113
  index("results_hidden_created_idx").on(table.isHidden, table.createdAt),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ai_logs_user_id_idx").on(table.userId),
  index("ai_logs_created_at_idx").on(table.createdAt),
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
  index("usage_user_id_period_idx").on(table.userId, table.periodStart),
]);

// Webhook status enum
export const webhookStatusEnum = pgEnum("webhook_status", [
  "pending",
  "success",
  "failed",
  "retrying",
]);

// Webhooks - custom webhook endpoints for enterprise users
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
});

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
});

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
}, (table) => [
  index("email_events_user_id_idx").on(table.userId),
  index("email_events_email_id_idx").on(table.emailId),
  index("email_events_email_type_idx").on(table.emailType),
  // DB: Dedup optimization — FIX-118
  index("email_events_dedup_idx").on(table.emailId, table.eventType),
]);

// Notifications - in-app notification center
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // "alert" | "crisis" | "system"
  monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "set null" }),
  resultId: uuid("result_id"),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.isRead),
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
  // Ensure one row per user+category
  index("user_detection_keywords_user_category_idx").on(table.userId, table.category),
]);

export const userDetectionKeywordsRelations = relations(userDetectionKeywords, ({ one }) => ({
  user: one(users, {
    fields: [userDetectionKeywords.userId],
    references: [users.id],
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
