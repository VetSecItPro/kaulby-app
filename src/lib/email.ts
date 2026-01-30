import { Resend } from "resend";
import {
  type DigestMention,
  type DailyDigestData,
  type WeeklyReportData,
} from "./email/digest-templates";
import { escapeHtml } from "./security/sanitize";

// Re-export types for convenience
export type { DigestMention, DailyDigestData, WeeklyReportData };

// Lazy init to avoid build-time errors
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = "Kaulby <notifications@kaulbyapp.com>";
const LOGO_URL = "https://kaulbyapp.com/logo-email.jpg";
const APP_URL = "https://kaulbyapp.com";

// Brand colors
const COLORS = {
  bg: "#0a0a0a",
  card: "#141414",
  cardBorder: "#262626",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textDim: "#71717a",
  accent: "#5eead4", // Teal accent from logo
  accentGold: "#d4a574", // Gold accent from logo
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
};

// Create or update a contact (for future use)
export async function upsertContact(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  subscriptionStatus?: string;
}) {
  // Resend doesn't have contact management like Loops
  // This is a no-op but kept for API compatibility
  console.log("Contact upsert:", params.email);
}

// Send welcome email
export async function sendWelcomeEmail(params: {
  email: string;
  name?: string;
}) {
  const { email, name = "there" } = params;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Welcome to Kaulby",
    html: getWelcomeEmailHtml(name),
  });
}

// Send alert notification email
export async function sendAlertEmail(params: {
  to: string;
  monitorName: string;
  results: Array<{
    title: string;
    url: string;
    platform: string;
    sentiment?: string | null;
    summary?: string | null;
  }>;
}) {
  const resultsHtml = params.results
    .map(
      (r) => `
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid ${COLORS.cardBorder};">
          <a href="${r.url}" style="color: ${COLORS.accent}; font-weight: 500; text-decoration: none; font-size: 15px; line-height: 1.4;">${escapeHtml(r.title)}</a>
          <div style="margin-top: 8px; font-size: 12px; color: ${COLORS.textDim};">
            <span style="display: inline-block; padding: 2px 8px; background: ${COLORS.card}; border: 1px solid ${COLORS.cardBorder}; border-radius: 4px; margin-right: 8px;">${r.platform}</span>
            ${r.sentiment ? `<span style="color: ${r.sentiment.toLowerCase().includes('positive') ? COLORS.success : r.sentiment.toLowerCase().includes('negative') ? COLORS.error : COLORS.textDim};">${r.sentiment}</span>` : ""}
          </div>
          ${r.summary ? `<p style="margin: 12px 0 0; color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6;">${escapeHtml(r.summary)}</p>` : ""}
        </td>
      </tr>
    `
    )
    .join("");

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: `${params.results.length} new mention${params.results.length > 1 ? "s" : ""} for "${params.monitorName}"`,
    html: getAlertEmailHtml(params.monitorName, params.results.length, resultsHtml),
  });
}

// Weekly AI insights type
export interface WeeklyInsights {
  headline: string;
  keyTrends: Array<{ trend: string; evidence: string }>;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    dominantSentiment: string;
  };
  topPainPoints: string[];
  opportunities: string[];
  recommendations: string[];
}

