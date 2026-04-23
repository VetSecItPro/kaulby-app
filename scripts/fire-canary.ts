#!/usr/bin/env tsx
/**
 * Manually trigger the AI quality canary without waiting for the 6h cron tick.
 *
 * Uses Inngest's event API (inn.gs/e/$KEY) to send a `canary/fire-now` event.
 * The canary function accepts both cron and event triggers (see
 * src/lib/inngest/functions/ai-quality-canary.ts).
 *
 * Useful for:
 * - Validating a new baseline.json threshold locally before shipping
 * - Checking health after a deploy without waiting for the next tick
 * - Debugging why a prior tick showed hard-floor violations
 *
 * Run:
 *   pnpm tsx scripts/fire-canary.ts
 *
 * Watch result:
 *   Check PostHog for `ai_quality_check` event (distinct_id = canary user ID)
 *   OR check Inngest dashboard → Functions → ai-quality-canary → Runs
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const EVENT_KEY = process.env.INNGEST_EVENT_KEY;
if (!EVENT_KEY) {
  console.error("❌ INNGEST_EVENT_KEY missing from env");
  process.exit(1);
}

async function main() {
  const response = await fetch(`https://inn.gs/e/${EVENT_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "canary/fire-now",
      data: { manual: true, firedAt: new Date().toISOString() },
    }),
  });

  if (!response.ok) {
    console.error(`❌ Event fire failed: ${response.status} ${await response.text()}`);
    process.exit(1);
  }

  const { ids } = await response.json();
  console.log(`✅ canary/fire-now event sent: ${ids[0]}`);
  console.log(`   Watch: https://app.inngest.com/env/production/functions/ai-quality-canary`);
  console.log(`   Results land in PostHog ai_quality_check event within ~4 min`);
}

main().catch((err) => {
  console.error("❌ fire-canary failed:", err);
  process.exit(1);
});
