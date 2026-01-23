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
  "devto", // DEPRECATED: kept for historical data, removed from active platforms
  // "twitter" - DEPRECATED: removed from active platforms, kept in DB enum for historical data
  "googlereviews",
  "trustpilot",
  "appstore",
  "playstore",
  "quora",
  "youtube",        // NEW: Video comments and discussions
  "g2",             // NEW: Software reviews
  "yelp",           // NEW: Local business reviews
  "amazonreviews",  // NEW: Product reviews
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

// IANA timezone strings for proper DST handling
export const timezoneEnum = pgEnum("timezone", [
  "America/New_York",      // Eastern
  "America/Chicago",       // Central
  "America/Denver",        // Mountain
  "America/Los_Angeles",   // Pacific
]);

// Workspace role enum
export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",   // Can manage billing, invite/remove members
  "member",  // Can view/create/edit monitors and results
]);

// Invite status enum
export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
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

// Users table - synced with Clerk
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  name: text("name"),
  timezone: timezoneEnum("timezone").default("America/New_York").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  // Onboarding tracking
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  // Workspace membership (Enterprise feature)
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  workspaceRole: workspaceRoleEnum("workspace_role"),
  // Legacy Stripe field - kept for data migration only
  stripeCustomerId: text("stripe_customer_id").unique(), // DEPRECATED: Use polarCustomerId
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("free").notNull(),
  subscriptionId: text("subscription_id"),
  // Polar.sh fields (new payment provider)
  polarCustomerId: text("polar_customer_id").unique(),
  polarSubscriptionId: text("polar_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  // Founding member tracking (first 1,000 Pro/Team subscribers)
  isFoundingMember: boolean("is_founding_member").default(false).notNull(),
  foundingMemberNumber: integer("founding_member_number"), // 1-1000
  foundingMemberPriceId: text("founding_member_price_id"), // Polar product ID they locked in
  // Day Pass - 24hr Pro access for $10
  dayPassExpiresAt: timestamp("day_pass_expires_at"), // When the day pass expires (null = no active pass)
  dayPassPurchaseCount: integer("day_pass_purchase_count").default(0).notNull(), // Track repeat buyers
  lastDayPassPurchasedAt: timestamp("last_day_pass_purchased_at"), // Last purchase timestamp
  // Account deletion - 7 day cooldown before permanent deletion
  deletionRequestedAt: timestamp("deletion_requested_at"), // When user requested deletion (null = not requested)
  // Third-party integrations (HubSpot, Salesforce, etc.)
  integrations: jsonb("integrations").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  companyName: text("company_name"), // The company/brand to monitor (required for brand monitoring)
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("monitors_user_id_idx").on(table.userId),
  index("monitors_workspace_id_idx").on(table.workspaceId),
  index("monitors_is_active_idx").on(table.isActive),
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
});

