/**
 * Export Lead to HubSpot API Route
 *
 * POST - Export a result as a lead/contact to HubSpot
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users, results } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  upsertContact,
  resultToHubSpotContact,
  refreshAccessToken,
} from "@/lib/integrations/hubspot";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { resultId } = body;

    if (!resultId) {
      return NextResponse.json(
        { error: "Result ID is required" },
        { status: 400 }
      );
    }

    // Get user's HubSpot integration
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const integrations = (user?.integrations as Record<string, unknown>) || {};
    const hubspot = integrations.hubspot as {
      connected: boolean;
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    } | undefined;

    if (!hubspot?.connected) {
      return NextResponse.json(
        { error: "HubSpot is not connected" },
        { status: 400 }
      );
    }

    // Check if token needs refresh
    let accessToken = hubspot.accessToken;
    if (new Date(hubspot.expiresAt) < new Date()) {
      try {
        const newTokens = await refreshAccessToken(hubspot.refreshToken);
        accessToken = newTokens.accessToken;

        // Update stored tokens
        await db
          .update(users)
          .set({
            integrations: {
              ...integrations,
              hubspot: {
                ...hubspot,
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                expiresAt: newTokens.expiresAt.toISOString(),
              },
            },
          })
          .where(eq(users.id, userId));
      } catch {
        return NextResponse.json(
          { error: "HubSpot token expired. Please reconnect." },
          { status: 401 }
        );
      }
    }

    // Get the result
    const result = await db.query.results.findFirst({
      where: eq(results.id, resultId),
    });

    if (!result) {
      return NextResponse.json(
        { error: "Result not found" },
        { status: 404 }
      );
    }

    // Convert to HubSpot contact
    const contactData = resultToHubSpotContact({
      platform: result.platform,
      author: result.author || "Unknown",
      url: result.sourceUrl,
      title: result.title || undefined,
      content: result.content || undefined,
      sentiment: result.sentiment || undefined,
      leadScore: result.leadScore || undefined,
      createdAt: result.createdAt,
    });

    // Create/update contact in HubSpot
    const { id: contactId, isNew } = await upsertContact(accessToken, contactData);

    // Mark result as exported
    await db
      .update(results)
      .set({
        metadata: {
          ...(result.metadata as Record<string, unknown> || {}),
          hubspotContactId: contactId,
          hubspotExportedAt: new Date().toISOString(),
        },
      })
      .where(eq(results.id, resultId));

    return NextResponse.json({
      success: true,
      contactId,
      isNew,
      message: isNew
        ? "Contact created in HubSpot"
        : "Contact updated in HubSpot",
    });
  } catch (error) {
    console.error("Error exporting to HubSpot:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export to HubSpot",
      },
      { status: 500 }
    );
  }
}
