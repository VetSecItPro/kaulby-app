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

export interface DiscordTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  guildId?: string;
  guildName?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  guildId: string;
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
 * Get user's guilds (servers)
 */
export async function getUserGuilds(
  accessToken: string
): Promise<DiscordGuild[]> {
  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user guilds");
  }

  const guilds = await response.json();

  return guilds.map(
    (guild: {
      id: string;
      name: string;
      icon?: string;
      owner: boolean;
      permissions: string;
    }) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.owner,
      permissions: guild.permissions,
    })
  );
}

/**
 * Get channels in a guild
 */
export async function getGuildChannels(
  guildId: string
): Promise<DiscordChannel[]> {
  if (!DISCORD_BOT_TOKEN) {
    throw new Error("DISCORD_BOT_TOKEN not configured");
  }

  const response = await fetch(
    `https://discord.com/api/guilds/${guildId}/channels`,
    {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get guild channels");
  }

  const channels = await response.json();

  // Filter to text channels only (type 0)
  return channels
    .filter((channel: { type: number }) => channel.type === 0)
    .map(
      (channel: { id: string; name: string; type: number; guild_id: string }) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        guildId: channel.guild_id,
      })
    );
}

/**
 * Send a message to a Discord channel
 */
export async function sendMessage(
  channelId: string,
  content: string,
  embeds?: unknown[]
): Promise<void> {
  if (!DISCORD_BOT_TOKEN) {
    throw new Error("DISCORD_BOT_TOKEN not configured");
  }

  const response = await fetch(
    `https://discord.com/api/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        embeds,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send message: ${error}`);
  }
}

/**
 * Format a Kaulby result as a Discord embed
 */
export function formatResultForDiscord(result: {
  platform: string;
  title: string;
  author?: string;
  url: string;
  sentiment?: string;
  leadScore?: number;
  aiSummary?: string;
}): { content: string; embeds: unknown[] } {
  const sentimentColor =
    result.sentiment === "positive"
      ? 0x22c55e // green
      : result.sentiment === "negative"
        ? 0xef4444 // red
        : 0x6b7280; // gray

  const content = `New mention on ${result.platform}`;

  const embeds = [
    {
      title: result.title.slice(0, 256),
      url: result.url,
      color: sentimentColor,
      fields: [
        {
          name: "Platform",
          value: result.platform,
          inline: true,
        },
        {
          name: "Sentiment",
          value: result.sentiment || "Unknown",
          inline: true,
        },
        ...(result.author
          ? [
              {
                name: "Author",
                value: result.author,
                inline: true,
              },
            ]
          : []),
        ...(result.leadScore
          ? [
              {
                name: "Lead Score",
                value: `${result.leadScore}/100`,
                inline: true,
              },
            ]
          : []),
      ],
      description: result.aiSummary?.slice(0, 500),
      footer: {
        text: "Powered by Kaulby",
      },
      timestamp: new Date().toISOString(),
    },
  ];

  return { content, embeds };
}

/**
 * Check if Discord integration is configured
 */
export function isDiscordConfigured(): boolean {
  return !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_BOT_TOKEN);
}