// Slack Integrations - workspace connections for alerts
export const slackIntegrations = pgTable("slack_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull(),
  workspaceName: text("workspace_name"),
  accessToken: text("access_token").notNull(),
  webhookUrl: text("webhook_url"),
  channelId: text("channel_id"),
  channelName: text("channel_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

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

// Cross-Platform Topics - detected themes appearing across multiple platforms
// Used for the Insights page to show correlated discussions
export const crossPlatformTopics = pgTable("cross_platform_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(), // The detected topic/theme (e.g., "AI coding assistants")
  keywords: text("keywords").array().notNull(), // Keywords that define this topic
  platformsFound: platformEnum("platforms_found").array().notNull(), // Which platforms this topic appears on
  resultCount: integer("result_count").default(0).notNull(), // Total results matching this topic
  sentimentSummary: jsonb("sentiment_summary").$type<{
    positive: number;
    negative: number;
    neutral: number;
  }>(), // Aggregated sentiment across all linked results
  trendDirection: text("trend_direction").$type<"rising" | "falling" | "stable">(), // Is this topic gaining traction?
  peakDate: timestamp("peak_date"), // When this topic had the most mentions
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(), // When we first detected this topic
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(), // Most recent mention
  isActive: boolean("is_active").default(true).notNull(), // Whether topic is still trending
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("cross_platform_topics_user_id_idx").on(table.userId),
  index("cross_platform_topics_is_active_idx").on(table.isActive),
]);

// Topic Results - links results to cross-platform topics
export const topicResults = pgTable("topic_results", {
  topicId: uuid("topic_id")
    .notNull()
    .references(() => crossPlatformTopics.id, { onDelete: "cascade" }),
  resultId: uuid("result_id")
    .notNull()
    .references(() => results.id, { onDelete: "cascade" }),
  relevanceScore: real("relevance_score"), // How strongly this result matches the topic (0-1)
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  index("topic_results_topic_idx").on(table.topicId),
  index("topic_results_result_idx").on(table.resultId),
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

// Author Profiles - track author influence scores (Phase 5)
// Used to identify high-impact voices and influencers
export const authorProfiles = pgTable("author_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: platformEnum("platform").notNull(),
  username: text("username").notNull(),
  karma: integer("karma"), // Platform-specific reputation score
  accountAgeDays: integer("account_age_days"),
  avgEngagement: real("avg_engagement"), // Average upvotes/comments on posts
  postCount: integer("post_count").default(0).notNull(),
  influenceScore: integer("influence_score"), // 0-100 composite score
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("author_profiles_platform_username_idx").on(table.platform, table.username),
  index("author_profiles_influence_score_idx").on(table.influenceScore),
]);

// Community Growth - track community size over time (Phase 3)
// Used for community discovery and growth rate calculations
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

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(users),
  invites: many(workspaceInvites),
  monitors: many(monitors),
  audiences: many(audiences),
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
  slackIntegrations: many(slackIntegrations),
  webhooks: many(webhooks),
  crossPlatformTopics: many(crossPlatformTopics),
  apiKeys: many(apiKeys),
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

export const resultsRelations = relations(results, ({ one, many }) => ({
  monitor: one(monitors, {
    fields: [results.monitorId],
    references: [monitors.id],
  }),
  topicResults: many(topicResults),
}));

export const crossPlatformTopicsRelations = relations(crossPlatformTopics, ({ one, many }) => ({
  user: one(users, {
    fields: [crossPlatformTopics.userId],
    references: [users.id],
  }),
  topicResults: many(topicResults),
}));

export const topicResultsRelations = relations(topicResults, ({ one }) => ({
  topic: one(crossPlatformTopics, {
    fields: [topicResults.topicId],
    references: [crossPlatformTopics.id],
  }),
  result: one(results, {
    fields: [topicResults.resultId],
    references: [results.id],
  }),
}));

export const aiLogsRelations = relations(aiLogs, ({ one }) => ({
  user: one(users, {
    fields: [aiLogs.userId],
    references: [users.id],
  }),
}));

export const usageRelations = relations(usage, ({ one }) => ({
  user: one(users, {
    fields: [usage.userId],
    references: [users.id],
  }),
}));

export const slackIntegrationsRelations = relations(slackIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [slackIntegrations.userId],
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

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Audience = typeof audiences.$inferSelect;
export type NewAudience = typeof audiences.$inferInsert;
export type AudienceMonitor = typeof audienceMonitors.$inferSelect;
export type NewAudienceMonitor = typeof audienceMonitors.$inferInsert;
export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;
export type Monitor = typeof monitors.$inferSelect;
export type NewMonitor = typeof monitors.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;
export type AiLog = typeof aiLogs.$inferSelect;
export type NewAiLog = typeof aiLogs.$inferInsert;
export type Usage = typeof usage.$inferSelect;
export type NewUsage = typeof usage.$inferInsert;
export type SlackIntegration = typeof slackIntegrations.$inferSelect;
export type NewSlackIntegration = typeof slackIntegrations.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;
export type CrossPlatformTopic = typeof crossPlatformTopics.$inferSelect;
export type NewCrossPlatformTopic = typeof crossPlatformTopics.$inferInsert;
export type TopicResult = typeof topicResults.$inferSelect;
export type NewTopicResult = typeof topicResults.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AuthorProfile = typeof authorProfiles.$inferSelect;
export type NewAuthorProfile = typeof authorProfiles.$inferInsert;
export type CommunityGrowth = typeof communityGrowth.$inferSelect;
export type NewCommunityGrowth = typeof communityGrowth.$inferInsert;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;
