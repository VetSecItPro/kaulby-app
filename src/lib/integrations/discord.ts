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
