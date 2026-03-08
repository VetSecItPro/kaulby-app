/**
 * Microsoft Teams Integration API Routes
 *
 * POST - Save a Teams incoming webhook URL
 * DELETE - Remove Teams integration
 * GET - Return current Teams connection status
 *
 * Teams uses incoming webhooks (no OAuth required). Users paste their
 * webhook URL from the Teams channel connector settings.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { encryptIntegrationData, decryptIntegrationData } from "@/lib/encryption";
import { isValidTeamsWebhookUrl } from "@/lib/integrations/teams";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/integrations/teams
 * Return current Teams connection status (without exposing the webhook URL).
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
    const teamsData = integrations.teams as Record<string, unknown> | undefined;

    if (!teamsData?.connected) {
      return NextResponse.json({ connected: false });
    }

    // Verify the webhook URL is present (decrypted)
    const decrypted = decryptIntegrationData(teamsData);
    if (!decrypted.webhookUrl) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      connectedAt: teamsData.connectedAt || null,
    });
  } catch (error) {
    console.error("Error getting Teams status:", error);
    return NextResponse.json(
      { error: "Failed to get Teams status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/teams
 * Save a Teams incoming webhook URL.
 * Body: { webhookUrl: string }
 */
export async function POST(request: NextRequest) {
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
    const { webhookUrl } = body as { webhookUrl?: string };

    if (!webhookUrl || typeof webhookUrl !== "string") {
      return NextResponse.json(
        { error: "webhookUrl is required" },
        { status: 400 }
      );
    }

    if (!isValidTeamsWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        {
          error:
            "Invalid Microsoft Teams webhook URL. It should start with https:// and be from *.webhook.office.com or outlook.office.com.",
        },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const currentIntegrations = (user?.integrations as Record<string, unknown>) || {};

    const teamsIntegration = encryptIntegrationData({
      webhookUrl,
      connected: true,
      connectedAt: new Date().toISOString(),
    });

    // Mark connected as a plain boolean (not encrypted)
    teamsIntegration.connected = true;
    teamsIntegration.connectedAt = new Date().toISOString();

    await db
      .update(users)
      .set({
        integrations: {
          ...currentIntegrations,
          teams: teamsIntegration,
        },
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving Teams webhook:", error);
    return NextResponse.json(
      { error: "Failed to save Teams webhook" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/teams
 * Remove the Teams integration.
 */
export async function DELETE() {
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

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const currentIntegrations = (user?.integrations as Record<string, unknown>) || {};

    // Remove Teams integration data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { teams: _, ...otherIntegrations } = currentIntegrations;

    await db
      .update(users)
      .set({
        integrations: otherIntegrations,
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Teams:", error);
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
