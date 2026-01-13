const LOOPS_API_URL = "https://app.loops.so/api/v1";

async function loopsRequest(endpoint: string, data: Record<string, unknown>) {
  const response = await fetch(`${LOOPS_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Loops API error: ${error}`);
  }

  return response.json();
}

// Create or update a contact
export async function upsertContact(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  subscriptionStatus?: string;
}) {
  return loopsRequest("/contacts/update", {
    email: params.email,
    firstName: params.firstName,
    lastName: params.lastName,
    userId: params.userId,
    subscriptionStatus: params.subscriptionStatus,
  });
}

// Send transactional email
export async function sendTransactionalEmail(params: {
  transactionalId: string;
  email: string;
  dataVariables?: Record<string, string>;
}) {
  return loopsRequest("/transactional", {
    transactionalId: params.transactionalId,
    email: params.email,
    dataVariables: params.dataVariables,
  });
}

// Send welcome email
export async function sendWelcomeEmail(params: {
  email: string;
  name?: string;
}) {
  // You'll need to create this transactional email in Loops
  // and replace the ID with your actual transactional email ID
  return sendTransactionalEmail({
    transactionalId: process.env.LOOPS_WELCOME_EMAIL_ID || "welcome",
    email: params.email,
    dataVariables: {
      name: params.name || "there",
    },
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
      <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <a href="${r.url}" style="color: #2563eb; font-weight: 600;">${r.title}</a>
        <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
          ${r.platform} ${r.sentiment ? `• ${r.sentiment}` : ""}
        </div>
        ${r.summary ? `<p style="margin-top: 8px; color: #475569; font-size: 14px;">${r.summary}</p>` : ""}
      </div>
    `
    )
    .join("");

  return sendTransactionalEmail({
    transactionalId: process.env.LOOPS_ALERT_EMAIL_ID || "alert",
    email: params.to,
    dataVariables: {
      monitorName: params.monitorName,
      resultsCount: String(params.results.length),
      resultsHtml,
    },
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
      <div style="margin-bottom: 32px; padding: 20px; background: linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%); border-radius: 12px; border: 1px solid #e0e7ff;">
        <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #4f46e5;">Weekly AI Insights</h2>
        <p style="margin: 0 0 16px; font-size: 16px; font-weight: 500; color: #1e293b;">${insights.headline}</p>

        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #475569;">Sentiment This Week</h4>
          <div style="display: flex; gap: 12px;">
            <span style="color: #16a34a;">Positive: ${insights.sentimentBreakdown.positive}</span>
            <span style="color: #dc2626;">Negative: ${insights.sentimentBreakdown.negative}</span>
            <span style="color: #64748b;">Neutral: ${insights.sentimentBreakdown.neutral}</span>
          </div>
        </div>

        ${insights.keyTrends.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #475569;">Key Trends</h4>
          <ul style="margin: 0; padding-left: 20px;">
            ${insights.keyTrends.map(t => `<li style="margin-bottom: 4px;"><strong>${t.trend}</strong>: ${t.evidence}</li>`).join("")}
          </ul>
        </div>
        ` : ""}

        ${insights.opportunities.length > 0 ? `
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #475569;">Opportunities</h4>
          <ul style="margin: 0; padding-left: 20px;">
            ${insights.opportunities.map(o => `<li style="margin-bottom: 4px;">${o}</li>`).join("")}
          </ul>
        </div>
        ` : ""}

        ${insights.recommendations.length > 0 ? `
        <div>
          <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #475569;">Recommendations</h4>
          <ul style="margin: 0; padding-left: 20px;">
            ${insights.recommendations.map(r => `<li style="margin-bottom: 4px;">${r}</li>`).join("")}
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
        <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">${m.name} (${m.resultsCount} new)</h3>
        ${m.topResults
          .map(
            (r) => `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <a href="${r.url}" style="color: #2563eb; font-weight: 600;">${r.title}</a>
            <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
              ${r.platform} ${r.sentiment ? `• ${r.sentiment}` : ""}
            </div>
            ${r.summary ? `<p style="margin-top: 8px; color: #475569; font-size: 14px;">${r.summary}</p>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
    `
    )
    .join("");

  const totalResults = params.monitors.reduce((sum, m) => sum + m.resultsCount, 0);

  return sendTransactionalEmail({
    transactionalId: process.env.LOOPS_DIGEST_EMAIL_ID || "digest",
    email: params.to,
    dataVariables: {
      userName: params.userName,
      frequency: params.frequency,
      totalResults: String(totalResults),
      aiInsightsHtml,
      monitorsHtml,
    },
  });
}

// Send subscription confirmation email
export async function sendSubscriptionEmail(params: {
  email: string;
  name?: string;
  plan: string;
}) {
  return sendTransactionalEmail({
    transactionalId: process.env.LOOPS_SUBSCRIPTION_EMAIL_ID || "subscription",
    email: params.email,
    dataVariables: {
      name: params.name || "there",
      plan: params.plan,
    },
  });
}

// Send failed payment notice
export async function sendPaymentFailedEmail(params: {
  email: string;
  name?: string;
}) {
  return sendTransactionalEmail({
    transactionalId: process.env.LOOPS_PAYMENT_FAILED_EMAIL_ID || "payment_failed",
    email: params.email,
    dataVariables: {
      name: params.name || "there",
    },
  });
}
