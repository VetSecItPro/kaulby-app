import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decryptIntegrationData } from "@/lib/encryption";
import { checkApiRateLimit } from "@/lib/rate-limit";

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
  const status: Record<string, IntegrationStatus> = {};

  for (const provider of ["discord", "slack", "hubspot"] as const) {
    const data = integrations[provider] as Record<string, unknown> | undefined;
    if (!data || !data.connected) {
      status[provider] = { connected: false };
      continue;
    }

    // Decrypt to verify tokens are present and valid
    const decrypted = decryptIntegrationData(data);

    status[provider] = {
      connected: true,
      connectedAt: (data.connectedAt as string) || undefined,
      // Return display-safe info only — never expose tokens
      accountName:
        (data.guildName as string) ||    // Discord
        (data.teamName as string) ||     // Slack
        (data.portalId ? `Portal ${data.portalId}` : undefined) || // HubSpot
        undefined,
    };

    // For Discord, indicate whether a channel has been configured for alerts
    if (provider === "discord" && status[provider].connected) {
      status[provider].channelConfigured = !!(data.channelId);
    }

    // If token is missing/corrupt, mark as disconnected
    if (!decrypted.accessToken && provider !== "slack") {
      status[provider] = { connected: false };
    }
    // Slack uses webhookUrl instead of accessToken
    if (provider === "slack" && !decrypted.accessToken && !decrypted.webhookUrl) {
      status[provider] = { connected: false };
    }
  }

  return NextResponse.json({ integrations: status });
}