// Send digest email
export async function sendDigestEmail(params: {
  to: string;
  userName: string;
  frequency: "daily" | "weekly" | "monthly";
  monitors: Array<{
    name: string;
    resultsCount: number;
    topResults: Array<{
      title: string;
      url: string;
      platform: string;
      sentiment?: string | null;
      summary?: string | null;
      category?: string | null;
    }>;
  }>;
  aiInsights?: WeeklyInsights;
  platformBreakdown?: Array<{ platform: string; count: number }>;
  categoryBreakdown?: Array<{ category: string; count: number }>;
}) {
  // Build AI insights section if available
  let aiInsightsHtml = "";
  if (params.aiInsights) {
    const insights = params.aiInsights;
    aiInsightsHtml = `
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, rgba(94, 234, 212, 0.1) 0%, rgba(212, 165, 116, 0.1) 100%); border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
            <tr>
              <td style="padding: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <span style="font-size: 11px; font-weight: 600; letter-spacing: 1px; color: ${COLORS.accent}; text-transform: uppercase;">AI Insights</span>
                      <h3 style="margin: 8px 0 16px; font-size: 18px; font-weight: 600; color: ${COLORS.text}; line-height: 1.4;">${escapeHtml(insights.headline)}</h3>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 16px;">
                      <span style="display: inline-block; padding: 4px 12px; background: rgba(34, 197, 94, 0.15); color: ${COLORS.success}; font-size: 13px; border-radius: 20px; margin-right: 8px;">+${insights.sentimentBreakdown.positive} positive</span>
                      <span style="display: inline-block; padding: 4px 12px; background: rgba(239, 68, 68, 0.15); color: ${COLORS.error}; font-size: 13px; border-radius: 20px; margin-right: 8px;">${insights.sentimentBreakdown.negative} negative</span>
                      <span style="display: inline-block; padding: 4px 12px; background: rgba(113, 113, 122, 0.15); color: ${COLORS.textDim}; font-size: 13px; border-radius: 20px;">${insights.sentimentBreakdown.neutral} neutral</span>
                    </td>
                  </tr>
                  ${insights.keyTrends.length > 0 ? `
                  <tr>
                    <td style="padding-top: 8px;">
                      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: ${COLORS.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">Key Trends</p>
                      ${insights.keyTrends.map(t => `<p style="margin: 0 0 6px; font-size: 14px; color: ${COLORS.textMuted};"><span style="color: ${COLORS.accentGold};">•</span> <strong style="color: ${COLORS.text};">${escapeHtml(t.trend)}</strong> — ${escapeHtml(t.evidence)}</p>`).join("")}
                    </td>
                  </tr>
                  ` : ""}
                  ${insights.opportunities.length > 0 ? `
                  <tr>
                    <td style="padding-top: 16px;">
                      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: ${COLORS.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">Opportunities</p>
                      ${insights.opportunities.map(o => `<p style="margin: 0 0 6px; font-size: 14px; color: ${COLORS.textMuted};"><span style="color: ${COLORS.accent};">→</span> ${escapeHtml(o)}</p>`).join("")}
                    </td>
                  </tr>
                  ` : ""}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  const monitorsHtml = params.monitors
    .map(
      (m) => `
      <tr>
        <td style="padding: 0 24px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.card}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="padding: 16px 20px; border-bottom: 1px solid ${COLORS.cardBorder};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: ${COLORS.text};">${escapeHtml(m.name)}</h3>
                    </td>
                    <td align="right">
                      <span style="display: inline-block; padding: 4px 12px; background: rgba(94, 234, 212, 0.15); color: ${COLORS.accent}; font-size: 12px; font-weight: 600; border-radius: 20px;">${m.resultsCount} new</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${m.topResults
              .map(
                (r) => `
            <tr>
              <td style="padding: 14px 20px; border-bottom: 1px solid ${COLORS.cardBorder};">
                <a href="${r.url}" style="color: ${COLORS.accent}; font-weight: 500; text-decoration: none; font-size: 14px; line-height: 1.4;">${escapeHtml(r.title)}</a>
                <div style="margin-top: 6px; font-size: 11px; color: ${COLORS.textDim};">
                  ${r.platform}${r.sentiment ? ` · ${r.sentiment}` : ""}
                </div>
                ${r.summary ? `<p style="margin: 10px 0 0; color: ${COLORS.textMuted}; font-size: 13px; line-height: 1.5;">${escapeHtml(r.summary)}</p>` : ""}
              </td>
            </tr>
          `
              )
              .join("")}
          </table>
        </td>
      </tr>
    `
    )
    .join("");

  const totalResults = params.monitors.reduce((sum, m) => sum + m.resultsCount, 0);

  // Build platform/category breakdown section if available
  let breakdownHtml = "";
  if ((params.platformBreakdown && params.platformBreakdown.length > 0) ||
      (params.categoryBreakdown && params.categoryBreakdown.length > 0)) {

    const platformChips = params.platformBreakdown
      ?.sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(p => `<span style="display: inline-block; padding: 4px 10px; background: ${COLORS.bg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 16px; font-size: 12px; color: ${COLORS.textMuted}; margin: 3px;">${escapeHtml(p.platform.charAt(0).toUpperCase() + p.platform.slice(1))} <strong style="color: ${COLORS.text};">${p.count}</strong></span>`)
      .join("") || "";

    const categoryEmojis: Record<string, string> = {
      solution_request: "🎯",
      money_talk: "💰",
      pain_point: "😤",
      advice_request: "❓",
      hot_discussion: "🔥",
    };

    const categoryChips = params.categoryBreakdown
      ?.sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(c => `<span style="display: inline-block; padding: 4px 10px; background: ${COLORS.bg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 16px; font-size: 12px; color: ${COLORS.textMuted}; margin: 3px;">${categoryEmojis[c.category] || "📌"} ${escapeHtml(c.category.replace(/_/g, " "))} <strong style="color: ${COLORS.text};">${c.count}</strong></span>`)
      .join("") || "";

    breakdownHtml = `
      <tr>
        <td style="padding: 0 24px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.card}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
            <tr>
              <td style="padding: 16px 20px;">
                ${platformChips ? `
                <div style="margin-bottom: 12px;">
                  <p style="margin: 0 0 8px; font-size: 11px; font-weight: 600; color: ${COLORS.textDim}; text-transform: uppercase; letter-spacing: 0.5px;">By Platform</p>
                  ${platformChips}
                </div>
                ` : ""}
                ${categoryChips ? `
                <div>
                  <p style="margin: 0 0 8px; font-size: 11px; font-weight: 600; color: ${COLORS.textDim}; text-transform: uppercase; letter-spacing: 0.5px;">By Category</p>
                  ${categoryChips}
                </div>
                ` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: `Your ${params.frequency} digest · ${totalResults} new mentions`,
    html: getDigestEmailHtml(params.userName, params.frequency, totalResults, aiInsightsHtml, breakdownHtml, monitorsHtml),
  });
}

// Send subscription confirmation email
export async function sendSubscriptionEmail(params: {
  email: string;
  name?: string;
  plan: string;
}) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: `Welcome to Kaulby ${params.plan}`,
    html: getSubscriptionEmailHtml(params.name || "there", params.plan),
  });
}

