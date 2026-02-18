import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import {
  users,
  monitors,
  results,
  audiences,
  aiLogs,
  usage,
  webhooks,
  webhookDeliveries,
  apiKeys,
  audienceMonitors,
  alerts,
  communities,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import {
  sendDeletionRequestedEmail,
  sendDeletionReminderEmail,
  sendDeletionConfirmedEmail,
} from "@/lib/email";
import { cancelSubscription } from "@/lib/polar";
import { logger } from "@/lib/logger";

const DELETION_DELAY_DAYS = 7;

/**
 * Main account deletion function - triggered when user requests deletion
 * Waits 7 days, then executes deletion if not cancelled
 */
export const scheduledAccountDeletion = inngest.createFunction(
  {
    id: "user-deletion-scheduled",
    name: "Scheduled Account Deletion",
    retries: 3,
    timeouts: { finish: "5m" },
  },
  { event: "user/deletion.scheduled" },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    // Step 1: Get user name for personalized emails
    const userData = await step.run("get-user-data", async () => {
      const user = await pooledDb.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true },
      });
      return user;
    });

    const userName = userData?.name || undefined;
    const deletionDate = new Date(new Date().getTime() + DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000);

    // Step 2: Send confirmation email
    await step.run("send-confirmation-email", async () => {
      await sendDeletionRequestedEmail({
        email,
        name: userName,
        deletionDate,
      });
      logger.info("[Account Deletion] Confirmation email sent", { email });
    });

    // Step 2: Wait 6 days, then send 24-hour reminder
    await step.sleep("wait-for-reminder", `${DELETION_DELAY_DAYS - 1}d`);

    // Step 3: Check if user cancelled before sending reminder
    const userBeforeReminder = await step.run("check-before-reminder", async () => {
      const user = await pooledDb.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { deletionRequestedAt: true, email: true },
      });
      return user;
    });

    if (!userBeforeReminder?.deletionRequestedAt) {
      // User cancelled deletion
      logger.info("[Account Deletion] User cancelled deletion before reminder", { userId });
      return { status: "cancelled", reason: "User cancelled before reminder" };
    }

    // Step 4: Send 24-hour reminder email (with win-back messaging)
    await step.run("send-24hr-reminder", async () => {
      await sendDeletionReminderEmail({
        email,
        name: userName,
      });
      logger.info("[Account Deletion] 24-hour reminder sent", { email });
    });

    // Step 5: Wait final 24 hours
    await step.sleep("wait-final-day", "1d");

    // Step 6: Final check - user might have cancelled in the last 24 hours
    const userBeforeDeletion = await step.run("check-before-deletion", async () => {
      const user = await pooledDb.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          deletionRequestedAt: true,
          email: true,
          polarSubscriptionId: true,
          polarCustomerId: true,
        },
      });
      return user;
    });

    if (!userBeforeDeletion?.deletionRequestedAt) {
      // User cancelled deletion
      logger.info("[Account Deletion] User cancelled deletion in final 24 hours", { userId });
      return { status: "cancelled", reason: "User cancelled in final 24 hours" };
    }

    // Step 7: Cancel Polar subscription if active (immediate revocation for account deletion)
    if (userBeforeDeletion.polarSubscriptionId) {
      await step.run("cancel-polar-subscription", async () => {
        try {
          const cancelled = await cancelSubscription(
            userBeforeDeletion.polarSubscriptionId!,
            { immediate: true }
          );
          if (cancelled) {
            logger.info("[Account Deletion] Polar subscription revoked", { userId });
          } else {
            logger.warn("[Account Deletion] Could not revoke Polar subscription", { userId });
          }
        } catch (error) {
          logger.error("[Account Deletion] Failed to cancel Polar subscription", { userId, error: error instanceof Error ? error.message : String(error) });
          // Don't fail the deletion if Polar cancellation fails
        }
      });
    }

    // Step 8: Delete all user data from database (FIX-111: uses transaction for atomicity)
    await step.run("delete-user-data", async () => {
      await deleteAllUserData(userId);
      logger.info("[Account Deletion] All data deleted", { userId });
    });

    // Step 9: Delete user from Clerk
    await step.run("delete-from-clerk", async () => {
      try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(userId);
        logger.info("[Account Deletion] User deleted from Clerk", { userId });
      } catch (error) {
        logger.error("[Account Deletion] Failed to delete from Clerk", { userId, error: error instanceof Error ? error.message : String(error) });
        // Log but don't fail - the user data is already deleted
      }
    });

    // Step 10: Send final confirmation email (to the email we saved before deletion)
    await step.run("send-final-confirmation", async () => {
      await sendDeletionConfirmedEmail({
        email,
        name: userName,
      });
      logger.info("[Account Deletion] Final confirmation sent", { email });
    });

    return {
      status: "completed",
      userId,
      deletedAt: new Date().toISOString()
    };
  }
);

