/**
 * Test script for AI prompts - Compare Pro vs Team tier analysis
 * Run with: npx tsx scripts/test-ai-prompts.ts
 *
 * Make sure OPENROUTER_API_KEY is set in your .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  analyzeSentiment,
  analyzePainPoints,
  summarizeContent,
  analyzeComprehensive,
  type ComprehensiveAnalysisContext
} from "../src/lib/ai";

const TEST_CONTENT = `
I've been using [Competitor X] for 6 months now and honestly I'm pretty frustrated.
The pricing keeps going up - they just raised it to $49/month which is insane for what you get.
Looking for alternatives. Anyone tried anything else? I need something that:
- Does social media monitoring
- Has good AI analysis
- Doesn't break the bank
Seriously considering switching if I can find something decent.
`;

const TEST_CONTEXT: ComprehensiveAnalysisContext = {
  platform: "reddit",
  keywords: ["social media monitoring", "alternative", "pricing"],
  monitorName: "Competitor Tracking",
  businessName: "Kaulby",
  subreddit: "r/SaaS",
};

async function testProTier() {
  console.log("🔵 PRO TIER ANALYSIS (Gemini 2.5 Flash)");
  console.log("=".repeat(60));

  let totalCost = 0;
  let totalTime = 0;

  // Sentiment
  const sentimentStart = Date.now();
  const sentiment = await analyzeSentiment(TEST_CONTENT);
  const sentimentTime = Date.now() - sentimentStart;
  totalCost += sentiment.meta.cost;
  totalTime += sentimentTime;
  console.log("\n📊 Sentiment:", JSON.stringify(sentiment.result, null, 2));

  // Pain Points
  const painPointStart = Date.now();
  const painPoint = await analyzePainPoints(TEST_CONTENT);
  const painPointTime = Date.now() - painPointStart;
  totalCost += painPoint.meta.cost;
  totalTime += painPointTime;
  console.log("\n🎯 Category:", JSON.stringify(painPoint.result, null, 2));

  // Summary
  const summaryStart = Date.now();
  const summary = await summarizeContent(TEST_CONTENT);
  const summaryTime = Date.now() - summaryStart;
  totalCost += summary.meta.cost;
  totalTime += summaryTime;
  console.log("\n📝 Summary:", JSON.stringify(summary.result, null, 2));

  console.log("\n" + "-".repeat(60));
  console.log(`Pro Tier Total: $${totalCost.toFixed(6)} | ${totalTime}ms`);

  return { cost: totalCost, time: totalTime };
}

async function testTeamTier() {
  console.log("\n\n🟣 TEAM TIER ANALYSIS (Claude Sonnet 4)");
  console.log("=".repeat(60));

  const start = Date.now();
  const comprehensive = await analyzeComprehensive(TEST_CONTENT, TEST_CONTEXT);
  const time = Date.now() - start;

  const result = comprehensive.result;

  console.log("\n📊 SENTIMENT");
  console.log(JSON.stringify(result.sentiment, null, 2));

  console.log("\n🏷️ CLASSIFICATION");
  console.log(JSON.stringify(result.classification, null, 2));

  console.log("\n💰 OPPORTUNITY");
  console.log(JSON.stringify(result.opportunity, null, 2));

  console.log("\n⚔️ COMPETITIVE INTELLIGENCE");
  console.log(JSON.stringify(result.competitive, null, 2));

  console.log("\n🎬 RECOMMENDED ACTIONS");
  console.log(JSON.stringify(result.actions, null, 2));

  console.log("\n💬 SUGGESTED RESPONSE");
  console.log(JSON.stringify(result.suggestedResponse, null, 2));

  console.log("\n📰 CONTENT OPPORTUNITIES");
  console.log(JSON.stringify(result.contentOpportunity, null, 2));

  console.log("\n🌐 PLATFORM CONTEXT");
  console.log(JSON.stringify(result.platformContext, null, 2));

  console.log("\n📋 EXECUTIVE SUMMARY");
  console.log(`"${result.executiveSummary}"`);

  console.log("\n" + "-".repeat(60));
  console.log(`Team Tier Total: $${comprehensive.meta.cost.toFixed(6)} | ${time}ms`);
  console.log(`Model: ${comprehensive.meta.model}`);

  return { cost: comprehensive.meta.cost, time };
}

async function main() {
  console.log("=".repeat(60));
  console.log("KAULBY AI ANALYSIS - PRO vs TEAM TIER COMPARISON");
  console.log("=".repeat(60));
  console.log("\n📝 TEST INPUT:");
  console.log("-".repeat(40));
  console.log(TEST_CONTENT);
  console.log("-".repeat(40));

  try {
    const proResult = await testProTier();
    const teamResult = await testTeamTier();

    console.log("\n\n" + "=".repeat(60));
    console.log("📊 COMPARISON SUMMARY");
    console.log("=".repeat(60));
    console.log(`
┌─────────────────┬──────────────────┬──────────────────┐
│                 │     PRO TIER     │    TEAM TIER     │
├─────────────────┼──────────────────┼──────────────────┤
│ Model           │ Gemini 2.5 Flash │ Claude Sonnet 4  │
│ Cost            │ $${proResult.cost.toFixed(6).padEnd(12)}│ $${teamResult.cost.toFixed(6).padEnd(12)}│
│ Time            │ ${(proResult.time + "ms").padEnd(16)}│ ${(teamResult.time + "ms").padEnd(16)}│
│ API Calls       │ 3                │ 1                │
├─────────────────┼──────────────────┼──────────────────┤
│ Features        │                  │                  │
│ - Sentiment     │ ✅               │ ✅ + emotions    │
│ - Category      │ ✅               │ ✅ + subcategory │
│ - Summary       │ ✅               │ ✅               │
│ - Intent Score  │ ❌               │ ✅               │
│ - Lead Scoring  │ ❌               │ ✅               │
│ - Competitor    │ ❌               │ ✅               │
│ - Actions       │ Basic            │ ✅ Full          │
│ - Response Draft│ ❌               │ ✅               │
│ - Content Ideas │ ❌               │ ✅               │
│ - Exec Summary  │ ❌               │ ✅               │
└─────────────────┴──────────────────┴──────────────────┘
`);

    const costMultiple = teamResult.cost / proResult.cost;
    console.log(`Team tier costs ${costMultiple.toFixed(1)}x more but provides:`);
    console.log("- Intent scoring (0-100) for lead prioritization");
    console.log("- Competitive intelligence with switching likelihood");
    console.log("- Ready-to-use response drafts");
    console.log("- Content opportunity detection");
    console.log("- Department routing (sales/support/product/marketing)");
    console.log("- Executive summary for quick scanning");
    console.log("\nAt $99/mo for Team tier, the AI cost per 1000 analyses is:");
    console.log(`- Pro: $${(proResult.cost * 1000).toFixed(2)}`);
    console.log(`- Team: $${(teamResult.cost * 1000).toFixed(2)}`);
    console.log(`\nMargin impact: ${((1 - (teamResult.cost * 1000) / 99) * 100).toFixed(1)}% margin on AI costs`);

  } catch (error) {
    console.error("Error:", error);
  }
}

main();
