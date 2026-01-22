/**
 * Discord Integration API Routes
 *
 * GET - Get integration status
 * POST - Initiate OAuth flow
 * DELETE - Disconnect integration
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAuthorizationUrl, isDiscordConfigured } from "@/lib/integrations/discord";
import { nanoid } from "nanoid";

// Get integration status
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Discord is configured
    if (!isDiscordConfigured()) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: "Discord integration is not configured on this server",
      });
    }

    // Get user's integration status
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        integrations: true,
      },
    });

    const discordIntegration = (user?.integrations as Record<string, unknown>)?.discord as {
      connected: boolean;
      guildId?: string;
      guildName?: string;
      channelId?: string;
      channelName?: string;
      connectedAt?: string;
    } | undefined;

    return NextResponse.json({
      configured: true,
      connected: discordIntegration?.connected || false,
      guildId: discordIntegration?.guildId,
      guildName: discordIntegration?.guildName,
      channelId: discordIntegration?.channelId,
      channelName: discordIntegration?.channelName,
      connectedAt: discordIntegration?.connectedAt,
    });
  } catch (error) {
    console.error("Error getting Discord status:", error);
    return NextResponse.json(
      { error: "Failed to get integration status" },
      { status: 500 }
    );
  }
}

// Initiate OAuth flow
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isDiscordConfigured()) {
      return NextResponse.json(
        { error: "Discord integration is not configured" },
        { status: 400 }
      );
    }

    // Generate state for CSRF protection
    const state = `${userId}:${nanoid()}`;

    // Store state in user's record for validation
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const currentIntegrations = (user?.integrations as Record<string, unknown>) || {};

    await db
      .update(users)
      .set({
        integrations: {
          ...currentIntegrations,
          discord: {
            ...((currentIntegrations.discord as Record<string, unknown>) || {}),
            pendingState: state,
            stateCreatedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(users.id, userId));

    const authUrl = getAuthorizationUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Error initiating Discord OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}

// Disconnect integration
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const currentIntegrations = (user?.integrations as Record<string, unknown>) || {};

    // Remove Discord integration data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { discord: _, ...otherIntegrations } = currentIntegrations;

    await db
      .update(users)
      .set({
        integrations: otherIntegrations,
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Discord:", error);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
