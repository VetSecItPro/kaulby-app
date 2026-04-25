CREATE TABLE IF NOT EXISTS "vendor_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor" text NOT NULL,
	"metric" text NOT NULL,
	"value" real,
	"metadata" jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_metrics_lookup_idx" ON "vendor_metrics" ("vendor","metric","recorded_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_metrics_recorded_at_idx" ON "vendor_metrics" ("recorded_at");
