CREATE TABLE IF NOT EXISTS "daily_metrics" (
	"date" text NOT NULL,
	"metric_key" text NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"value" real NOT NULL,
	"metadata" jsonb,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_metrics_pk_idx" ON "daily_metrics" ("date","metric_key","dimensions");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_metrics_lookup_idx" ON "daily_metrics" ("metric_key","date");
