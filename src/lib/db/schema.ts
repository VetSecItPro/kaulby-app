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
  "devto",
  // "twitter" - DEPRECATED: removed from active platforms, kept in DB enum for historical data
  "googlereviews",
  "trustpilot",
  "appstore",
  "playstore",
  "quora",
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
]);

export const sentimentEnum = pgEnum("sentiment", [
  "positive",
  "negative",
  "neutral",
]);

export const painPointCategoryEnum = pgEnum("pain_point_category", [
  "pain_point",
  "solution_request",
  "question",
  "feature_request",
  "praise",
  "discussion",
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
  // Workspace membership (Enterprise feature)
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  workspaceRole: workspaceRoleEnum("workspace_role"),
  // Stripe/subscription fields
  stripeCustomerId: text("stripe_customer_id").unique(),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("free").notNull(),
  subscriptionId: text("subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audiences - collections of communities to monitor
export const audiences = pgTable("audiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  keywords: text("keywords").array().notNull(),
  filters: jsonb("filters"), // pain_point, solution_requests, etc.
  platforms: platformEnum("platforms").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  newMatchCount: integer("new_match_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("monitors_user_id_idx").on(table.userId),
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
  aiSummary: text("ai_summary"),
  metadata: jsonb("metadata"),
  // User interaction tracking
  isViewed: boolean("is_viewed").default(false).notNull(),
  viewedAt: timestamp("viewed_at"),
  isClicked: boolean("is_clicked").default(false).notNull(),
  clickedAt: timestamp("clicked_at"),
  isSaved: boolean("is_saved").default(false).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("results_monitor_id_idx").on(table.monitorId),
  index("results_created_at_idx").on(table.createdAt),
  index("results_platform_idx").on(table.platform),
  index("results_sentiment_idx").on(table.sentiment),
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

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(users),
  invites: many(workspaceInvites),
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
}));

export const audiencesRelations = relations(audiences, ({ one, many }) => ({
  user: one(users, {
    fields: [audiences.userId],
    references: [users.id],
  }),
  communities: many(communities),
  monitors: many(monitors),
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
  audience: one(audiences, {
    fields: [monitors.audienceId],
    references: [audiences.id],
  }),
  alerts: many(alerts),
  results: many(results),
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
