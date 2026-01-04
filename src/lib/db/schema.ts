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
  "pain_anger",
  "solution_request",
  "recommendation",
  "question",
]);

// Users table - synced with Clerk
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  name: text("name"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("free").notNull(),
  subscriptionId: text("subscription_id"),
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
  filters: jsonb("filters"), // pain_anger, solution_requests, etc.
  platforms: platformEnum("platforms").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  audiences: many(audiences),
  monitors: many(monitors),
  aiLogs: many(aiLogs),
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