// Send failed payment notice
export async function sendPaymentFailedEmail(params: {
  email: string;
  name?: string;
}) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: "Action required: Payment failed",
    html: getPaymentFailedEmailHtml(params.name || "there"),
  });
}

// Send workspace invite email
export async function sendWorkspaceInviteEmail(params: {
  email: string;
  workspaceName: string;
  inviterName: string;
  inviteToken: string;
}) {
  const inviteUrl = `${APP_URL}/invite/${params.inviteToken}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: `You've been invited to join ${params.workspaceName} on Kaulby`,
    html: getWorkspaceInviteEmailHtml(params.workspaceName, params.inviterName, inviteUrl),
  });
}

// Send invite accepted notification to workspace owner
export async function sendInviteAcceptedEmail(params: {
  ownerEmail: string;
  memberName: string;
  workspaceName: string;
}) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.ownerEmail,
    subject: `${params.memberName} joined ${params.workspaceName}`,
    html: getInviteAcceptedEmailHtml(params.memberName, params.workspaceName),
  });
}

// Helper to escape HTML
// Base email wrapper - elegant black theme with logo header
// NOTE: escapeHtml is imported from @/lib/security/sanitize
function getEmailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Kaulby</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${COLORS.bg};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <!-- Main Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${COLORS.card}; border: 1px solid ${COLORS.cardBorder}; border-radius: 16px; overflow: hidden;">
                <!-- Logo Header Row -->
                <tr>
                  <td style="padding: 20px 32px; border-bottom: 1px solid ${COLORS.cardBorder};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="48" style="vertical-align: middle;">
                          <img src="${LOGO_URL}" alt="Kaulby" width="40" height="40" style="display: block; border-radius: 8px;" />
                        </td>
                        <td style="vertical-align: middle; padding-left: 12px;">
                          <span style="font-size: 16px; font-weight: 600; color: ${COLORS.text};">Kaulby</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${content}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 24px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; color: ${COLORS.textDim};">
                Kaulby · Community Intelligence Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: ${COLORS.textDim};">
                <a href="${APP_URL}/dashboard/settings" style="color: ${COLORS.textDim}; text-decoration: underline;">Manage preferences</a>
                <span style="margin: 0 8px;">·</span>
                <a href="${APP_URL}" style="color: ${COLORS.textDim}; text-decoration: underline;">Visit Kaulby</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Email HTML templates
