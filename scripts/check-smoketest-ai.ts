#!/usr/bin/env tsx
/**
 * Diagnostic for the W3.7 smoke test — checks why AI analysis didn't land on
 * the smoke-test monitor's results. Re-poll first; then look at aiLogs to
 * see if analyses were attempted at all.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results, aiLogs, monitors } from "@/lib/db/schema";
import { eq, and, gte, desc, inArray } from "drizzle-orm";

const MONITOR_ID = process.argv[2] || "4d806edf-1cc3-421f-97cf-d97efb809a28";

async function main() {
  console.log(`🔍 Diagnosing AI flow for monitor ${MONITOR_ID}\n`);

  // 1. Re-fetch results
  const rows = await db
    .select({
      id: results.id,
      title: results.title,
      aiSummary: results.aiSummary,
      sentiment: results.sentiment,
      aiAnalyzed: results.aiAnalyzed,
      createdAt: results.createdAt,
    })
    .from(results)
    .where(eq(results.monitorId, MONITOR_ID))
    .orderBy(desc(results.createdAt))
    .limit(20);

  console.log(`📦 Results: ${rows.length}`);
  if (rows.length === 0) {
    console.log("   ⚠️  No results — monitor may have been deleted");
    return;
  }

  const withAi = rows.filter((r) => r.aiSummary && r.aiSummary.length > 20);
  const aiAnalyzedTrue = rows.filter((r) => r.aiAnalyzed === true);
  const aiAnalyzedFalse = rows.filter((r) => r.aiAnalyzed === false);
  const aiAnalyzedNull = rows.filter((r) => r.aiAnalyzed === null);
  console.log(`   With aiSummary populated: ${withAi.length}`);
  console.log(`   aiAnalyzed=true: ${aiAnalyzedTrue.length}`);
  console.log(`   aiAnalyzed=false (failed): ${aiAnalyzedFalse.length}`);
  console.log(`   aiAnalyzed=null (not yet processed): ${aiAnalyzedNull.length}`);

  // 2. Check aiLogs for these result IDs
  const resultIds = rows.map((r) => r.id);
  const logs = await db
    .select({
      resultId: aiLogs.resultId,
      analysisType: aiLogs.analysisType,
      model: aiLogs.model,
      costUsd: aiLogs.costUsd,
      latencyMs: aiLogs.latencyMs,
      cacheHit: aiLogs.cacheHit,
      createdAt: aiLogs.createdAt,
    })
    .from(aiLogs)
    .where(inArray(aiLogs.resultId, resultIds))
    .orderBy(desc(aiLogs.createdAt))
    .limit(50);

  console.log(`\n🤖 AI logs for these results: ${logs.length}`);
  if (logs.length === 0) {
    console.log("   🚨 ZERO AI logs — analyze-content function never ran for these results");
    console.log("   Check: Inngest dashboard for content/analyze events");
  } else {
    const byType: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let cacheHits = 0;
    let totalCost = 0;
    for (const l of logs) {
      byType[l.analysisType || "unknown"] = (byType[l.analysisType || "unknown"] || 0) + 1;
      byModel[l.model] = (byModel[l.model] || 0) + 1;
      if (l.cacheHit) cacheHits++;
      totalCost += l.costUsd || 0;
    }
    console.log(`   Analysis types: ${Object.entries(byType).map(([k,v]) => `${k}=${v}`).join(", ")}`);
    console.log(`   Models: ${Object.entries(byModel).map(([k,v]) => `${k.split("/").pop()}=${v}`).join(", ")}`);
    console.log(`   Cache hits: ${cacheHits}/${logs.length}`);
    console.log(`   Total cost: $${totalCost.toFixed(6)}`);
  }

  // 3. Show 1 sample result for context
  if (rows[0]) {
    const r = rows[0];
    console.log(`\n📝 Most recent result:`);
    console.log(`   id: ${r.id}`);
    console.log(`   title: ${r.title?.slice(0, 100)}`);
    console.log(`   aiAnalyzed: ${r.aiAnalyzed}`);
    console.log(`   aiSummary: ${r.aiSummary?.slice(0, 200) || "(empty)"}`);
    console.log(`   sentiment: ${r.sentiment}`);
    console.log(`   createdAt: ${r.createdAt?.toISOString()}`);
  }

  // 4. Check the monitor itself
  const m = await db.query.monitors.findFirst({ where: eq(monitors.id, MONITOR_ID) });
  if (m) {
    console.log(`\n🎯 Monitor:`);
    console.log(`   userId: ${m.userId}`);
    console.log(`   isActive: ${m.isActive}`);
    console.log(`   newMatchCount: ${m.newMatchCount}`);
    console.log(`   lastCheckedAt: ${m.lastCheckedAt?.toISOString()}`);
    console.log(`   lastCheckFailedAt: ${m.lastCheckFailedAt?.toISOString() || "(none)"}`);
    console.log(`   lastCheckFailedReason: ${m.lastCheckFailedReason || "(none)"}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
