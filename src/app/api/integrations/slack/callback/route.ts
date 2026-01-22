/**
 * Slack OAuth Callback Handler
 *
 * Handles the redirect from Slack after user authorizes the integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { exchangeCodeForTokens } from "@/lib/integrations/slack";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle error from Slack
    if (error) {
      console.error("Slack OAuth error:", error);
      return NextResponse.redirect(
        new URL(
          `/dashboard/settings?tab=integrations&error=${encodeURIComponent(
            error === "access_denied" ? "Access denied by user" : error
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
    const slackData = (currentIntegrations.slack as Record<string, unknown>) || {};

    if (slackData.pendingState !== state) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?tab=integrations&error=State+mismatch",
          request.url
        )
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens and mark as connected
    await db
      .update(users)
      .set({
        integrations: {
          ...currentIntegrations,
          slack: {
            connected: true,
            accessToken: tokens.accessToken,
            teamId: tokens.teamId,
            teamName: tokens.teamName,
            webhookUrl: tokens.webhookUrl,
            webhookChannel: tokens.webhookChannel,
            webhookChannelId: tokens.webhookChannelId,
            connectedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(users.id, userId));

    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?tab=integrations&success=Slack+connected+successfully",
        request.url
      )
    );
  } catch (error) {
    console.error("Slack callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?tab=integrations&error=${encodeURIComponent(
          error instanceof Error ? error.message : "Failed to connect Slack"
        )}`,
        request.url
      )
    );
  }
}
