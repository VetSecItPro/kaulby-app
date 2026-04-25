#!/usr/bin/env tsx
/**
 * Per-platform result-volume audit. Helps triage Task #61 — which
 * platforms are actually broken vs which just have low traffic.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const r = await db.execute<{
    platform: string;
    total: number;
    last_7d: number;
    last_24h: number;
    last_seen: Date | null;
  }>(sql`
    SELECT
      platform,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7d,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
      MAX(created_at) AS last_seen
    FROM results
    GROUP BY platform
    ORDER BY total DESC
  `);

  console.log("platform     | total | 7d   | 24h  | last_seen");
  console.log("-------------+-------+------+------+----------");
  for (const row of r.rows) {
    const last = row.last_seen ? new Date(row.last_seen as Date).toISOString().slice(0, 16) : "(never)";
    console.log(
      String(row.platform).padEnd(12),
      "|",
      String(row.total).padStart(5),
      "|",
      String(row.last_7d).padStart(4),
      "|",
      String(row.last_24h).padStart(4),
      "|",
      last,
    );
  }

  // Highlight candidates: platforms with 0 in last 24h but historical data
  console.log("\nLikely broken (0 in last 24h, has historical data):");
  for (const row of r.rows) {
    if (Number(row.last_24h) === 0 && Number(row.total) > 0) {
      console.log("  -", row.platform, `(${row.last_7d} in last 7d, last seen ${row.last_seen})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
