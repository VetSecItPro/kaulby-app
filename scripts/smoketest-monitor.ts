#!/usr/bin/env tsx
/**
 * W3.7 smoke test — automated.
 *
 * Creates a real monitor in the prod DB, fires a scan via Inngest, waits
 * for results to land, reads the AI summaries back, and audits them for
 * Kaulby persona voice (W2.6 acceptance criteria).
 *
 * Cleans up by deactivating the test monitor at the end.
 *
 * Run with:
 *   pnpm tsx scripts/smoketest-monitor.ts [--keep] [--target=<keyword>]
 *
 * Flags:
 *   --keep            Don't deactivate the monitor at end (so you can browse it)
 *   --target=<kw>     Override the watch target (default: "claude-code")
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { Inngest } from "inngest";

const KEEP = process.argv.includes("--keep");
const TARGET = (process.argv.find((a) => a.startsWith("--target="))?.split("=")[1]) ?? "claude-code";

// Persona-voice probes — these phrases should appear in summaries written
// in the "Kaulby analyst" voice (W2.6). Not all of them per summary, but
// at least one across the batch is a positive signal.
const PERSONA_PROBES = [
  /\bI noticed\b/i,
  /\bI'd watch\b/i,
  /\bI'd reach out\b/i,
  /\bI saw\b/i,
  /\bThree users\b/i,
  /\bTwo users\b/i,
  /\bHere's what stood out\b/i,
  /\bThis week\b/i,
];

// Anti-patterns that suggest old robotic voice still in use
const ROBOTIC_ANTIPATTERNS = [
  /\bSentiment: (positive|negative|neutral)\b/i,
  /\bTopic: \w+\b/i,
  /^\s*Summary:\s*$/im,
];

async function main() {
  console.log("🔥 W3.7 SMOKE TEST — Kaulby end-to-end\n");

  // --- Step 1: find admin user ---
  console.log("👤 Locating admin user...");
  const admin = await db.query.users.findFirst({
    where: eq(users.isAdmin, true),
    columns: { id: true, email: true, name: true, subscriptionStatus: true },
  });
  if (!admin) {
    console.error("❌ No admin user found. Mark a user with isAdmin=true first.");
    process.exit(1);
  }
  console.log(`   ✅ ${admin.email} (id=${admin.id.slice(0, 12)}..., plan=${admin.subscriptionStatus})\n`);

  // --- Step 2: create test monitor ---
  console.log(`📝 Creating test monitor for "${TARGET}"...`);
  const [monitor] = await db
    .insert(monitors)
    .values({
      userId: admin.id,
      name: `[SMOKE TEST] ${TARGET} mentions`,
      companyName: TARGET,
      keywords: [TARGET, `${TARGET} alternative`, `${TARGET} vs`],
      platforms: ["reddit", "hackernews", "github"],
      isActive: true,
    })
    .returning({ id: monitors.id });
  console.log(`   ✅ Monitor created: ${monitor.id}\n`);

  // --- Step 3: fire Inngest scan event ---
  console.log("🚀 Firing Inngest scan event...");
  const inngest = new Inngest({
    id: "kaulby",
    eventKey: process.env.INNGEST_EVENT_KEY,
  });
  await inngest.send({
    name: "monitor/scan-now",
    data: { monitorId: monitor.id, userId: admin.id },
  });
  console.log("   ✅ Event sent\n");

  // --- Step 4: poll for results ---
  console.log("⏳ Polling for results (max 90 seconds)...");
  const startTime = Date.now();
  let foundResults: Array<{ id: string; title: string; aiSummary: string | null; sentiment: string | null; platform: string }> = [];
  while (Date.now() - startTime < 90_000) {
    const rows = await db
      .select({
        id: results.id,
        title: results.title,
        aiSummary: results.aiSummary,
        sentiment: results.sentiment,
        platform: results.platform,
      })
      .from(results)
      .where(and(eq(results.monitorId, monitor.id), gte(results.createdAt, new Date(startTime))))
      .orderBy(desc(results.createdAt))
      .limit(20);
    if (rows.length > 0) {
      foundResults = rows;
      console.log(`   📨 Got ${rows.length} results after ${Math.round((Date.now() - startTime) / 1000)}s`);
      // Wait a bit more for AI analyses to complete on those results
      const withAi = rows.filter((r) => r.aiSummary && r.aiSummary.length > 20).length;
      if (withAi >= Math.min(3, rows.length)) {
        console.log(`   🤖 ${withAi}/${rows.length} have AI summaries — done polling\n`);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (foundResults.length === 0) {
    console.log("   ⚠️  No results within 90s. Could mean: scan still running, or no fresh content matched.\n");
  }

  // --- Step 5: report findings ---
  console.log("=".repeat(70));
  console.log("📊 SMOKE TEST REPORT");
  console.log("=".repeat(70));

  console.log(`\n📦 Results collected: ${foundResults.length}`);
  if (foundResults.length > 0) {
    const byPlatform: Record<string, number> = {};
    for (const r of foundResults) {
      byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + 1;
    }
    console.log(`   By platform: ${Object.entries(byPlatform).map(([p, n]) => `${p}=${n}`).join(", ")}`);
  }

  const withAi = foundResults.filter((r) => r.aiSummary && r.aiSummary.length > 20);
  console.log(`\n🤖 AI analysis coverage: ${withAi.length}/${foundResults.length}`);
  if (withAi.length === 0 && foundResults.length > 0) {
    console.log("   ⚠️  No AI summaries — check that the analyze-content Inngest function ran");
  }

  // --- Persona voice audit ---
  console.log("\n🎭 PERSONA VOICE AUDIT");
  if (withAi.length === 0) {
    console.log("   (Skipped — no AI summaries to audit)");
  } else {
    let personaHits = 0;
    let roboticHits = 0;
    for (const r of withAi) {
      const text = r.aiSummary ?? "";
      if (PERSONA_PROBES.some((p) => p.test(text))) personaHits++;
      if (ROBOTIC_ANTIPATTERNS.some((p) => p.test(text))) roboticHits++;
    }
    const personaRate = (personaHits / withAi.length) * 100;
    const roboticRate = (roboticHits / withAi.length) * 100;
    console.log(`   Persona phrases ("I noticed", "I'd watch", "Three users"): ${personaHits}/${withAi.length} (${personaRate.toFixed(0)}%)`);
    console.log(`   Robotic anti-patterns ("Sentiment: x", "Topic: y"): ${roboticHits}/${withAi.length} (${roboticRate.toFixed(0)}%)`);
    if (personaRate >= 30 && roboticRate < 30) {
      console.log("   ✅ Persona voice IS landing");
    } else if (personaRate < 15) {
      console.log("   ⚠️  Persona voice WEAK — summaries don't read like an analyst");
    } else {
      console.log("   🤔 Mixed — some persona, some robotic. Inspect samples below.");
    }
  }

  // --- Sample summaries ---
  console.log("\n📝 SAMPLE AI SUMMARIES (first 3)");
  for (const r of withAi.slice(0, 3)) {
    console.log(`\n   [${r.platform}] ${r.title?.slice(0, 80) ?? "(no title)"}`);
    console.log(`   sentiment=${r.sentiment ?? "?"}`);
    console.log(`   summary: ${r.aiSummary?.slice(0, 300)}${(r.aiSummary?.length ?? 0) > 300 ? "..." : ""}`);
  }

  // --- Cleanup ---
  if (KEEP) {
    console.log(`\n🚧 --keep flag set: leaving monitor active (id=${monitor.id})`);
    console.log(`   Browse it at https://kaulbyapp.com/dashboard/monitors/${monitor.id}`);
  } else {
    console.log("\n🧹 Cleaning up — deactivating test monitor...");
    await db.update(monitors).set({ isActive: false }).where(eq(monitors.id, monitor.id));
    console.log("   ✅ Monitor deactivated (results preserved for inspection)");
  }

  console.log("\n" + "=".repeat(70));
  console.log("🏁 SMOKE TEST COMPLETE");
  console.log("=".repeat(70));
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
