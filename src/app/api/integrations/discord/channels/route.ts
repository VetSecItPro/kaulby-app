/**
 * Discord Channels API Routes
 *
 * GET  - List text channels in the connected guild
 * PATCH - Save the selected channel ID for alerts
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { listGuildTextChannels } from "@/lib/integrations/discord";
import { decryptIntegrationData, encryptIntegrationData } from "@/lib/encryption";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * GET /api/integrations/discord/channels
 * Returns the list of text channels the bot can see in the user's connected guild.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { integrations: true },
    });

    const integrations = (user?.integrations as Record<string, unknown>) || {};
    const discordData = integrations.discord as Record<string, unknown> | undefined;

    if (!discordData?.connected) {
      return NextResponse.json(
        { error: "Discord not connected" },
        { status: 400 }
      );
    }

    const guildId = discordData.guildId as string | undefined;
    if (!guildId) {
      return NextResponse.json(
        { error: "No guild ID stored. Please reconnect Discord." },
        { status: 400 }
      );
    }

    const { channels, error } = await listGuildTextChannels(guildId);

    if (error) {
      logger.error("Failed to list Discord channels", { error, guildId });
      return NextResponse.json(
        { error: "Failed to list channels. The bot may not have access to this server." },
        { status: 502 }
      );
    }

    // Also return the currently selected channel ID
    const selectedChannelId = discordData.channelId as string | undefined;

    return NextResponse.json({
      channels: channels.map((ch) => ({ id: ch.id, name: ch.name })),
      selectedChannelId: selectedChannelId || null,
    });
  } catch (error) {
    logger.error("Error listing Discord channels", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to list channels" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/integrations/discord/channels
 * Save the user's selected channel ID for Discord alert delivery.
 * Body: { channelId: string, channelName?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const body = await request.json();
    const { channelId, channelName } = body as { channelId?: string; channelName?: string };

    if (!channelId || typeof channelId !== "string") {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    // Validate channelId format (Discord snowflake: 17-20 digit number)
    if (!/^\d{17,20}$/.test(channelId)) {
      return NextResponse.json(
        { error: "Invalid channel ID format" },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { integrations: true },
    });

    const integrations = (user?.integrations as Record<string, unknown>) || {};
    const discordData = integrations.discord as Record<string, unknown> | undefined;

    if (!discordData?.connected) {
      return NextResponse.json(
        { error: "Discord not connected" },
        { status: 400 }
      );
    }

    // Decrypt existing data, update channel, re-encrypt
    const decrypted = decryptIntegrationData(discordData);
    const updated = encryptIntegrationData({
      ...decrypted,
      channelId,
      channelName: channelName || undefined,
    });

    await db
      .update(users)
      .set({
        integrations: {
          ...integrations,
          discord: updated,
        },
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true, channelId });
  } catch (error) {
    logger.error("Error saving Discord channel", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to save channel selection" },
      { status: 500 }
    );
  }
}
