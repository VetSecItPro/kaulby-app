CREATE TYPE "public"."alert_channel" AS ENUM('email', 'slack', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."alert_frequency" AS ENUM('instant', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."conversation_category" AS ENUM('pain_point', 'solution_request', 'advice_request', 'money_talk', 'hot_discussion');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."monitor_type" AS ENUM('keyword', 'ai_discovery');--> statement-breakpoint
CREATE TYPE "public"."pain_point_category" AS ENUM('competitor_mention', 'pricing_concern', 'feature_request', 'support_need', 'negative_experience', 'positive_feedback', 'general_discussion');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('reddit', 'hackernews', 'producthunt', 'devto', 'googlereviews', 'trustpilot', 'appstore', 'playstore', 'quora');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'negative', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."timezone" AS ENUM('America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('pending', 'success', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "ai_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"model" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_usd" real,
	"latency_ms" integer,
	"trace_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"channel" "alert_channel" NOT NULL,
	"frequency" "alert_frequency" NOT NULL,
	"destination" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"daily_request_count" integer DEFAULT 0 NOT NULL,
	"daily_request_reset_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audience_monitors" (
	"audience_id" uuid NOT NULL,
	"monitor_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"identifier" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_platform_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"topic" text NOT NULL,
	"keywords" text[] NOT NULL,
	"platforms_found" "platform"[] NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"sentiment_summary" jsonb,
	"trend_direction" text,
	"peak_date" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"audience_id" uuid,
	"name" text NOT NULL,
	"company_name" text,
	"keywords" text[] NOT NULL,
	"monitor_type" "monitor_type" DEFAULT 'keyword' NOT NULL,
	"discovery_prompt" text,
	"search_query" text,
	"platform_urls" jsonb,
	"filters" jsonb,
	"platforms" "platform"[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp,
	"new_match_count" integer DEFAULT 0 NOT NULL,
	"last_manual_scan_at" timestamp,
	"is_scanning" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"author" text,
	"posted_at" timestamp,
	"sentiment" "sentiment",
	"sentiment_score" real,
	"pain_point_category" "pain_point_category",
	"conversation_category" "conversation_category",
	"conversation_category_confidence" real,
	"engagement_score" integer,
	"ai_summary" text,
	"last_sent_in_digest_at" timestamp,
	"ai_analysis" jsonb,
	"metadata" jsonb,
	"is_viewed" boolean DEFAULT false NOT NULL,
	"viewed_at" timestamp,
	"is_clicked" boolean DEFAULT false NOT NULL,
	"clicked_at" timestamp,
	"is_saved" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text,
	"access_token" text NOT NULL,
	"webhook_url" text,
	"channel_id" text,
	"channel_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_results" (
	"topic_id" uuid NOT NULL,
	"result_id" uuid NOT NULL,
	"relevance_score" real,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"ai_calls_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"timezone" timezone DEFAULT 'America/New_York' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp,
	"ban_reason" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"workspace_id" uuid,
	"workspace_role" "workspace_role",
	"stripe_customer_id" text,
	"subscription_status" "subscription_status" DEFAULT 'free' NOT NULL,
	"subscription_id" text,
	"polar_customer_id" text,
	"polar_subscription_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"is_founding_member" boolean DEFAULT false NOT NULL,
	"founding_member_number" integer,
	"founding_member_price_id" text,
	"day_pass_expires_at" timestamp,
	"day_pass_purchase_count" integer DEFAULT 0 NOT NULL,
	"last_day_pass_purchased_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_polar_customer_id_unique" UNIQUE("polar_customer_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_status" DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"response_body" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"events" jsonb DEFAULT '["new_result"]'::jsonb,
	"headers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by" text NOT NULL,
	"token" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"seat_limit" integer DEFAULT 5 NOT NULL,
	"seat_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_monitors" ADD CONSTRAINT "audience_monitors_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_monitors" ADD CONSTRAINT "audience_monitors_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_platform_topics" ADD CONSTRAINT "cross_platform_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_audience_id_audiences_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audiences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_integrations" ADD CONSTRAINT "slack_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_results" ADD CONSTRAINT "topic_results_topic_id_cross_platform_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."cross_platform_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_results" ADD CONSTRAINT "topic_results_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_logs_user_id_idx" ON "ai_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_logs_created_at_idx" ON "ai_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "audience_monitors_audience_idx" ON "audience_monitors" USING btree ("audience_id");--> statement-breakpoint
CREATE INDEX "audience_monitors_monitor_idx" ON "audience_monitors" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "audiences_user_id_idx" ON "audiences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cross_platform_topics_user_id_idx" ON "cross_platform_topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cross_platform_topics_is_active_idx" ON "cross_platform_topics" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "monitors_user_id_idx" ON "monitors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "monitors_is_active_idx" ON "monitors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "results_monitor_id_idx" ON "results" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "results_created_at_idx" ON "results" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "results_platform_idx" ON "results" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "results_sentiment_idx" ON "results" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "results_conversation_category_idx" ON "results" USING btree ("conversation_category");--> statement-breakpoint
CREATE INDEX "topic_results_topic_idx" ON "topic_results" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_results_result_idx" ON "topic_results" USING btree ("result_id");