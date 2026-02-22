/**
 * Sync HubSpot Contacts — Inngest Background Job
 *
 * Periodically syncs high-intent leads (leadScore > 0) to HubSpot CRM
 * for users who have connected their HubSpot account.
 *
 * Runs every 30 minutes. For each connected user:
 * 1. Decrypts stored OAuth tokens
 * 2. Refreshes tokens if expired
 * 3. Finds recent results with lead scores > 0 that haven't been synced
 * 4. Upserts contacts to HubSpot in batches
 * 5. Marks results as synced via metadata
 */

import { inngest } from "../client";
import { pooledDb, users, results, monitors } from "@/lib/db";
import { eq, and, gt, inArray, sql } from "drizzle-orm";
import {
  upsertContact,
  resultToHubSpotContact,
  refreshAccessToken,
  isHubSpotConfigured,
} from "@/lib/integrations/hubspot";
import { decrypt, encrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

/** Shape of the HubSpot integration data stored in users.integrations.hubspot */
interface HubSpotIntegration {
  connected: boolean;
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO date string
  portalId?: number;
}

/** Maximum contacts to sync per user per run (avoid API rate limits) */
const BATCH_SIZE = 50;

/** Buffer before token expiry to trigger proactive refresh (5 minutes) */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const syncHubspotContacts = inngest.createFunction(
  {
    id: "sync-hubspot-contacts",
    name: "Sync HubSpot Contacts",
    retries: 2,
    timeouts: { finish: "10m" },
    concurrency: { limit: 2 },
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step }) => {
    // Guard: skip if HubSpot is not configured at the app level
    if (!isHubSpotConfigured()) {
      return { skipped: true, reason: "HubSpot not configured (missing client credentials)" };
    }

    // Step 1: Find all users with HubSpot connected
    const connectedUsers = await step.run("get-connected-users", async () => {
      // Query users where integrations JSONB has hubspot.connected = true
      const rows = await pooledDb
        .select({
          id: users.id,
          integrations: users.integrations,
        })
        .from(users)
        .where(
          sql`${users.integrations}->'hubspot'->>'connected' = 'true'`
        );

      return rows;
    });

    if (connectedUsers.length === 0) {
      return { skipped: true, reason: "No users with HubSpot connected" };
    }

    logger.info("HubSpot sync started", { userCount: connectedUsers.length });

    const syncResults: Array<{
      userId: string;
      synced: number;
      errors: number;
      skipped: boolean;
      reason?: string;
    }> = [];

    // Step 2: Process each connected user
    for (const user of connectedUsers) {
      const hubspot = (user.integrations as Record<string, unknown>)
        ?.hubspot as HubSpotIntegration | undefined;

      if (!hubspot?.accessToken || !hubspot?.refreshToken) {
        syncResults.push({
          userId: user.id,
          synced: 0,
          errors: 0,
          skipped: true,
          reason: "Missing tokens",
        });
        continue;
      }

      // Step 2a: Ensure we have a valid access token (refresh if needed)
      const validToken = await step.run(
        `refresh-token-${user.id}`,
        async () => {
          const expiresAt = new Date(hubspot.expiresAt);
          const now = new Date();

          // If token is still valid (with buffer), use it
          if (expiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS > now.getTime()) {
            return {
              accessToken: decrypt(hubspot.accessToken),
              refreshed: false,
            };
          }

          // Token expired or about to expire — refresh it
          try {
            const decryptedRefreshToken = decrypt(hubspot.refreshToken);
            const newTokens = await refreshAccessToken(decryptedRefreshToken);

            // Store the refreshed tokens back to the database (encrypted)
            const updatedHubspot: HubSpotIntegration = {
              ...hubspot,
              accessToken: encrypt(newTokens.accessToken),
              refreshToken: encrypt(newTokens.refreshToken),
              expiresAt: newTokens.expiresAt.toISOString(),
            };

            await pooledDb
              .update(users)
              .set({
                integrations: sql`jsonb_set(
                  COALESCE(${users.integrations}, '{}'::jsonb),
                  '{hubspot}',
                  ${JSON.stringify(updatedHubspot)}::jsonb
                )`,
                updatedAt: new Date(),
              })
              .where(eq(users.id, user.id));

            logger.info("HubSpot token refreshed", { userId: user.id });

            return {
              accessToken: newTokens.accessToken,
              refreshed: true,
            };
          } catch (error) {
            logger.error("HubSpot token refresh failed", {
              userId: user.id,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error; // Let Inngest retry
          }
        }
      );

      // Step 2b: Find recent results with lead scores > 0 that haven't been synced to HubSpot
      const leadsToSync = await step.run(
        `get-leads-${user.id}`,
        async () => {
          // Get all monitor IDs for this user
          const userMonitors = await pooledDb
            .select({ id: monitors.id })
            .from(monitors)
            .where(
              and(eq(monitors.userId, user.id), eq(monitors.isActive, true))
            );

          const monitorIds = userMonitors.map((m) => m.id);
          if (monitorIds.length === 0) return [];

          // Get results with lead score > 0 that haven't been synced
          // Use metadata.hubspotSyncedAt to track sync status
          const rows = await pooledDb.query.results.findMany({
            where: and(
              inArray(results.monitorId, monitorIds),
              gt(results.leadScore, 0),
              sql`(${results.metadata} IS NULL OR ${results.metadata}->>'hubspotSyncedAt' IS NULL)`
            ),
            orderBy: (results, { desc }) => [desc(results.leadScore)],
            limit: BATCH_SIZE,
          });

          return rows;
        }
      );

      if (leadsToSync.length === 0) {
        syncResults.push({
          userId: user.id,
          synced: 0,
          errors: 0,
          skipped: true,
          reason: "No new leads to sync",
        });
        continue;
      }

      // Step 2c: Upsert contacts to HubSpot in a single step (batched internally)
      const upsertResult = await step.run(
        `upsert-contacts-${user.id}`,
        async () => {
          let synced = 0;
          let errors = 0;
          const syncedResultIds: string[] = [];
          const failedResultIds: string[] = [];

          for (const result of leadsToSync) {
            try {
              const contact = resultToHubSpotContact({
                platform: result.platform,
                author: result.author || "Unknown",
                url: result.sourceUrl,
                title: result.title,
                content: result.content || undefined,
                sentiment: result.sentiment || undefined,
                leadScore: result.leadScore || undefined,
                createdAt: new Date(result.createdAt),
              });

              await upsertContact(validToken.accessToken, contact);
              syncedResultIds.push(result.id);
              synced++;
            } catch (error) {
              errors++;
              failedResultIds.push(result.id);
              logger.warn("HubSpot contact upsert failed", {
                userId: user.id,
                resultId: result.id,
                error:
                  error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Mark synced results so we don't sync them again
          if (syncedResultIds.length > 0) {
            await pooledDb
              .update(results)
              .set({
                metadata: sql`jsonb_set(
                  COALESCE(${results.metadata}, '{}'::jsonb),
                  '{hubspotSyncedAt}',
                  to_jsonb(now()::text)
                )`,
              })
              .where(inArray(results.id, syncedResultIds));
          }

          return { synced, errors, total: leadsToSync.length };
        }
      );

      syncResults.push({
        userId: user.id,
        synced: upsertResult.synced,
        errors: upsertResult.errors,
        skipped: false,
      });

      logger.info("HubSpot sync completed for user", {
        userId: user.id,
        synced: upsertResult.synced,
        errors: upsertResult.errors,
        total: upsertResult.total,
      });
    }

    const totalSynced = syncResults.reduce((sum, r) => sum + r.synced, 0);
    const totalErrors = syncResults.reduce((sum, r) => sum + r.errors, 0);

    logger.info("HubSpot sync run completed", {
      usersProcessed: connectedUsers.length,
      totalSynced,
      totalErrors,
    });

    return {
      usersProcessed: connectedUsers.length,
      totalSynced,
      totalErrors,
      details: syncResults,
    };
  }
);
