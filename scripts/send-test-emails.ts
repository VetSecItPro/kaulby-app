/**
 * Send test emails for Pro and Team tier digests
 * Run with: npx tsx scripts/send-test-emails.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Resend } from "resend";
import {
  generateDailyDigestHtml,
  generateWeeklyReportHtml,
  type DailyDigestData,
  type WeeklyReportData,
} from "../src/lib/email/digest-templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "Kaulby <notifications@kaulbyapp.com>";
const TEST_EMAIL = "airborneshellback@gmail.com";

// Sample data for Pro tier Daily Digest
const dailyDigestData: DailyDigestData = {
  userName: "Anouar",
  date: new Date(),
  mentions: [
    {
      id: "1",
      title: "Looking for alternatives to Competitor X - pricing is insane",
      url: "https://reddit.com/r/SaaS/abc123",
      platform: "Reddit",
      subreddit: "r/SaaS",
      sentiment: "negative",
      category: "competitor_mention",
      summary: "User frustrated with competitor's $49/month pricing, actively seeking alternatives with social media monitoring and AI analysis features.",
      urgency: "high",
      intentScore: 85,
      shouldRespond: true,
      monitorName: "Competitor Tracking",
    },
    {
      id: "2",
      title: "Best tools for monitoring brand mentions in 2026?",
      url: "https://reddit.com/r/marketing/def456",
      platform: "Reddit",
      subreddit: "r/marketing",
      sentiment: "neutral",
      category: "feature_request",
      summary: "Marketing professional asking for recommendations on brand monitoring tools with good AI capabilities.",
      urgency: "medium",
      monitorName: "Brand Monitoring",
    },
    {
      id: "3",
      title: "Our experience switching from GummySearch",
      url: "https://news.ycombinator.com/item?id=123",
      platform: "Hacker News",
      sentiment: "positive",
      category: "positive_feedback",
      summary: "Founder sharing positive experience after switching monitoring tools, praising AI analysis quality.",
      urgency: "low",
      monitorName: "Competitor Tracking",
    },
    {
      id: "4",
      title: "Need help with social listening for my startup",
      url: "https://reddit.com/r/startups/ghi789",
      platform: "Reddit",
      subreddit: "r/startups",
      sentiment: "neutral",
      category: "support_need",
      summary: "Early-stage founder looking for guidance on setting up social listening for product feedback.",
      urgency: "medium",
      monitorName: "Startup Mentions",
    },
    {
      id: "5",
      title: "Why I stopped using expensive monitoring tools",
      url: "https://reddit.com/r/Entrepreneur/jkl012",
      platform: "Reddit",
      subreddit: "r/Entrepreneur",
      sentiment: "negative",
      category: "pricing_concern",
      summary: "Entrepreneur explaining why they cancelled premium monitoring subscriptions due to poor ROI.",
      urgency: "high",
      shouldRespond: true,
      monitorName: "Competitor Tracking",
    },
    {
      id: "6",
      title: "Community feedback tools comparison thread",
      url: "https://reddit.com/r/ProductManagement/mno345",
      platform: "Reddit",
      subreddit: "r/ProductManagement",
      sentiment: "neutral",
      category: "general_discussion",
      summary: "Product managers discussing various community feedback and monitoring tools.",
      urgency: "low",
      monitorName: "Product Feedback",
    },
  ],
  stats: {
    total: 12,
    needsAttention: 3,
    salesOpportunities: 4,
    positive: 2,
    negative: 5,
    neutral: 5,
  },
  dashboardUrl: "https://kaulbyapp.com/dashboard",
};

// Sample data for Team tier Weekly Report
const weeklyReportData: WeeklyReportData = {
  userName: "Anouar",
  dateRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  },
  mentions: dailyDigestData.mentions,
  stats: {
    total: 47,
    previousWeekTotal: 38,
    needsAttention: 8,
    salesOpportunities: 12,
    testimonialCandidates: 3,
    featureRequests: 7,
    positive: 15,
    negative: 12,
    neutral: 20,
  },
  aiInsights: {
    headline: "Strong week with 24% increase in mentions. Competitor dissatisfaction driving high-intent leads.",
    executiveSummary: "This week saw a significant uptick in competitor mentions, particularly around pricing concerns. 12 qualified sales leads identified with an average intent score of 78. Three positive testimonials captured for marketing use.",
    keyTrends: [
      {
        trend: "Competitor pricing frustration is accelerating",
        evidence: "8 mentions specifically cited pricing as reason for seeking alternatives, up from 3 last week",
        implication: "Strong opportunity to position on value. Consider targeted content around pricing transparency.",
      },
      {
        trend: "AI analysis features increasingly in demand",
        evidence: "12 mentions specifically requested AI-powered insights as a must-have feature",
        implication: "Our AI differentiation is resonating. Double down on AI messaging in marketing.",
      },
      {
        trend: "Reddit r/SaaS remains highest-value source",
        evidence: "65% of high-intent leads originated from r/SaaS discussions",
        implication: "Maintain active presence in r/SaaS. Consider AMA or value-add content.",
      },
    ],
    sentimentBreakdown: {
      positive: 15,
      negative: 12,
      neutral: 20,
      dominantSentiment: "neutral",
      change: "Sentiment improved 12% from last week",
    },
    topPainPoints: [
      "Pricing and value concerns",
      "Lack of AI-powered insights",
      "Complex setup and onboarding",
      "Missing multi-platform support",
    ],
    opportunities: [
      {
        type: "sales",
        description: "12 high-intent leads ready for outreach",
        suggestedAction: "Prioritize response to competitor_mention category within 24 hours",
      },
      {
        type: "content",
        description: "Create comparison guide vs expensive competitors",
        suggestedAction: "Publish 'Affordable Social Monitoring Alternatives' blog post",
      },
      {
        type: "engagement",
        description: "3 positive testimonials available for social proof",
        suggestedAction: "Reach out for formal case study or review",
      },
    ],
    recommendations: [
      "Respond to all 12 sales leads within the next 48 hours - they're actively evaluating",
      "Create a pricing comparison page highlighting value vs competitors",
      "Reach out to the 3 testimonial candidates for case studies",
      "Monitor the r/SaaS thread about monitoring tools - high engagement opportunity",
    ],
    alertItems: [
      "Competitor X mentioned launching new features next week - monitor closely",
    ],
  },
  dashboardUrl: "https://kaulbyapp.com/dashboard",
};

async function sendTestEmails() {
  console.log("Sending test emails to:", TEST_EMAIL);
  console.log("=".repeat(60));

  try {
    // Send Pro tier Daily Digest
    console.log("\n1. Sending Pro Tier Daily Digest...");
    const dailyHtml = generateDailyDigestHtml(dailyDigestData);

    const dailyResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: `[TEST] Daily Digest: ${dailyDigestData.stats.total} mentions - ${dailyDigestData.stats.salesOpportunities} opportunities`,
      html: dailyHtml,
    });

    console.log("   Pro Daily Digest sent:", dailyResult.data?.id || "Success");

    // Wait a moment between emails
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send Team tier Weekly Report
    console.log("\n2. Sending Team Tier Weekly Intelligence Report...");
    const weeklyHtml = generateWeeklyReportHtml(weeklyReportData);

    const weeklyResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: `[TEST] Weekly Intel: ${weeklyReportData.stats.total} mentions (+24%) - ${weeklyReportData.stats.salesOpportunities} leads`,
      html: weeklyHtml,
    });

    console.log("   Team Weekly Report sent:", weeklyResult.data?.id || "Success");

    console.log("\n" + "=".repeat(60));
    console.log("Both test emails sent successfully!");
    console.log("Check your inbox at:", TEST_EMAIL);

  } catch (error) {
    console.error("Error sending emails:", error);
  }
}

sendTestEmails();
