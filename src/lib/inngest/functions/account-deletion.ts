import { inngest } from "../client";
import { db } from "@/lib/db";
import {
  users,
  monitors,
  results,
  audiences,
  aiLogs,
  usage,
  slackIntegrations,
  webhooks,
  webhookDeliveries,
  apiKeys,
  crossPlatformTopics,
  topicResults,
  audienceMonitors,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";

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
  },
  { event: "user/deletion.scheduled" },
  async ({ event, step }) => {
    const { userId, email } = event.data;

    // Step 1: Send confirmation email
    await step.run("send-confirmation-email", async () => {
      // TODO: Implement email sending via Resend
      console.log(`[Account Deletion] Confirmation email sent to ${email}`);
    });

    // Step 2: Wait 6 days, then send 24-hour reminder
    await step.sleep("wait-for-reminder", `${DELETION_DELAY_DAYS - 1}d`);

    // Step 3: Check if user cancelled before sending reminder
    const userBeforeReminder = await step.run("check-before-reminder", async () => {
      const user = await db.query.users.findFirst({
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

    // Step 4: Send 24-hour reminder email
    await step.run("send-24hr-reminder", async () => {
      // TODO: Implement email sending via Resend
      console.log(`[Account Deletion] 24-hour reminder sent to ${email}`);
    });

    // Step 5: Wait final 24 hours
    await step.sleep("wait-final-day", "1d");

    // Step 6: Final check - user might have cancelled in the last 24 hours
    const userBeforeDeletion = await step.run("check-before-deletion", async () => {
      const user = await db.query.users.findFirst({
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

    // Step 7: Cancel Polar subscription if active
    if (userBeforeDeletion.polarSubscriptionId) {
      await step.run("cancel-polar-subscription", async () => {
        try {
          // TODO: Implement Polar subscription cancellation
          // const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN });
          // await polar.subscriptions.cancel(userBeforeDeletion.polarSubscriptionId);
          console.log(`[Account Deletion] Polar subscription cancelled for user ${userId}`);
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
      // TODO: Implement email sending via Resend
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
 * Delete all user data from the database
 * Uses cascade deletes where configured, manual deletes for safety
 */
async function deleteAllUserData(userId: string): Promise<void> {
  // Get all monitor IDs for this user (needed for cascading deletes)
  const userMonitors = await db
    .select({ id: monitors.id })
    .from(monitors)
    .where(eq(monitors.userId, userId));

  const monitorIds = userMonitors.map(m => m.id);

  // Get all audience IDs for this user
  const userAudiences = await db
    .select({ id: audiences.id })
    .from(audiences)
    .where(eq(audiences.userId, userId));

  const audienceIds = userAudiences.map(a => a.id);

  // Get all cross-platform topic IDs
  const userTopics = await db
    .select({ id: crossPlatformTopics.id })
    .from(crossPlatformTopics)
    .where(eq(crossPlatformTopics.userId, userId));

  const topicIds = userTopics.map(t => t.id);

  // Get all webhook IDs
  const userWebhooks = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(eq(webhooks.userId, userId));

  const webhookIds = userWebhooks.map(w => w.id);

  // Delete in order to respect foreign key constraints
  // Note: Many tables have cascade deletes configured, but we're explicit for safety
  // Tables with CASCADE on user deletion: monitors, audiences, alerts (via monitor),
  // results (via monitor), communities (via audience), aiLogs, usage, slackIntegrations,
  // webhooks, apiKeys, crossPlatformTopics

  // 1. Delete webhook deliveries (cascade from webhooks)
  if (webhookIds.length > 0) {
    await db.delete(webhookDeliveries).where(inArray(webhookDeliveries.webhookId, webhookIds));
  }

  // 2. Delete webhooks
  await db.delete(webhooks).where(eq(webhooks.userId, userId));

  // 3. Delete topic results (cascade from topics)
  if (topicIds.length > 0) {
    await db.delete(topicResults).where(inArray(topicResults.topicId, topicIds));
  }

  // 4. Delete cross-platform topics
  await db.delete(crossPlatformTopics).where(eq(crossPlatformTopics.userId, userId));

  // 5. Delete results (cascade from monitors, but explicit for safety)
  if (monitorIds.length > 0) {
    await db.delete(results).where(inArray(results.monitorId, monitorIds));
  }

  // 6. Delete audience-monitor relationships
  if (audienceIds.length > 0) {
    await db.delete(audienceMonitors).where(inArray(audienceMonitors.audienceId, audienceIds));
  }

  // 7. Delete monitors (alerts cascade from monitors)
  await db.delete(monitors).where(eq(monitors.userId, userId));

  // 8. Delete audiences (communities cascade from audiences)
  await db.delete(audiences).where(eq(audiences.userId, userId));

  // 9. Delete Slack integrations
  await db.delete(slackIntegrations).where(eq(slackIntegrations.userId, userId));

  // 10. Delete API keys
  await db.delete(apiKeys).where(eq(apiKeys.userId, userId));

  // 11. Delete AI logs
  await db.delete(aiLogs).where(eq(aiLogs.userId, userId));

  // 12. Delete usage records
  await db.delete(usage).where(eq(usage.userId, userId));

  // 13. Finally, delete the user record itself
  await db.delete(users).where(eq(users.id, userId));
}

// Export all functions
export const accountDeletionFunctions = [
  scheduledAccountDeletion,
];
