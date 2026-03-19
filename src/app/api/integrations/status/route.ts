import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decryptIntegrationData } from "@/lib/encryption";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

interface IntegrationStatus {
  connected: boolean;
  connectedAt?: string;
  accountName?: string;
  channelConfigured?: boolean;
}

/**
 * GET /api/integrations/status
 * Returns connection status for all integrations (without exposing tokens).
 */
export async function GET() {
  try {
    const userId = await getEffectiveUserId();
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
    const status: Record<string, IntegrationStatus> = {};

    for (const provider of ["discord", "slack", "hubspot", "teams"] as const) {
      const data = integrations[provider] as Record<string, unknown> | undefined;
      if (!data || !data.connected) {
        status[provider] = { connected: false };
        continue;
      }

      const decrypted = decryptIntegrationData(data);

      status[provider] = {
        connected: true,
        connectedAt: (data.connectedAt as string) || undefined,
        accountName:
          (data.guildName as string) ||
          (data.teamName as string) ||
          (data.portalId ? `Portal ${data.portalId}` : undefined) ||
          (provider === "teams" ? "Microsoft Teams" : undefined) ||
          undefined,
      };

      if (provider === "discord" && status[provider].connected) {
        status[provider].channelConfigured = !!(data.channelId);
      }

      if (!decrypted.accessToken && provider !== "slack" && provider !== "teams") {
        status[provider] = { connected: false };
      }
      if (provider === "slack" && !decrypted.accessToken && !decrypted.webhookUrl) {
        status[provider] = { connected: false };
      }
      if (provider === "teams" && !decrypted.webhookUrl) {
        status[provider] = { connected: false };
      }
    }

    return NextResponse.json({ integrations: status });
  } catch (error) {
    logger.error("Error fetching integration status:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Failed to fetch integration status" }, { status: 500 });
  }
}
