#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { and, eq, desc, like, sql } from "drizzle-orm";

async function main() {
  // Find most recent test monitors (even if deactivated)
  const testMons = await db
    .select({ id: monitors.id, name: monitors.name, keywords: monitors.keywords, companyName: monitors.companyName, lastCheckedAt: monitors.lastCheckedAt, isActive: monitors.isActive, createdAt: monitors.createdAt })
    .from(monitors)
    .where(like(monitors.name, "[PLATFORM-TEST]%"))
    .orderBy(desc(monitors.createdAt))
    .limit(15);

  console.log("recent test monitors:");
  for (const m of testMons) {
    const rowCounts = await db
      .select({ p: results.platform, c: sql`count(*)`.as("c") })
      .from(results)
      .where(eq(results.monitorId, m.id))
      .groupBy(results.platform);
    const summary = rowCounts.map((r) => `${r.p}=${r.c}`).join(" ");
    console.log(
      `${m.isActive ? "A" : "-"} ${m.createdAt?.toISOString()} ${m.name.padEnd(45)} | lastCheck=${m.lastCheckedAt?.toISOString() || "never"}`,
    );
    console.log(`  results: ${summary || "(none)"}`);
    console.log(`  keywords: ${JSON.stringify(m.keywords)} company: ${m.companyName}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