function getWelcomeEmailHtml(name: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px; text-align: center;">
        <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: ${COLORS.text};">Welcome to Kaulby</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">Let's get you started, ${escapeHtml(name)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 32px;">
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: ${COLORS.textMuted};">
          You're all set to start monitoring conversations that matter to your business. Create your first monitor and we'll start tracking mentions across Reddit, Hacker News, and more.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.bg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: ${COLORS.textDim}; text-transform: uppercase; letter-spacing: 0.5px;">Get Started</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.cardBorder};">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 28px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentGold}); border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700; color: ${COLORS.bg};">1</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${COLORS.text};">Create a monitor</p>
                          <p style="margin: 4px 0 0; font-size: 13px; color: ${COLORS.textDim};">Add keywords you want to track</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid ${COLORS.cardBorder};">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 28px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentGold}); border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700; color: ${COLORS.bg};">2</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${COLORS.text};">AI analyzes conversations</p>
                          <p style="margin: 4px 0 0; font-size: 13px; color: ${COLORS.textDim};">Sentiment analysis & pain point detection</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 28px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentGold}); border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700; color: ${COLORS.bg};">3</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${COLORS.text};">Get notified</p>
                          <p style="margin: 4px 0 0; font-size: 13px; color: ${COLORS.textDim};">Email alerts when mentions appear</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 14px 36px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 50px;">Create Your First Monitor</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getAlertEmailHtml(monitorName: string, resultsCount: number, resultsHtml: string): string {
  const content = `
    <tr>
      <td style="padding: 28px 24px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="display: inline-block; padding: 4px 12px; background: rgba(94, 234, 212, 0.15); color: ${COLORS.accent}; font-size: 11px; font-weight: 600; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">New Mentions</span>
            </td>
            <td align="right">
              <span style="font-size: 13px; color: ${COLORS.textDim};">${resultsCount} found</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 24px;">
        <h2 style="margin: 0 0 4px; font-size: 22px; font-weight: 600; color: ${COLORS.text};">${escapeHtml(monitorName)}</h2>
        <p style="margin: 0; font-size: 14px; color: ${COLORS.textMuted};">We found new conversations matching your monitor</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.bg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px; overflow: hidden;">
          ${resultsHtml}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/dashboard/results" style="display: inline-block; padding: 12px 32px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 50px;">View All Results</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getDigestEmailHtml(userName: string, frequency: string, totalResults: number, aiInsightsHtml: string, breakdownHtml: string, monitorsHtml: string): string {
  const content = `
    <tr>
      <td style="padding: 28px 24px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="display: inline-block; padding: 4px 12px; background: rgba(212, 165, 116, 0.15); color: ${COLORS.accentGold}; font-size: 11px; font-weight: 600; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">${frequency} Digest</span>
            </td>
            <td align="right">
              <span style="font-size: 13px; color: ${COLORS.textDim};">${totalResults} mentions</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 24px;">
        <h2 style="margin: 0 0 4px; font-size: 22px; font-weight: 600; color: ${COLORS.text};">Hey ${escapeHtml(userName)}</h2>
        <p style="margin: 0; font-size: 14px; color: ${COLORS.textMuted};">Here's what happened across your monitors</p>
      </td>
    </tr>
    ${aiInsightsHtml}
    ${breakdownHtml}
    ${monitorsHtml}
    <tr>
      <td style="padding: 8px 24px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 12px 32px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 50px;">Open Dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getSubscriptionEmailHtml(name: string, plan: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, rgba(94, 234, 212, 0.2), rgba(212, 165, 116, 0.2)); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">✨</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: ${COLORS.text};">Welcome to ${escapeHtml(plan)}</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">Thanks for upgrading, ${escapeHtml(name)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 12px;">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: ${COLORS.success}; text-transform: uppercase; letter-spacing: 0.5px;">Now Unlocked</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: ${COLORS.success}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">AI-powered sentiment analysis</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: ${COLORS.success}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">Pain point detection</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: ${COLORS.success}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">Real-time monitoring</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: ${COLORS.success}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">Email alerts & digests</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: ${COLORS.success}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">CSV export</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 14px 36px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 50px;">Go to Dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getPaymentFailedEmailHtml(name: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">⚠️</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${COLORS.text};">Payment Failed</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">Action required to keep your account active</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: ${COLORS.textMuted};">
          Hey ${escapeHtml(name)}, we couldn't process your latest payment. Please update your payment method to continue enjoying all features.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0; font-size: 14px; color: ${COLORS.error};">
                <strong>Important:</strong> Your account will be downgraded to Free in 7 days if payment isn't resolved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/api/polar/portal" style="display: inline-block; padding: 14px 36px; background-color: ${COLORS.error}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 50px;">Update Payment Method</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getWorkspaceInviteEmailHtml(workspaceName: string, inviterName: string, inviteUrl: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, rgba(94, 234, 212, 0.2), rgba(212, 165, 116, 0.2)); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">👋</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${COLORS.text};">You're Invited</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">Join your team on Kaulby</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.bg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; color: ${COLORS.textDim};">
                <strong style="color: ${COLORS.text};">${escapeHtml(inviterName)}</strong> has invited you to join
              </p>
              <p style="margin: 0; font-size: 22px; font-weight: 600; color: ${COLORS.accent};">
                ${escapeHtml(workspaceName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.7; color: ${COLORS.textMuted}; text-align: center;">
          As a team member, you'll have access to all monitors, results, and insights. Click below to accept the invitation.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${inviteUrl}" style="display: inline-block; padding: 14px 36px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 50px;">Accept Invitation</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 16px;">
              <p style="margin: 0; font-size: 12px; color: ${COLORS.textDim};">
                This invitation expires in 7 days
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getInviteAcceptedEmailHtml(memberName: string, workspaceName: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1)); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">🎉</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${COLORS.text};">New Team Member</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">Your team just got bigger</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 12px;">
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: ${COLORS.text};">
                ${escapeHtml(memberName)}
              </p>
              <p style="margin: 0; font-size: 14px; color: ${COLORS.success};">
                joined ${escapeHtml(workspaceName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/dashboard/settings" style="display: inline-block; padding: 12px 32px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 50px;">Manage Team</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

// ============================================================================
// ACCOUNT DELETION EMAILS
// ============================================================================

// Send deletion request confirmation email
export async function sendDeletionRequestedEmail(params: {
  email: string;
  name?: string;
  deletionDate: Date;
}) {
  const { email, name = "there", deletionDate } = params;
  const formattedDate = deletionDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Account deletion scheduled - Action required to cancel",
    html: getDeletionRequestedEmailHtml(name, formattedDate),
  });
}

// Send 24-hour reminder before deletion (with win-back messaging)
export async function sendDeletionReminderEmail(params: {
  email: string;
  name?: string;
}) {
  const { email, name = "there" } = params;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Final notice: Your Kaulby account will be deleted tomorrow",
    html: getDeletionReminderEmailHtml(name),
  });
}

