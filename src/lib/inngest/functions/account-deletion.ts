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
      console.log(`[Account Deletion] Confirmation email sent to ${email}`);
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
      console.log(`[Account Deletion] User ${userId} cancelled deletion before reminder`);
      return { status: "cancelled", reason: "User cancelled before reminder" };
    }

    // Step 4: Send 24-hour reminder email (with win-back messaging)
    await step.run("send-24hr-reminder", async () => {
      await sendDeletionReminderEmail({
        email,
        name: userName,
      });
      console.log(`[Account Deletion] 24-hour reminder sent to ${email}`);
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
      console.log(`[Account Deletion] User ${userId} cancelled deletion in final 24 hours`);
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
            console.log(`[Account Deletion] Polar subscription revoked for user ${userId}`);
          } else {
            console.warn(`[Account Deletion] Could not revoke Polar subscription for user ${userId}`);
          }
        } catch (error) {
          console.error(`[Account Deletion] Failed to cancel Polar subscription:`, error);
          // Don't fail the deletion if Polar cancellation fails
        }
      });
    }

    // Step 8: Delete all user data from database
    await step.run("delete-user-data", async () => {
      await deleteAllUserData(userId);
      console.log(`[Account Deletion] All data deleted for user ${userId}`);
    });

    // Step 9: Delete user from Clerk
    await step.run("delete-from-clerk", async () => {
      try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(userId);
        console.log(`[Account Deletion] User ${userId} deleted from Clerk`);
      } catch (error) {
        console.error(`[Account Deletion] Failed to delete from Clerk:`, error);
        // Log but don't fail - the user data is already deleted
      }
    });

    // Step 10: Send final confirmation email (to the email we saved before deletion)
    await step.run("send-final-confirmation", async () => {
      await sendDeletionConfirmedEmail({
        email,
        name: userName,
      });
      console.log(`[Account Deletion] Final confirmation sent to ${email}`);
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
  console.log(`[Account Deletion] Starting comprehensive data deletion for user ${userId}`);

  // =========================================================================
  // PHASE 1: Gather all related IDs before deletion
  // =========================================================================

  // Get all monitor IDs for this user
  const userMonitors = await pooledDb
    .select({ id: monitors.id })
    .from(monitors)
    .where(eq(monitors.userId, userId));
  const monitorIds = userMonitors.map(m => m.id);
  console.log(`[Account Deletion] Found ${monitorIds.length} monitors to delete`);

  // Get all audience IDs for this user
  const userAudiences = await pooledDb
    .select({ id: audiences.id })
    .from(audiences)
    .where(eq(audiences.userId, userId));
  const audienceIds = userAudiences.map(a => a.id);
  console.log(`[Account Deletion] Found ${audienceIds.length} audiences to delete`);

  // Get all webhook IDs
  const userWebhooks = await pooledDb
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(eq(webhooks.userId, userId));
  const webhookIds = userWebhooks.map(w => w.id);
  console.log(`[Account Deletion] Found ${webhookIds.length} webhooks to delete`);

  // =========================================================================
  // PHASE 2: Delete data in correct order (deepest dependencies first)
  // =========================================================================

  // --- Webhook-related data ---
  // 1. Delete webhook delivery logs (foreign key to webhooks)
  if (webhookIds.length > 0) {
    await pooledDb.delete(webhookDeliveries).where(inArray(webhookDeliveries.webhookId, webhookIds));
    console.log(`[Account Deletion] Deleted webhook deliveries`);
  }

  // 2. Delete webhooks
  await pooledDb.delete(webhooks).where(eq(webhooks.userId, userId));
  console.log(`[Account Deletion] Deleted webhooks`);

  // --- Monitor-related data ---
  // 3. Delete alerts (foreign key to monitors)
  if (monitorIds.length > 0) {
    await pooledDb.delete(alerts).where(inArray(alerts.monitorId, monitorIds));
    console.log(`[Account Deletion] Deleted alerts`);
  }

  // 6. Delete results (foreign key to monitors) - includes all historical mention data
  if (monitorIds.length > 0) {
    await pooledDb.delete(results).where(inArray(results.monitorId, monitorIds));
    console.log(`[Account Deletion] Deleted results`);
  }

  // 7. Delete audience-monitor junction records
  if (audienceIds.length > 0) {
    await pooledDb.delete(audienceMonitors).where(inArray(audienceMonitors.audienceId, audienceIds));
    console.log(`[Account Deletion] Deleted audience-monitor relationships`);
  }

  // 8. Delete monitors
  await pooledDb.delete(monitors).where(eq(monitors.userId, userId));
  console.log(`[Account Deletion] Deleted monitors`);

  // --- Audience-related data ---
  // 9. Delete communities (foreign key to audiences)
  if (audienceIds.length > 0) {
    await pooledDb.delete(communities).where(inArray(communities.audienceId, audienceIds));
    console.log(`[Account Deletion] Deleted communities`);
  }

  // 10. Delete audiences
  await pooledDb.delete(audiences).where(eq(audiences.userId, userId));
  console.log(`[Account Deletion] Deleted audiences`);

  // --- Integration data ---
  // 11. Delete API keys (hashed keys and metadata)
  await pooledDb.delete(apiKeys).where(eq(apiKeys.userId, userId));
  console.log(`[Account Deletion] Deleted API keys`);

  // --- Analytics and logs ---
  // 13. Delete AI logs (AI analysis history, prompts, responses)
  await pooledDb.delete(aiLogs).where(eq(aiLogs.userId, userId));
  console.log(`[Account Deletion] Deleted AI logs`);

  // 14. Delete usage records (API call counts, limits tracking)
  await pooledDb.delete(usage).where(eq(usage.userId, userId));
  console.log(`[Account Deletion] Deleted usage records`);

  // =========================================================================
  // PHASE 3: Handle workspace ownership and membership
  // =========================================================================

  // Check if this user owns any workspaces
  const { workspaces: workspacesTable, workspaceInvites } = await import("@/lib/db/schema");
  const ownedWorkspaces = await pooledDb
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerId, userId));

  for (const workspace of ownedWorkspaces) {
    // Delete workspace invites first (foreign key to workspace)
    await pooledDb.delete(workspaceInvites).where(eq(workspaceInvites.workspaceId, workspace.id));

    // Remove workspace reference from all member users
    await pooledDb
      .update(users)
      .set({ workspaceId: null, workspaceRole: null })
      .where(eq(users.workspaceId, workspace.id));

    // Delete the workspace
    await pooledDb.delete(workspacesTable).where(eq(workspacesTable.id, workspace.id));
    console.log(`[Account Deletion] Deleted owned workspace ${workspace.id}`);
  }

  // =========================================================================
  // PHASE 4: Delete the user record itself
  // =========================================================================

  // 15. Finally, delete the user record (contains PII: email, name, etc.)
  await pooledDb.delete(users).where(eq(users.id, userId));
  console.log(`[Account Deletion] Deleted user record`);

  console.log(`[Account Deletion] ✓ All data deleted for user ${userId}`);
}

// Export all functions
export const accountDeletionFunctions = [
  scheduledAccountDeletion,
];