/**
 * Delete all user data from the database - GDPR/CCPA compliant
 *
 * This function performs a comprehensive deletion of ALL user data as required by:
 * - GDPR Article 17 (Right to Erasure / "Right to be Forgotten")
 * - CCPA Section 1798.105 (Right to Deletion)
 *
 * Deletion order matters due to foreign key constraints.
 * We explicitly delete from all tables rather than relying solely on CASCADE
 * to ensure complete data removal and provide an audit trail.
 */
async function deleteAllUserData(userId: string): Promise<void> {
  logger.info("[Account Deletion] Starting comprehensive data deletion", { userId });

  // FIX-111: Wrap entire deletion in a transaction for atomicity
  await pooledDb.transaction(async (tx) => {
    // PHASE 1: Gather all related IDs before deletion
    const userMonitors = await tx
      .select({ id: monitors.id })
      .from(monitors)
      .where(eq(monitors.userId, userId));
    const monitorIds = userMonitors.map(m => m.id);

    const userAudiences = await tx
      .select({ id: audiences.id })
      .from(audiences)
      .where(eq(audiences.userId, userId));
    const audienceIds = userAudiences.map(a => a.id);

    const userWebhookRows = await tx
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(eq(webhooks.userId, userId));
    const webhookIds = userWebhookRows.map(w => w.id);

    // PHASE 2: Delete data in correct order (deepest dependencies first)
    if (webhookIds.length > 0) {
      await tx.delete(webhookDeliveries).where(inArray(webhookDeliveries.webhookId, webhookIds));
    }
    await tx.delete(webhooks).where(eq(webhooks.userId, userId));

    if (monitorIds.length > 0) {
      await tx.delete(alerts).where(inArray(alerts.monitorId, monitorIds));
      await tx.delete(results).where(inArray(results.monitorId, monitorIds));
    }

    if (audienceIds.length > 0) {
      await tx.delete(audienceMonitors).where(inArray(audienceMonitors.audienceId, audienceIds));
    }

    await tx.delete(monitors).where(eq(monitors.userId, userId));

    if (audienceIds.length > 0) {
      await tx.delete(communities).where(inArray(communities.audienceId, audienceIds));
    }
    await tx.delete(audiences).where(eq(audiences.userId, userId));

    await tx.delete(apiKeys).where(eq(apiKeys.userId, userId));
    await tx.delete(aiLogs).where(eq(aiLogs.userId, userId));
    await tx.delete(usage).where(eq(usage.userId, userId));

    // PHASE 3: Handle workspace ownership and membership
    const { workspaces: workspacesTable, workspaceInvites } = await import("@/lib/db/schema");
    const ownedWorkspaces = await tx
      .select({ id: workspacesTable.id })
      .from(workspacesTable)
      .where(eq(workspacesTable.ownerId, userId));

    for (const workspace of ownedWorkspaces) {
      await tx.delete(workspaceInvites).where(eq(workspaceInvites.workspaceId, workspace.id));
      await tx
        .update(users)
        .set({ workspaceId: null, workspaceRole: null })
        .where(eq(users.workspaceId, workspace.id));
      await tx.delete(workspacesTable).where(eq(workspacesTable.id, workspace.id));
    }

    // PHASE 4: Delete the user record itself
    await tx.delete(users).where(eq(users.id, userId));
  });

  logger.info("[Account Deletion] All data deleted", { userId });
}

// Export all functions
export const accountDeletionFunctions = [
  scheduledAccountDeletion,
];