// Send deletion confirmed email (after account is deleted)
export async function sendDeletionConfirmedEmail(params: {
  email: string;
  name?: string;
}) {
  const { email, name = "there" } = params;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your Kaulby account has been deleted",
    html: getDeletionConfirmedEmailHtml(name),
  });
}

function getDeletionRequestedEmailHtml(name: string, deletionDate: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: rgba(245, 158, 11, 0.15); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">⏳</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${COLORS.text};">Account Deletion Scheduled</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">We've received your request, ${escapeHtml(name)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: ${COLORS.textMuted};">
          Your Kaulby account has been scheduled for deletion. If this was a mistake or you change your mind, you can cancel the deletion anytime before the scheduled date.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px;">
          <tr>
            <td style="padding: 20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: ${COLORS.warning}; text-transform: uppercase; letter-spacing: 0.5px;">Scheduled Deletion Date</p>
                    <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${COLORS.text};">${deletionDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: ${COLORS.textDim}; text-transform: uppercase; letter-spacing: 0.5px;">What happens next</p>
        <ul style="margin: 0; padding: 0 0 0 20px; color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.8;">
          <li>Your account remains active until the deletion date</li>
          <li>We'll send you a reminder 24 hours before deletion</li>
          <li>After deletion, all data is permanently removed</li>
          <li>You can cancel anytime before the scheduled date</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/deletion-requested" style="display: inline-block; padding: 14px 36px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 50px;">Cancel Deletion Request</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 12px;">
              <p style="margin: 0; font-size: 12px; color: ${COLORS.textDim};">
                Changed your mind? Click above to keep your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getDeletionReminderEmailHtml(name: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: rgba(239, 68, 68, 0.15); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">⚠️</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${COLORS.text};">Final Notice</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">Your account will be deleted in 24 hours</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: ${COLORS.textMuted};">
          Hey ${escapeHtml(name)}, this is a final reminder that your Kaulby account is scheduled for permanent deletion tomorrow. Once deleted, all your data—monitors, results, and insights—will be gone forever.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, rgba(94, 234, 212, 0.08) 0%, rgba(212, 165, 116, 0.08) 100%); border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: ${COLORS.text};">Before you go...</p>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.7; color: ${COLORS.textMuted};">
                We'd love to have you back. If there was something that didn't work for you, we're always improving Kaulby based on feedback. Your monitors and data are still intact—just cancel the deletion to pick up right where you left off.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: ${COLORS.accent}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">All your monitors are still active</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: ${COLORS.accent}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">Your historical data is preserved</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: ${COLORS.accent}; margin-right: 8px;">✓</span>
                    <span style="font-size: 14px; color: ${COLORS.text};">One click to cancel and restore access</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/deletion-requested" style="display: inline-block; padding: 14px 36px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 50px;">Keep My Account</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 16px;">
              <p style="margin: 0; font-size: 13px; color: ${COLORS.textDim};">
                If you intended to delete your account, no action is needed.<br/>
                The deletion will proceed automatically tomorrow.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

// ============================================================================
// RE-ENGAGEMENT EMAILS (Churn Prevention)
// ============================================================================

// Send re-engagement email to inactive users
export async function sendReengagementEmail(params: {
  email: string;
  name?: string;
  daysSinceActive: number;
  stats: {
    activeMonitors: number;
    newMentions: number;
    topMention?: {
      title: string;
      platform: string;
      url: string;
    };
  };
}) {
  const { email, name = "there", daysSinceActive, stats } = params;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${stats.newMentions > 0 ? `${stats.newMentions} new mentions` : "Your monitors are waiting"} - We miss you!`,
    html: getReengagementEmailHtml(name, daysSinceActive, stats),
  });
}

function getReengagementEmailHtml(
  name: string,
  daysSinceActive: number,
  stats: {
    activeMonitors: number;
    newMentions: number;
    topMention?: {
      title: string;
      platform: string;
      url: string;
    };
  }
): string {
  // Build stats section
  let statsHtml = "";
  if (stats.newMentions > 0 || stats.activeMonitors > 0) {
    statsHtml = `
      <tr>
        <td style="padding: 0 32px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, rgba(94, 234, 212, 0.1) 0%, rgba(212, 165, 116, 0.1) 100%); border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
            <tr>
              <td style="padding: 24px;">
                <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: ${COLORS.accent}; text-transform: uppercase; letter-spacing: 0.5px;">While You Were Away</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${stats.newMentions > 0 ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width: 48px; vertical-align: top;">
                            <span style="display: inline-block; width: 40px; height: 40px; background: rgba(94, 234, 212, 0.2); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">💬</span>
                          </td>
                          <td style="padding-left: 12px; vertical-align: middle;">
                            <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${COLORS.text};">${stats.newMentions}</p>
                            <p style="margin: 2px 0 0; font-size: 13px; color: ${COLORS.textMuted};">new mentions found</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ""}
                  ${stats.activeMonitors > 0 ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width: 48px; vertical-align: top;">
                            <span style="display: inline-block; width: 40px; height: 40px; background: rgba(212, 165, 116, 0.2); border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">📡</span>
                          </td>
                          <td style="padding-left: 12px; vertical-align: middle;">
                            <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${COLORS.text};">${stats.activeMonitors}</p>
                            <p style="margin: 2px 0 0; font-size: 13px; color: ${COLORS.textMuted};">active monitors running</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ""}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  // Build top mention highlight
  let topMentionHtml = "";
  if (stats.topMention) {
    topMentionHtml = `
      <tr>
        <td style="padding: 0 32px 24px;">
          <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; color: ${COLORS.textDim}; text-transform: uppercase; letter-spacing: 0.5px;">Top Mention</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.bg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
            <tr>
              <td style="padding: 16px 20px;">
                <a href="${stats.topMention.url}" style="color: ${COLORS.accent}; font-weight: 500; text-decoration: none; font-size: 15px; line-height: 1.4;">${escapeHtml(stats.topMention.title)}</a>
                <div style="margin-top: 8px;">
                  <span style="display: inline-block; padding: 2px 8px; background: ${COLORS.card}; border: 1px solid ${COLORS.cardBorder}; border-radius: 4px; font-size: 11px; color: ${COLORS.textDim};">${stats.topMention.platform}</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, rgba(94, 234, 212, 0.2), rgba(212, 165, 116, 0.2)); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">👋</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${COLORS.text};">We Miss You, ${escapeHtml(name)}!</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">It's been ${daysSinceActive} days since your last visit</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.7; color: ${COLORS.textMuted};">
          Your monitors have been working hard while you were away${stats.newMentions > 0 ? `, and they've found ${stats.newMentions} new mentions waiting for you` : ""}. Don't miss out on valuable conversations about your brand!
        </p>
      </td>
    </tr>
    ${statsHtml}
    ${topMentionHtml}
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}/dashboard" style="display: inline-block; padding: 14px 36px; background-color: ${COLORS.accent}; color: ${COLORS.bg}; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 50px;">View Your Dashboard</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 16px;">
              <p style="margin: 0; font-size: 13px; color: ${COLORS.textDim};">
                Your monitors are actively tracking conversations 24/7
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}

