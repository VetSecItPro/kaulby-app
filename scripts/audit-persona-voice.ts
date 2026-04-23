#!/usr/bin/env tsx
/**
 * Pull all AI summaries for the smoke-test monitor and audit them for
 * Kaulby persona voice (W2.6 acceptance).
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";

const MONITOR_ID = process.argv[2] || "4d806edf-1cc3-421f-97cf-d97efb809a28";

// Analyst voice — first-person + audience-aware recommendation patterns
const PERSONA_PROBES = [
  /\bI recommend\b/i,
  /\bI noticed\b/i,
  /\bI'd watch\b/i,
  /\bI'd reach out\b/i,
  /\bI saw\b/i,
  /\bI think\b/i,
  /\bI suggest\b/i,
  /\bI'd flag\b/i,
  /\bThree users\b/i,
  /\bTwo users\b/i,
  /\bHere's what stood out\b/i,
  /\bThis week\b/i,
  /\bworth keeping an eye\b/i,
  /\bworth a look\b/i,
  /\bteam should\b/i,
  /\bteam must\b/i,
  /\bneeds (immediate )?(?:escalation|review|attention)\b/i,
  /\bno (?:action|immediate action) (?:is )?(?:required|needed)\b/i,
  /\bworth (?:monitoring|noting|logging)\b/i,
];

const ROBOTIC_ANTIPATTERNS = [
  /^Sentiment: /im,
  /^Topic: /im,
  /^\s*Summary:\s*$/im,
  /^Category: /im,
];

async function main() {
  const rows = await db
    .select({
      id: results.id,
      title: results.title,
      content: results.content,
      aiSummary: results.aiSummary,
      sentiment: results.sentiment,
      painPointCategory: results.painPointCategory,
    })
    .from(results)
    .where(and(eq(results.monitorId, MONITOR_ID), isNotNull(results.aiSummary)))
    .orderBy(desc(results.createdAt));

  console.log(`📊 Auditing ${rows.length} AI summaries for monitor ${MONITOR_ID.slice(0, 12)}...\n`);

  let personaHits = 0;
  let roboticHits = 0;
  let cleanGenericCount = 0;
  const samples: { title: string; summary: string; verdict: string }[] = [];

  for (const r of rows) {
    const text = r.aiSummary || "";
    const hasPersona = PERSONA_PROBES.some((p) => p.test(text));
    const hasRobotic = ROBOTIC_ANTIPATTERNS.some((p) => p.test(text));
    const verdict = hasPersona ? "🎭 PERSONA" : hasRobotic ? "🤖 ROBOTIC" : "😐 GENERIC";

    if (hasPersona) personaHits++;
    if (hasRobotic) roboticHits++;
    if (!hasPersona && !hasRobotic) cleanGenericCount++;

    samples.push({
      title: r.title?.slice(0, 80) || "(no title)",
      summary: text.slice(0, 400),
      verdict,
    });
  }

  console.log(`🎭 Persona voice ("I noticed", "I'd watch", "Three users"): ${personaHits}/${rows.length} (${((personaHits/rows.length)*100).toFixed(0)}%)`);
  console.log(`🤖 Robotic anti-patterns ("Sentiment: x", "Topic: y"):       ${roboticHits}/${rows.length} (${((roboticHits/rows.length)*100).toFixed(0)}%)`);
  console.log(`😐 Generic (no clear persona, no robotic):                  ${cleanGenericCount}/${rows.length} (${((cleanGenericCount/rows.length)*100).toFixed(0)}%)`);

  console.log("\nVerdict:");
  if (personaHits / rows.length >= 0.4) {
    console.log("  ✅ Persona voice IS landing — W2.6 work delivered");
  } else if (personaHits / rows.length >= 0.15) {
    console.log("  🟡 Persona voice partially landing — some summaries read like an analyst, many don't");
  } else {
    console.log("  🔴 Persona voice NOT landing — summaries don't read like an analyst");
    console.log("     This is a launch blocker. Investigate src/lib/ai/prompts.ts SYSTEM_PROMPTS.");
  }

  console.log("\n📝 ALL SUMMARIES (newest first):\n");
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    console.log(`${i + 1}. ${s.verdict} | ${s.title}`);
    console.log(`   ${s.summary}${s.summary.length === 400 ? "..." : ""}`);
    console.log();
  }
}

main().catch(console.error).finally(() => process.exit(0));
