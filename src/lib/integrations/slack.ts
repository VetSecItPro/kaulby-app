/**
 * Slack Integration
 *
 * Enables sending real-time alerts to Slack channels.
 * Uses OAuth 2.0 for authentication with Slack's "Add to Slack" flow.
 */

// Slack OAuth configuration
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI =
  process.env.SLACK_REDIRECT_URI ||
  "https://kaulbyapp.com/api/integrations/slack/callback";

// Scopes needed for posting messages and accessing workspace info
const SLACK_SCOPES = [
  "incoming-webhook", // Post messages via webhook
  "chat:write", // Post messages to channels
  "channels:read", // List public channels
  "team:read", // Get workspace info
].join(",");

interface SlackTokens {
  accessToken: string;
  teamId: string;
  teamName: string;
  webhookUrl?: string;
  webhookChannel?: string;
  webhookChannelId?: string;
}

/**
 * Generate OAuth authorization URL for Slack
 */
export function getAuthorizationUrl(state: string): string {
  if (!SLACK_CLIENT_ID) {
    throw new Error("SLACK_CLIENT_ID not configured");
  }

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SLACK_SCOPES,
    redirect_uri: SLACK_REDIRECT_URI,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<SlackTokens> {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    throw new Error("Slack credentials not configured");
  }

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    webhookUrl: data.incoming_webhook?.url,
    webhookChannel: data.incoming_webhook?.channel,
    webhookChannelId: data.incoming_webhook?.channel_id,
  };
}

/**
 * Check if Slack integration is configured
 */
export function isSlackConfigured(): boolean {
  return !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
}
