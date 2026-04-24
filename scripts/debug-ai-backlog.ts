#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results, monitors, aiLogs } from "@/lib/db/schema";
import { sql, gte, and, eq, isNull, isNotNull, like } from "drizzle-orm";

async function main() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const total = await db
    .select({ c: sql<number>`count(*)` })
    .from(results)
    .where(gte(results.createdAt, thirtyMinAgo));

  const withAi = await db
    .select({ c: sql<number>`count(*)` })
    .from(results)
    .where(and(gte(results.createdAt, thirtyMinAgo), isNotNull(results.aiSummary)));

  const aiAnalyzedFlag = await db
    .select({ c: sql<number>`count(*)` })
    .from(results)
    .where(and(gte(results.createdAt, thirtyMinAgo), eq(results.aiAnalyzed, true)));

  const aiFailed = await db
    .select({ c: sql<number>`count(*)` })
    .from(results)
    .where(and(gte(results.createdAt, thirtyMinAgo), eq(results.aiAnalyzed, false)));

  const aiPending = await db
    .select({ c: sql<number>`count(*)` })
    .from(results)
    .where(and(gte(results.createdAt, thirtyMinAgo), isNull(results.aiAnalyzed)));

  const logs = await db
    .select({ c: sql<number>`count(*)` })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, thirtyMinAgo));

  console.log("results last 30min:");
  console.log("  total:           ", total[0].c);
  console.log("  aiSummary != null:", withAi[0].c);
  console.log("  aiAnalyzed=true: ", aiAnalyzedFlag[0].c);
  console.log("  aiAnalyzed=false:", aiFailed[0].c);
  console.log("  aiAnalyzed=null: ", aiPending[0].c);
  console.log("aiLogs last 30min: ", logs[0].c);

  // Sample recent aiLogs with platform + analysisType
  const recent = await db.execute(sql`
    select platform, analysis_type, count(*) as c
    from ai_logs
    where created_at > ${thirtyMinAgo}
    group by platform, analysis_type
    order by c desc
  `);
  console.log("\naiLogs breakdown (last 30min):");
  for (const r of recent.rows) {
    console.log(`  platform=${r.platform} type=${r.analysis_type} → ${r.c}`);
  }

  // Check results that were inserted but never got aiSummary
  const stale = await db.execute(sql`
    select platform, count(*) as c
    from results
    where created_at > ${thirtyMinAgo}
      and ai_summary is null
    group by platform
    order by c desc
  `);
  console.log("\nresults needing AI (no aiSummary):");
  for (const r of stale.rows) {
    console.log(`  ${r.platform}: ${r.c}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
