/**
 * Slack Integration API Routes
 *
 * POST - Initiate OAuth flow
 * DELETE - Disconnect integration
 */

import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAuthorizationUrl, isSlackConfigured } from "@/lib/integrations/slack";
import { nanoid } from "nanoid";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Initiate OAuth flow
export async function POST() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    if (!isSlackConfigured()) {
      return NextResponse.json(
        { error: "Slack integration is not configured" },
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
          slack: {
            ...((currentIntegrations.slack as Record<string, unknown>) || {}),
            pendingState: state,
            stateCreatedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(users.id, userId));

    const authUrl = getAuthorizationUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    logger.error("Error initiating Slack OAuth:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}

// Disconnect integration
export async function DELETE() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const currentIntegrations = (user?.integrations as Record<string, unknown>) || {};

    // Remove Slack integration data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { slack: _, ...otherIntegrations } = currentIntegrations;

    await db
      .update(users)
      .set({
        integrations: otherIntegrations,
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error disconnecting Slack:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}
