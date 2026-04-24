#!/usr/bin/env tsx
/**
 * Platform Failure Diagnostic — post-hoc analysis of the integration test.
 *
 * Instead of re-running every scanner (expensive), this reads the test
 * monitors that platform-integration-test.ts just created and queries:
 *   - monitors.lastCheckedAt (was the scan even invoked?)
 *   - monitors.lastCheckFailedAt / lastCheckFailedReason (error recorded?)
 *   - results count grouped by platform for that monitor
 *   - aiLogs error rows for that monitor
 *
 * This tells us, per platform, WHERE the pipeline failed without burning
 * another $0.50-$1.00 on re-running scrapers.
 *
 * Run:
 *   pnpm tsx scripts/diagnose-platform-failures.ts
 *   pnpm tsx scripts/diagnose-platform-failures.ts --include-inactive
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { monitors, results, aiLogs } from "@/lib/db/schema";
import { eq, like, and, sql, gte, desc } from "drizzle-orm";

async function main() {
  console.log("🔬 Platform Failure Diagnostic\n");

  // Fetch all PLATFORM-TEST monitors (including deactivated)
  const testMonitors = await db
    .select()
    .from(monitors)
    .where(like(monitors.name, "[PLATFORM-TEST]%"))
    .orderBy(desc(monitors.createdAt));

  if (testMonitors.length === 0) {
    console.log("❌ No [PLATFORM-TEST] monitors found. Run scripts/platform-integration-test.ts first.");
    return;
  }

  console.log(`📋 Found ${testMonitors.length} test monitor(s) to diagnose\n`);

  for (const m of testMonitors) {
    const elapsed = m.lastCheckedAt
      ? Math.round((Date.now() - new Date(m.lastCheckedAt).getTime()) / 1000 / 60)
      : null;
    console.log(`━━━ ${m.name} ━━━`);
    console.log(`   monitorId:            ${m.id}`);
    console.log(`   platforms:            [${(m.platforms || []).join(", ")}]`);
    console.log(`   keywords:             [${(m.keywords || []).join(", ")}]`);
    console.log(`   isActive:             ${m.isActive}`);
    console.log(`   createdAt:            ${m.createdAt}`);
    console.log(`   lastCheckedAt:        ${m.lastCheckedAt ?? "(never)"}${elapsed !== null ? ` (${elapsed} min ago)` : ""}`);
    console.log(`   lastCheckFailedAt:    ${m.lastCheckFailedAt ?? "(none)"}`);
    console.log(`   lastCheckFailedReason:${m.lastCheckFailedReason ? ` ${m.lastCheckFailedReason}` : " (none)"}`);
    console.log(`   newMatchCount:        ${m.newMatchCount ?? 0}`);

    // Results grouped by platform for THIS monitor
    const byPlatform = await db
      .select({
        platform: results.platform,
        count: sql<number>`count(*)::int`.as("count"),
        withSummary: sql<number>`count(*) filter (where ${results.aiSummary} is not null)::int`.as("withSummary"),
        withAnalyzed: sql<number>`count(*) filter (where ${results.aiAnalyzed} is true)::int`.as("withAnalyzed"),
      })
      .from(results)
      .where(eq(results.monitorId, m.id))
      .groupBy(results.platform);

    if (byPlatform.length === 0) {
      console.log(`   ⚠️  NO RESULTS written to DB for any platform`);
    } else {
      console.log(`   📊 Results by platform:`);
      const coveredPlatforms = new Set(byPlatform.map((p) => p.platform));
      for (const expected of m.platforms || []) {
        const p = byPlatform.find((x) => x.platform === expected);
        if (!p) {
          console.log(`       ${expected.padEnd(16)} ❌ 0 results — scraper never wrote to DB`);
        } else {
          const analyzedPct = p.count > 0 ? Math.round((p.withAnalyzed / p.count) * 100) : 0;
          console.log(`       ${expected.padEnd(16)} ${p.count} results, ${p.withAnalyzed} AI-analyzed (${analyzedPct}%)`);
        }
      }
      for (const p of byPlatform) {
        if (!(m.platforms || []).includes(p.platform as any)) {
          console.log(`       ${p.platform.padEnd(16)} ⚠️  UNEXPECTED platform has ${p.count} results`);
        }
      }
    }

    // aiLogs entries for this monitor (even failed ones)
    const aiLogRows = await db
      .select({
        analysisType: aiLogs.analysisType,
        model: aiLogs.model,
        costUsd: aiLogs.costUsd,
        cacheHit: aiLogs.cacheHit,
        createdAt: aiLogs.createdAt,
      })
      .from(aiLogs)
      .where(
        and(
          eq(aiLogs.monitorId, m.id),
          m.createdAt ? gte(aiLogs.createdAt, m.createdAt) : undefined,
        ),
      )
      .limit(5);
    console.log(`   🤖 aiLogs rows for this monitor: ${aiLogRows.length > 0 ? aiLogRows.length : "0"}`);
    if (aiLogRows.length > 0) {
      for (const log of aiLogRows) {
        console.log(`       ${log.analysisType} / ${log.model} / cacheHit=${log.cacheHit} / cost=$${log.costUsd?.toFixed(4) ?? "0"}`);
      }
    } else {
      console.log(`       ⚠️  No aiLogs = analyze-content NEVER fired for any result from this monitor`);
    }

    console.log(``);
  }

  // Cross-monitor summary: which platforms produced results across ALL test monitors?
  console.log(`\n━━━ CROSS-MONITOR PLATFORM HEALTH (all [PLATFORM-TEST] monitors) ━━━`);
  const testMonitorIds = testMonitors.map((m) => m.id);
  const crossPlatform = await db
    .select({
      platform: results.platform,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(results)
    .where(
      testMonitorIds.length > 0
        ? sql`${results.monitorId} IN ${sql.raw(`('${testMonitorIds.join("','")}')`)}`
        : undefined,
    )
    .groupBy(results.platform);

  const expectedPlatforms = new Set<string>();
  for (const m of testMonitors) for (const p of m.platforms || []) expectedPlatforms.add(p);
  for (const p of expectedPlatforms) {
    const row = crossPlatform.find((x) => x.platform === p);
    const count = row?.count ?? 0;
    const status =
      count === 0 ? "❌ ZERO results — BROKEN" :
      count < 10 ? "⚠️  few results" : "✅";
    console.log(`   ${p.padEnd(16)} ${String(count).padStart(4)} results  ${status}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ diagnostic failed:", err);
    process.exit(1);
  });
