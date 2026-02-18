/**
 * HubSpot OAuth Callback Handler
 *
 * Handles the redirect from HubSpot after user authorizes the integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  exchangeCodeForTokens,
  getAccountInfo,
} from "@/lib/integrations/hubspot";
import { encryptIntegrationData } from "@/lib/encryption";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle error from HubSpot
    if (error) {
      logger.error("HubSpot OAuth error", { error, errorDescription });
      return NextResponse.redirect(
        new URL(
          `/dashboard/settings?tab=integrations&error=${encodeURIComponent(
            error === "access_denied" ? "Access denied by user" : "Failed to authorize HubSpot"
          )}`,
          request.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?tab=integrations&error=Missing+authorization+code",
          request.url
        )
      );
    }

    // Extract user ID from state
    const [userId] = state.split(":");
    if (!userId) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?tab=integrations&error=Invalid+state+parameter",
          request.url
        )
      );
    }

    // Validate state matches stored state
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?tab=integrations&error=User+not+found",
          request.url
        )
      );
    }

    const currentIntegrations = (user.integrations as Record<string, unknown>) || {};
    const hubspotData = (currentIntegrations.hubspot as Record<string, unknown>) || {};

    if (hubspotData.pendingState !== state) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?tab=integrations&error=State+mismatch",
          request.url
        )
      );
    }

    // Check state expiration (10-minute window)
    const stateCreatedAt = hubspotData.stateCreatedAt ? new Date(hubspotData.stateCreatedAt as string) : null;
    if (!stateCreatedAt || Date.now() - stateCreatedAt.getTime() > 10 * 60 * 1000) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?tab=integrations&error=Authorization+expired.+Please+try+again.",
          request.url
        )
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get account info
    const accountInfo = await getAccountInfo(tokens.accessToken);

    // Store encrypted tokens and mark as connected
    const hubspotIntegration = encryptIntegrationData({
      connected: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
      portalId: accountInfo.portalId,
      connectedAt: new Date().toISOString(),
    });

    await db
      .update(users)
      .set({
        integrations: {
          ...currentIntegrations,
          hubspot: hubspotIntegration,
        },
      })
      .where(eq(users.id, userId));

    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?tab=integrations&success=HubSpot+connected+successfully",
        request.url
      )
    );
  } catch (error) {
    logger.error("HubSpot callback error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?tab=integrations&error=Failed+to+connect+HubSpot.+Please+try+again.",
        request.url
      )
    );
  }
}
