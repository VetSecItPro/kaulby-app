import { NextResponse } from "next/server";
import {
  sendDigestEmail,
  sendSubscriptionEmail,
  sendPaymentFailedEmail,
  sendWorkspaceInviteEmail,
  sendInviteAcceptedEmail,
} from "@/lib/email";

// POST /api/test-single-email - Send a specific test email
// Only works in development
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const template = searchParams.get("template");

  if (!email) {
    return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
  }

  if (!template) {
    return NextResponse.json({
      error: "Template parameter required",
      options: ["digest-daily", "digest-weekly", "subscription", "payment-failed", "workspace-invite", "invite-accepted"]
    }, { status: 400 });
  }

  try {
    switch (template) {
      case "digest-daily":
        await sendDigestEmail({
          to: email,
          userName: "Test User",
          frequency: "daily",
          monitors: [
            {
              name: "Test Monitor",
              resultsCount: 5,
              topResults: [
                {
                  title: "Sample mention from Reddit",
                  url: "https://reddit.com/r/test",
                  platform: "Reddit",
                  sentiment: "Positive",
                  summary: "A test mention for debugging purposes.",
                },
              ],
            },
          ],
        });
        break;

      case "digest-weekly":
        await sendDigestEmail({
          to: email,
          userName: "Test User",
          frequency: "weekly",
          monitors: [
            {
              name: "Test Monitor",
              resultsCount: 25,
              topResults: [
                {
                  title: "Weekly sample mention",
                  url: "https://reddit.com/r/test",
                  platform: "Reddit",
                  sentiment: "Positive",
                  summary: "A weekly test mention.",
                },
              ],
            },
          ],
          aiInsights: {
            headline: "Test AI insights headline",
            keyTrends: [{ trend: "Test Trend", evidence: "Evidence here" }],
            sentimentBreakdown: { positive: 20, negative: 3, neutral: 2, dominantSentiment: "positive" },
            topPainPoints: ["Pain point 1"],
            opportunities: ["Opportunity 1"],
            recommendations: ["Recommendation 1"],
          },
        });
        break;

      case "subscription":
        await sendSubscriptionEmail({
          email,
          name: "Test User",
          plan: "Pro",
        });
        break;

      case "payment-failed":
        await sendPaymentFailedEmail({
          email,
          name: "Test User",
        });
        break;

      case "workspace-invite":
        await sendWorkspaceInviteEmail({
          email,
          workspaceName: "Test Workspace",
          inviterName: "John Doe",
          inviteToken: "test-token-123",
        });
        break;

      case "invite-accepted":
        await sendInviteAcceptedEmail({
          ownerEmail: email,
          memberName: "Jane Smith",
          workspaceName: "Test Workspace",
        });
        break;

      default:
        return NextResponse.json({
          error: `Unknown template: ${template}`,
          options: ["digest-daily", "digest-weekly", "subscription", "payment-failed", "workspace-invite", "invite-accepted"]
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${template} email to ${email}`
    });
  } catch (error) {
    console.error(`Failed to send ${template} email:`, error);
    return NextResponse.json({
      success: false,
      error: String(error),
      template,
      email
    }, { status: 500 });
  }
}
