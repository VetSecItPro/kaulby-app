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

export interface SlackTokens {
  accessToken: string;
  teamId: string;
  teamName: string;
  webhookUrl?: string;
  webhookChannel?: string;
  webhookChannelId?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
  isPrivate: boolean;
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
 * Get workspace info
 */
export async function getTeamInfo(
  accessToken: string
): Promise<{ id: string; name: string; icon?: string }> {
  const response = await fetch("https://slack.com/api/team.info", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get team info");
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return {
    id: data.team.id,
    name: data.team.name,
    icon: data.team.icon?.image_68,
  };
}

/**
 * List channels the bot can post to
 */
export async function listChannels(accessToken: string): Promise<SlackChannel[]> {
  const response = await fetch(
    "https://slack.com/api/conversations.list?types=public_channel&limit=100",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to list channels");
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.channels.map((channel: { id: string; name: string; is_member: boolean; is_private: boolean }) => ({
    id: channel.id,
    name: channel.name,
    isMember: channel.is_member,
    isPrivate: channel.is_private,
  }));
}

/**
 * Send a message to a Slack channel
 */
export async function sendMessage(
  accessToken: string,
  channel: string,
  text: string,
  blocks?: unknown[]
): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to send message");
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
}

/**
 * Send a message via incoming webhook (simpler, no token needed after setup)
 */
export async function sendWebhookMessage(
  webhookUrl: string,
  text: string,
  blocks?: unknown[]
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      blocks,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send webhook message: ${error}`);
  }
}

/**
 * Format a Kaulby result as a Slack message
 */
export function formatResultForSlack(result: {
  platform: string;
  title: string;
  author?: string;
  url: string;
  sentiment?: string;
  leadScore?: number;
  aiSummary?: string;
}): { text: string; blocks: unknown[] } {
  const sentimentEmoji =
    result.sentiment === "positive"
      ? ":green_circle:"
      : result.sentiment === "negative"
        ? ":red_circle:"
        : ":white_circle:";

  const text = `New mention on ${result.platform}: ${result.title}`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `New mention on ${result.platform}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${result.url}|${result.title}>*`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${sentimentEmoji} ${result.sentiment || "Unknown"} sentiment`,
        },
        ...(result.author
          ? [
              {
                type: "mrkdwn",
                text: `By: ${result.author}`,
              },
            ]
          : []),
        ...(result.leadScore
          ? [
              {
                type: "mrkdwn",
                text: `Lead score: ${result.leadScore}/100`,
              },
            ]
          : []),
      ],
    },
    ...(result.aiSummary
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `_${result.aiSummary.slice(0, 500)}${result.aiSummary.length > 500 ? "..." : ""}_`,
            },
          },
        ]
      : []),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View in Kaulby",
            emoji: true,
          },
          url: "https://kaulbyapp.com/dashboard",
          action_id: "view_in_kaulby",
        },
      ],
    },
  ];

  return { text, blocks };
}

/**
 * Check if Slack integration is configured
 */
export function isSlackConfigured(): boolean {
  return !!(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
}
