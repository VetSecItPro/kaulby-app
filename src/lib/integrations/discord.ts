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
  const { monitorName, results, dashboardUrl } = payload;

  if (!webhookUrl) {
    return { success: false, error: "Webhook URL is required" };
  }

  if (!results.length) {
    return { success: false, error: "No results to send" };
  }

  // Build embeds for up to 5 results (Discord allows max 10 embeds per message)
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
      title: result.title.slice(0, 256), // Discord title limit
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

  // If there are more results than shown, add a summary embed linking to the dashboard
  if (results.length > 5) {
    embeds.push({
      title: `+ ${results.length - 5} more mentions`,
      url: dashboardUrl,
      color: SENTIMENT_COLORS.neutral,
      fields: [],
      description: "View all mentions in the Kaulby dashboard.",
    });
  }

  const discordPayload = {
    content: `📡 **${monitorName}** — ${results.length} new mention${results.length !== 1 ? "s" : ""} detected!`,
    embeds,
  };

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
