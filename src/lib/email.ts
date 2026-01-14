import { Resend } from "resend";

// Lazy init to avoid build-time errors
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = "Kaulby <notifications@kaulbyapp.com>";

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
    subject: "Welcome to Kaulby!",
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
      <div style="margin-bottom: 16px; padding: 16px; border: 1px solid #e4e4e7; border-radius: 8px;">
        <a href="${r.url}" style="color: #2563eb; font-weight: 600; text-decoration: none; font-size: 15px;">${escapeHtml(r.title)}</a>
        <div style="margin-top: 6px; font-size: 12px; color: #71717a;">
          ${r.platform}${r.sentiment ? ` • ${r.sentiment}` : ""}
        </div>
        ${r.summary ? `<p style="margin: 10px 0 0; color: #3f3f46; font-size: 14px; line-height: 1.5;">${escapeHtml(r.summary)}</p>` : ""}
      </div>
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
  frequency: "daily" | "weekly";
  monitors: Array<{
    name: string;
    resultsCount: number;
    topResults: Array<{
      title: string;
      url: string;
      platform: string;
      sentiment?: string | null;
      summary?: string | null;
    }>;
  }>;
  aiInsights?: WeeklyInsights;
}) {
  // Build AI insights section if available
  let aiInsightsHtml = "";
  if (params.aiInsights) {
    const insights = params.aiInsights;
    aiInsightsHtml = `
      <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%); border-radius: 12px; border: 1px solid #e0e7ff;">
        <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #4f46e5;">AI Insights</h3>
        <p style="margin: 0 0 16px; font-size: 15px; font-weight: 500; color: #18181b;">${escapeHtml(insights.headline)}</p>

        <div style="margin-bottom: 12px;">
          <span style="font-size: 13px; color: #166534;">Positive: ${insights.sentimentBreakdown.positive}</span> •
          <span style="font-size: 13px; color: #dc2626;">Negative: ${insights.sentimentBreakdown.negative}</span> •
          <span style="font-size: 13px; color: #71717a;">Neutral: ${insights.sentimentBreakdown.neutral}</span>
        </div>

        ${insights.keyTrends.length > 0 ? `
        <div style="margin-bottom: 12px;">
          <strong style="font-size: 13px; color: #3f3f46;">Key Trends:</strong>
          <ul style="margin: 8px 0 0; padding-left: 20px;">
            ${insights.keyTrends.map(t => `<li style="font-size: 13px; color: #3f3f46; margin-bottom: 4px;"><strong>${escapeHtml(t.trend)}</strong>: ${escapeHtml(t.evidence)}</li>`).join("")}
          </ul>
        </div>
        ` : ""}

        ${insights.opportunities.length > 0 ? `
        <div>
          <strong style="font-size: 13px; color: #3f3f46;">Opportunities:</strong>
          <ul style="margin: 8px 0 0; padding-left: 20px;">
            ${insights.opportunities.map(o => `<li style="font-size: 13px; color: #3f3f46; margin-bottom: 4px;">${escapeHtml(o)}</li>`).join("")}
          </ul>
        </div>
        ` : ""}
      </div>
    `;
  }

  const monitorsHtml = params.monitors
    .map(
      (m) => `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #18181b;">${escapeHtml(m.name)} (${m.resultsCount} new)</h3>
        ${m.topResults
          .map(
            (r) => `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e4e4e7; border-radius: 8px;">
            <a href="${r.url}" style="color: #2563eb; font-weight: 600; text-decoration: none; font-size: 14px;">${escapeHtml(r.title)}</a>
            <div style="margin-top: 4px; font-size: 12px; color: #71717a;">
              ${r.platform}${r.sentiment ? ` • ${r.sentiment}` : ""}
            </div>
            ${r.summary ? `<p style="margin: 8px 0 0; color: #3f3f46; font-size: 13px; line-height: 1.5;">${escapeHtml(r.summary)}</p>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
    `
    )
    .join("");

  const totalResults = params.monitors.reduce((sum, m) => sum + m.resultsCount, 0);

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: `Your ${params.frequency} digest: ${totalResults} new mentions`,
    html: getDigestEmailHtml(params.userName, params.frequency, totalResults, aiInsightsHtml, monitorsHtml),
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
    subject: `Welcome to Kaulby ${params.plan}!`,
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

// Helper to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Email HTML templates
function getWelcomeEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #18181b;">Kaulby</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #71717a;">Community Intelligence Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Welcome, ${escapeHtml(name)}!</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                You're all set to start monitoring conversations that matter to your business.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="https://kaulbyapp.com/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">Create Your First Monitor</a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #fafafa; border-radius: 8px; padding: 24px;">
                <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #18181b;">Get started in 3 steps:</h3>
                <p style="margin: 0 0 8px; font-size: 14px; color: #3f3f46;"><strong>1.</strong> Create a monitor with your keywords</p>
                <p style="margin: 0 0 8px; font-size: 14px; color: #3f3f46;"><strong>2.</strong> AI analyzes sentiment & pain points</p>
                <p style="margin: 0; font-size: 14px; color: #3f3f46;"><strong>3.</strong> Get notified when mentions appear</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                Kaulby - Community Intelligence Platform
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

function getAlertEmailHtml(monitorName: string, resultsCount: number, resultsHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 40px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td><h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #18181b;">Kaulby</h1></td>
                  <td align="right"><span style="display: inline-block; padding: 6px 12px; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; border-radius: 9999px;">${resultsCount} new</span></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px;">
              <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #18181b;">New mentions for "${escapeHtml(monitorName)}"</h2>
              <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">We found ${resultsCount} new conversation(s) matching your monitor.</p>
              ${resultsHtml}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 24px 0 0;">
                    <a href="https://kaulbyapp.com/dashboard/results" style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">View All Results</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                <a href="https://kaulbyapp.com/dashboard/settings" style="color: #71717a;">Manage alert settings</a>
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

function getDigestEmailHtml(userName: string, frequency: string, totalResults: number, aiInsightsHtml: string, monitorsHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 40px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td><h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #18181b;">Kaulby</h1></td>
                  <td align="right"><span style="font-size: 14px; color: #71717a; text-transform: capitalize;">${frequency} Digest</span></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px;">
              <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #18181b;">Hey ${escapeHtml(userName)}, here's your update</h2>
              <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">${totalResults} new mentions found across your monitors.</p>
              ${aiInsightsHtml}
              ${monitorsHtml}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 24px 0 0;">
                    <a href="https://kaulbyapp.com/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">Open Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                <a href="https://kaulbyapp.com/dashboard/settings" style="color: #71717a;">Manage preferences</a>
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

function getSubscriptionEmailHtml(name: string, plan: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #18181b;">You're on ${escapeHtml(plan)}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46; text-align: center;">
                Thanks for upgrading, ${escapeHtml(name)}! Your account now has access to all ${escapeHtml(plan)} features.
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #166534;">What's now unlocked:</h3>
                <p style="margin: 0 0 8px; font-size: 14px; color: #166534;">✓ AI-powered sentiment analysis</p>
                <p style="margin: 0 0 8px; font-size: 14px; color: #166534;">✓ Pain point detection</p>
                <p style="margin: 0 0 8px; font-size: 14px; color: #166534;">✓ Real-time monitoring</p>
                <p style="margin: 0 0 8px; font-size: 14px; color: #166534;">✓ Email alerts</p>
                <p style="margin: 0; font-size: 14px; color: #166534;">✓ CSV export</p>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="https://kaulbyapp.com/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">Kaulby - Community Intelligence Platform</p>
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

function getPaymentFailedEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; width: 56px; height: 56px; background-color: #fef2f2; border-radius: 50%; line-height: 56px; margin-bottom: 16px;">
                <span style="font-size: 28px;">⚠️</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">Payment failed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hey ${escapeHtml(name)}, we couldn't process your latest payment.
              </p>
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #991b1b;">
                  <strong>Important:</strong> Your account will be downgraded to Free in 7 days if not resolved.
                </p>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="https://kaulbyapp.com/dashboard/settings" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">Update Payment Method</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">Kaulby - Community Intelligence Platform</p>
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
