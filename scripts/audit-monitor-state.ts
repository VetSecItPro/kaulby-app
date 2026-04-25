#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  // Per-platform monitor health: how many monitors exist, when last checked, last failure
  const r = await db.execute<{
    platform: string;
    monitors: number;
    last_check_max: Date | null;
    last_failed_max: Date | null;
    failed_recent: number;
  }>(sql`
    SELECT
      UNNEST(platforms) AS platform,
      COUNT(*) AS monitors,
      MAX(last_checked_at) AS last_check_max,
      MAX(last_check_failed_at) AS last_failed_max,
      COUNT(*) FILTER (WHERE last_check_failed_at > NOW() - INTERVAL '24 hours') AS failed_recent
    FROM monitors
    GROUP BY 1
    ORDER BY 1
  `);

  console.log("platform     | mons | last_check         | last_fail          | failed_24h");
  console.log("-------------+------+--------------------+--------------------+----------");
  for (const row of r.rows) {
    const lc = row.last_check_max ? new Date(row.last_check_max as Date).toISOString().slice(0, 16) : "(never)";
    const lf = row.last_failed_max ? new Date(row.last_failed_max as Date).toISOString().slice(0, 16) : "(never)";
    console.log(
      String(row.platform).padEnd(12), "|",
      String(row.monitors).padStart(4), "|",
      lc.padEnd(18), "|",
      lf.padEnd(18), "|",
      String(row.failed_recent).padStart(8),
    );
  }
}

main().catch(console.error).finally(() => process.exit(0));
