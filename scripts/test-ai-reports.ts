/**
 * Test script for AI Reports - Shows Pro vs Team tier formatted output
 * Run with: npx tsx scripts/test-ai-reports.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  analyzeSentiment,
  analyzePainPoints,
  summarizeContent,
  analyzeComprehensive,
  formatProReport,
  formatTeamReport,
  type ComprehensiveAnalysisContext,
  type ProAnalysisData,
  type TeamAnalysisMetadata,
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

async function generateProReport() {
  console.log("Generating Pro Tier Report...\n");

  const [sentiment, painPoint, summary] = await Promise.all([
    analyzeSentiment(TEST_CONTENT),
    analyzePainPoints(TEST_CONTENT),
    summarizeContent(TEST_CONTENT),
  ]);

  const proData: ProAnalysisData = {
    sentiment: sentiment.result,
    painPoint: painPoint.result,
    summary: summary.result,
    metadata: {
      platform: "Reddit",
      title: "Looking for alternatives to Competitor X",
      url: "https://reddit.com/r/SaaS/abc123",
      keywords: TEST_CONTEXT.keywords,
      monitorName: "Competitor Tracking",
      analyzedAt: new Date(),
    },
  };

  return formatProReport(proData);
}

async function generateTeamReport() {
  console.log("Generating Team Tier Report...\n");

  const comprehensive = await analyzeComprehensive(TEST_CONTENT, TEST_CONTEXT);

  const teamMetadata: TeamAnalysisMetadata = {
    platform: "Reddit",
    title: "Looking for alternatives to Competitor X",
    url: "https://reddit.com/r/SaaS/abc123",
    keywords: TEST_CONTEXT.keywords,
    monitorName: "Competitor Tracking",
    analyzedAt: new Date(),
    subreddit: "r/SaaS",
    authorName: "frustrated_saas_user",
  };

  return formatTeamReport(comprehensive.result, teamMetadata);
}

async function main() {
  console.log("═".repeat(80));
  console.log("                    KAULBY AI REPORT COMPARISON");
  console.log("═".repeat(80));
  console.log("\n📝 SAMPLE MENTION:\n");
  console.log("─".repeat(80));
  console.log(TEST_CONTENT);
  console.log("─".repeat(80));

  try {
    // Generate Pro Report
    console.log("\n\n");
    console.log("█".repeat(80));
    console.log("█" + " ".repeat(30) + "PRO TIER REPORT" + " ".repeat(33) + "█");
    console.log("█".repeat(80));
    console.log("\n");

    const proReport = await generateProReport();
    console.log(proReport);

    // Generate Team Report
    console.log("\n\n\n");
    console.log("█".repeat(80));
    console.log("█" + " ".repeat(29) + "TEAM TIER REPORT" + " ".repeat(33) + "█");
    console.log("█".repeat(80));
    console.log("\n");

    const teamReport = await generateTeamReport();
    console.log(teamReport);

  } catch (error) {
    console.error("Error generating reports:", error);
  }
}

main();
