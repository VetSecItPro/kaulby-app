/**
 * Discord Integration
 *
 * Enables sending real-time alerts to Discord channels.
 * Uses OAuth 2.0 for authentication with Discord's authorization flow.
 */

// Discord OAuth configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  "https://kaulbyapp.com/api/integrations/discord/callback";

// Scopes needed for posting messages and accessing guild info
const DISCORD_SCOPES = [
  "identify", // Get user info
  "guilds", // List user's servers
  "bot", // Add bot to server
].join(" ");

// Bot permissions (send messages, embed links, read message history)
const BOT_PERMISSIONS = "2048"; // Send Messages permission

interface DiscordTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  guildId?: string;
  guildName?: string;
}

/**
 * Generate OAuth authorization URL for Discord
 */
export function getAuthorizationUrl(state: string): string {
  if (!DISCORD_CLIENT_ID) {
    throw new Error("DISCORD_CLIENT_ID not configured");
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: DISCORD_SCOPES,
    permissions: BOT_PERMISSIONS,
    state,
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<DiscordTokens> {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error("Discord credentials not configured");
  }

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    guildId: data.guild?.id,
    guildName: data.guild?.name,
  };
}

/**
 * Check if Discord integration is configured
 */
export function isDiscordConfigured(): boolean {
  return !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_BOT_TOKEN);
}

/**
 * Discord channel info returned from the API
 */
export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = text, 2 = voice, etc.
}

/**
 * List text channels in a guild that the bot can see.
 * Requires the bot to be a member of the guild (added via OAuth).
 */
export async function listGuildTextChannels(
  guildId: string
): Promise<{ channels: DiscordChannel[]; error?: string }> {
  if (!DISCORD_BOT_TOKEN) {
    return { channels: [], error: "DISCORD_BOT_TOKEN not configured" };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        channels: [],
        error: `Failed to list channels: ${response.status} - ${text}`,
      };
    }

    const allChannels: DiscordChannel[] = await response.json();

    // Filter to text channels only (type 0) and sort alphabetically
    const textChannels = allChannels
      .filter((ch) => ch.type === 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { channels: textChannels };
  } catch (error) {
    return {
      channels: [],
      error: error instanceof Error ? error.message : "Unknown error listing channels",
    };
  }
}

/**
 * Build the Discord embed payload used by both webhook and bot message senders.
 */
function buildDiscordEmbedPayload(payload: {
  monitorName: string;
  results: Array<{
    title: string;
    sourceUrl: string;
    platform: string;
    sentiment: string | null;
    aiSummary: string | null;
  }>;
  dashboardUrl: string;
}): { content: string; embeds: Record<string, unknown>[] } {
  const { monitorName, results, dashboardUrl } = payload;

  const embeds = results.slice(0, 5).map((result) => {
    const sentimentKey = (result.sentiment?.toLowerCase() ?? "neutral") as keyof typeof SENTIMENT_COLORS;
    const color = SENTIMENT_COLORS[sentimentKey] ?? SENTIMENT_COLORS.neutral;

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      {
        name: "Platform",
        value: result.platform.charAt(0).toUpperCase() + result.platform.slice(1),
        inline: true,
      },
    ];

    if (result.sentiment) {
      fields.push({
        name: "Sentiment",
        value: result.sentiment.charAt(0).toUpperCase() + result.sentiment.slice(1),
        inline: true,
      });
    }

    const embed: Record<string, unknown> = {
      title: result.title.slice(0, 256),
      url: result.sourceUrl,
      color,
      fields,
    };

    if (result.aiSummary) {
      embed.description =
        result.aiSummary.slice(0, 300) +
        (result.aiSummary.length > 300 ? "..." : "");
    }

    return embed;
  });

  if (results.length > 5) {
    embeds.push({
      title: `+ ${results.length - 5} more mentions`,
      url: dashboardUrl,
      color: SENTIMENT_COLORS.neutral,
      fields: [],
      description: "View all mentions in the Kaulby dashboard.",
    });
  }

  return {
    content: `\u{1F4E1} **${monitorName}** \u2014 ${results.length} new mention${results.length !== 1 ? "s" : ""} detected!`,
    embeds,
  };
}

/**
 * Send a formatted message to a Discord channel via bot token + channel ID.
 * Uses the Discord REST API (POST /channels/{channelId}/messages).
 */
export async function sendDiscordBotMessage(
  channelId: string,
  payload: {
    monitorName: string;
    results: Array<{
      title: string;
      sourceUrl: string;
      platform: string;
      sentiment: string | null;
      aiSummary: string | null;
    }>;
    dashboardUrl: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!DISCORD_BOT_TOKEN) {
    return { success: false, error: "DISCORD_BOT_TOKEN not configured" };
  }

  if (!channelId) {
    return { success: false, error: "Channel ID is required" };
  }

  if (!payload.results.length) {
    return { success: false, error: "No results to send" };
  }

  const discordPayload = buildDiscordEmbedPayload(payload);

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
        body: JSON.stringify(discordPayload),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Discord bot message failed: ${response.status} - ${text}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending Discord bot message",
    };
  }
}

// Sentiment color mapping (decimal integers for Discord embeds)
const SENTIMENT_COLORS = {
  positive: 0x22c55e, // green
  negative: 0xef4444, // red
  neutral: 0x3b82f6, // blue
  mixed: 0xf59e0b, // amber
} as const;

/**
 * Send a formatted message to a Discord channel via webhook URL.
 *
 * Formats results as Discord embeds with sentiment color coding,
 * platform info, and links back to the Kaulby dashboard.
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  payload: {
    monitorName: string;
    results: Array<{
      title: string;
      sourceUrl: string;
      platform: string;
      sentiment: string | null;
      aiSummary: string | null;
    }>;
    dashboardUrl: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: "Webhook URL is required" };
  }

  if (!payload.results.length) {
    return { success: false, error: "No results to send" };
  }

  const discordPayload = buildDiscordEmbedPayload(payload);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Discord webhook failed: ${response.status} - ${text}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending Discord message",
    };
  }
}