function getDeletionConfirmedEmailHtml(name: string): string {
  const content = `
    <tr>
      <td style="padding: 40px 32px 24px; text-align: center;">
        <div style="display: inline-block; width: 64px; height: 64px; background: rgba(113, 113, 122, 0.15); border-radius: 50%; line-height: 64px; margin-bottom: 20px;">
          <span style="font-size: 32px;">👋</span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: ${COLORS.text};">Account Deleted</h1>
        <p style="margin: 0; font-size: 15px; color: ${COLORS.textMuted};">We're sorry to see you go</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: ${COLORS.textMuted};">
          Hey ${escapeHtml(name)}, your Kaulby account has been permanently deleted as requested. All your data, including monitors, results, and settings, has been removed from our systems.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.bg}; border: 1px solid ${COLORS.cardBorder}; border-radius: 12px;">
          <tr>
            <td style="padding: 20px 24px;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: ${COLORS.textDim}; text-transform: uppercase; letter-spacing: 0.5px;">What was deleted</p>
              <ul style="margin: 8px 0 0; padding: 0 0 0 18px; color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.8;">
                <li>All monitors and configurations</li>
                <li>Historical results and AI analysis</li>
                <li>Account settings and preferences</li>
                <li>Team memberships and API keys</li>
              </ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.7; color: ${COLORS.textMuted};">
          Thank you for trying Kaulby. If you ever want to monitor community conversations again, you're always welcome back. Just sign up with any email to start fresh.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${APP_URL}" style="display: inline-block; padding: 12px 32px; border: 1px solid ${COLORS.cardBorder}; color: ${COLORS.text}; text-decoration: none; font-weight: 500; font-size: 14px; border-radius: 50px;">Visit Kaulby</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return getEmailWrapper(content);
}
