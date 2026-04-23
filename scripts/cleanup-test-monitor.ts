#!/usr/bin/env tsx
/**
 * One-shot cleanup for any [SMOKE TEST] monitor that's still active.
 * Run after running smoketest-monitor.ts --keep.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { and, eq, like } from "drizzle-orm";

async function main() {
  const active = await db
    .select({ id: monitors.id, name: monitors.name })
    .from(monitors)
    .where(and(eq(monitors.isActive, true), like(monitors.name, "%SMOKE TEST%")));

  if (active.length === 0) {
    console.log("No active smoke-test monitors. Nothing to clean.");
    return;
  }

  for (const m of active) {
    await db
      .update(monitors)
      .set({
        isActive: false,
        name: m.name.replace(/^\[SMOKE TEST\]/, "[SMOKE TEST - ARCHIVED]"),
      })
      .where(eq(monitors.id, m.id));
    console.log(`✅ Deactivated: ${m.id} (${m.name})`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
}).finally(() => process.exit(0));
