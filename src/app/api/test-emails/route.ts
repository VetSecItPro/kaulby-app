import { NextResponse } from "next/server";
import {
  sendWelcomeEmail,
  sendAlertEmail,
  sendDigestEmail,
  sendSubscriptionEmail,
  sendPaymentFailedEmail,
  sendWorkspaceInviteEmail,
  sendInviteAcceptedEmail,
} from "@/lib/email";

// POST /api/test-emails - Send all test emails
// SECURITY: Only works in verified local development (not Vercel preview/production)
export async function POST(request: Request) {
  // Defense-in-depth: Verify truly local development
  // Middleware also protects this route, but double-check here
  const isLocalDev = process.env.NODE_ENV === "development" &&
                     !process.env.VERCEL &&
                     !process.env.VERCEL_ENV;

  if (!isLocalDev) {
    return NextResponse.json({ error: "Only available in local development" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
  }

  const results: { template: string; status: string; error?: string }[] = [];

  // 1. Welcome Email
  try {
    await sendWelcomeEmail({
      email,
      name: "Test User",
    });
    results.push({ template: "Welcome Email", status: "sent" });
  } catch (error) {
    results.push({ template: "Welcome Email", status: "failed", error: String(error) });
  }

  // 2. Alert Email
  try {
    await sendAlertEmail({
      to: email,
      monitorName: "Kaulby Brand Monitor",
      results: [
        {
          title: "Just discovered Kaulby - game changer for community monitoring!",
          url: "https://reddit.com/r/SaaS/comments/example1",
          platform: "Reddit",
          sentiment: "Positive",
          summary: "User shares their experience using Kaulby for tracking brand mentions across social platforms.",
        },
        {
          title: "Comparing community monitoring tools - Kaulby vs competitors",
          url: "https://news.ycombinator.com/item?id=example2",
          platform: "Hacker News",
          sentiment: "Neutral",
          summary: "Discussion comparing features and pricing of various community monitoring solutions.",
        },
        {
          title: "Need help with Kaulby API integration",
          url: "https://reddit.com/r/webdev/comments/example3",
          platform: "Reddit",
          sentiment: "Neutral",
          summary: "Developer asking for guidance on integrating Kaulby webhooks into their workflow.",
        },
      ],
    });
    results.push({ template: "Alert Email", status: "sent" });
  } catch (error) {
    results.push({ template: "Alert Email", status: "failed", error: String(error) });
  }

  // 3. Daily Digest Email
  try {
    await sendDigestEmail({
      to: email,
      userName: "Test User",
      frequency: "daily",
      monitors: [
        {
          name: "Kaulby Brand Monitor",
          resultsCount: 12,
          topResults: [
            {
              title: "Kaulby helped me find 50+ leads this week",
              url: "https://reddit.com/r/entrepreneur/comments/example1",
              platform: "Reddit",
              sentiment: "Positive",
              summary: "Entrepreneur shares success story using Kaulby for lead generation.",
            },
            {
              title: "Feature request: Add LinkedIn monitoring",
              url: "https://producthunt.com/posts/kaulby/comments/example2",
              platform: "Product Hunt",
              sentiment: "Neutral",
              summary: "User requests LinkedIn as an additional platform to monitor.",
            },
          ],
        },
        {
          name: "Competitor Watch",
          resultsCount: 5,
          topResults: [
            {
              title: "GummySearch alternatives after Reddit API changes",
              url: "https://news.ycombinator.com/item?id=example3",
              platform: "Hacker News",
              sentiment: "Neutral",
              summary: "Discussion about alternatives to GummySearch following recent changes.",
            },
          ],
        },
      ],
    });
    results.push({ template: "Daily Digest Email", status: "sent" });
  } catch (error) {
    results.push({ template: "Daily Digest Email", status: "failed", error: String(error) });
  }

  // 4. Weekly Digest Email (with AI insights)
  try {
    await sendDigestEmail({
      to: email,
      userName: "Test User",
      frequency: "weekly",
      monitors: [
        {
          name: "Kaulby Brand Monitor",
          resultsCount: 47,
          topResults: [
            {
              title: "Kaulby vs Brand24 - honest comparison after 3 months",
              url: "https://reddit.com/r/marketing/comments/example1",
              platform: "Reddit",
              sentiment: "Positive",
              summary: "Detailed comparison favoring Kaulby for smaller teams and startups.",
            },
            {
              title: "How I use Kaulby for product research",
              url: "https://dev.to/example/kaulby-research",
              platform: "Dev.to",
              sentiment: "Positive",
              summary: "Tutorial on using Kaulby for validating product ideas.",
            },
          ],
        },
      ],
      aiInsights: {
        headline: "Strong positive sentiment this week with growing interest in API features",
        keyTrends: [
          { trend: "API Integration", evidence: "15 mentions requesting webhook and API access" },
          { trend: "Lead Generation", evidence: "12 users sharing success stories for finding leads" },
          { trend: "Competitor Migration", evidence: "8 users switching from other tools" },
        ],
        sentimentBreakdown: {
          positive: 32,
          negative: 5,
          neutral: 10,
          dominantSentiment: "positive",
        },
        topPainPoints: [
          "Users want more platforms (LinkedIn, Twitter)",
          "Some users find pricing steep for hobbyists",
        ],
        opportunities: [
          "Create content around lead generation use cases",
          "Consider a hobbyist tier or annual discount",
          "Prioritize API documentation improvements",
        ],
        recommendations: [
          "Engage with users asking about API features",
          "Share success stories on social media",
        ],
      },
    });
    results.push({ template: "Weekly Digest Email (with AI Insights)", status: "sent" });
  } catch (error) {
    results.push({ template: "Weekly Digest Email (with AI Insights)", status: "failed", error: String(error) });
  }

  // 5. Subscription Confirmation Email
  try {
    await sendSubscriptionEmail({
      email,
      name: "Test User",
      plan: "Pro",
    });
    results.push({ template: "Subscription Confirmation Email", status: "sent" });
  } catch (error) {
    results.push({ template: "Subscription Confirmation Email", status: "failed", error: String(error) });
  }

  // 6. Payment Failed Email
  try {
    await sendPaymentFailedEmail({
      email,
      name: "Test User",
    });
    results.push({ template: "Payment Failed Email", status: "sent" });
  } catch (error) {
    results.push({ template: "Payment Failed Email", status: "failed", error: String(error) });
  }

  // 7. Workspace Invite Email
  try {
    await sendWorkspaceInviteEmail({
      email,
      workspaceName: "Acme Corp",
      inviterName: "John Smith",
      inviteToken: "test-invite-token-12345",
    });
    results.push({ template: "Workspace Invite Email", status: "sent" });
  } catch (error) {
    results.push({ template: "Workspace Invite Email", status: "failed", error: String(error) });
  }

  // 8. Invite Accepted Email
  try {
    await sendInviteAcceptedEmail({
      ownerEmail: email,
      memberName: "Jane Doe",
      workspaceName: "Acme Corp",
    });
    results.push({ template: "Invite Accepted Email", status: "sent" });
  } catch (error) {
    results.push({ template: "Invite Accepted Email", status: "failed", error: String(error) });
  }

  const successful = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    message: `Sent ${successful} emails, ${failed} failed`,
    email,
    results,
  });
}
