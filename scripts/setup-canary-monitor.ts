#!/usr/bin/env tsx
/**
 * Idempotent setup for the AI quality canary monitor.
 *
 * Creates (or re-activates) the dedicated canary monitor that the 6-hour
 * Inngest cron (src/lib/inngest/functions/ai-quality-canary.ts) uses to
 * probe the analyze-content pipeline.
 *
 * Keyword choice: "inngest" is deliberate — high-volume on GitHub + HN,
 * consistent weekly volume, and not a Kaulby-branded term so it doesn't
 * pollute the user's actual monitoring data. Each run produces ~20-60
 * fresh summaries, which is a large-enough sample for persona-rate probes.
 *
 * Run with:
 *   pnpm tsx scripts/setup-canary-monitor.ts
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { users, monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CANARY_NAME = "[CANARY] AI quality — inngest";
const CANARY_KEYWORDS = ["inngest", "inngest.com"];
const CANARY_PLATFORMS = ["github", "hackernews"] as const;

async function main() {
  console.log("🐤 Setting up AI quality canary monitor...\n");

  const admin = await db.query.users.findFirst({
    where: eq(users.isAdmin, true),
    columns: { id: true, email: true },
  });
  if (!admin) {
    console.error("❌ No admin user found. Mark a user with isAdmin=true first.");
    process.exit(1);
  }
  console.log(`👤 Admin: ${admin.email} (${admin.id})`);

  const existing = await db.query.monitors.findFirst({
    where: and(eq(monitors.userId, admin.id), eq(monitors.name, CANARY_NAME)),
  });

  if (existing) {
    if (!existing.isActive) {
      await db.update(monitors).set({ isActive: true }).where(eq(monitors.id, existing.id));
      console.log(`♻️  Re-activated existing canary monitor: ${existing.id}`);
    } else {
      console.log(`✅ Canary monitor already active: ${existing.id}`);
    }
    console.log(`   Name: ${CANARY_NAME}`);
    console.log(`   Keywords: ${JSON.stringify(existing.keywords)}`);
    console.log(`   Platforms: ${JSON.stringify(existing.platforms)}`);
    return;
  }

  const [created] = await db
    .insert(monitors)
    .values({
      userId: admin.id,
      name: CANARY_NAME,
      companyName: "Inngest (canary target)",
      keywords: CANARY_KEYWORDS,
      platforms: [...CANARY_PLATFORMS],
      isActive: true,
    })
    .returning({ id: monitors.id });

  console.log(`✅ Created canary monitor: ${created.id}`);
  console.log(`   Name: ${CANARY_NAME}`);
  console.log(`   Keywords: ${JSON.stringify(CANARY_KEYWORDS)}`);
  console.log(`   Platforms: ${JSON.stringify(CANARY_PLATFORMS)}`);
  console.log(`\n🕒 Next canary run: on the next 6-hour mark (00:00, 06:00, 12:00, 18:00 UTC)`);
  console.log(`   Trigger manually: send a monitor/scan-now event from Inngest dashboard`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Canary setup failed:", err);
    process.exit(1);
  });
