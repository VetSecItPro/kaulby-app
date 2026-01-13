import { inngest } from "../client";
import { db } from "@/lib/db";
import { webhooks, webhookDeliveries, users } from "@/lib/db/schema";
import { eq, and, lt, lte, or } from "drizzle-orm";
import crypto from "crypto";

// Exponential backoff delays in minutes: 1, 5, 15, 60, 240 (4 hours)
const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240];

interface WebhookPayload {
  eventType: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Generate HMAC signature for webhook payload
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Send a webhook event to all registered webhooks for a user
export const sendWebhookEvent = inngest.createFunction(
  {
    id: "send-webhook-event",
    name: "Send Webhook Event",
    retries: 0, // We handle retries ourselves with the delivery system
  },
  { event: "webhook/send" },
  async ({ event, step, logger }) => {
    const { userId, eventType, data } = event.data as {
      userId: string;
      eventType: string;
      data: Record<string, unknown>;
    };

    logger.info(`Sending webhook event ${eventType} for user ${userId}`);

    // Check if user is enterprise (only enterprise users can use webhooks)
    const user = await step.run("check-user-plan", async () => {
      return await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { subscriptionStatus: true },
      });
    });

    if (user?.subscriptionStatus !== "enterprise") {
      logger.info("User is not enterprise, skipping webhook delivery");
      return { success: false, reason: "not_enterprise" };
    }

    // Get all active webhooks for this user that subscribe to this event
    const userWebhooks = await step.run("get-user-webhooks", async () => {
      const allWebhooks = await db.query.webhooks.findMany({
        where: and(
          eq(webhooks.userId, userId),
          eq(webhooks.isActive, true)
        ),
      });

      // Filter webhooks that subscribe to this event type
      return allWebhooks.filter((webhook) => {
        const events = webhook.events as string[] | null;
        return events?.includes(eventType) || events?.includes("*");
      });
    });

    if (userWebhooks.length === 0) {
      logger.info("No active webhooks found for this event");
      return { success: true, deliveries: 0 };
    }

    // Create delivery records for each webhook
    const deliveryIds: string[] = [];

    for (const webhook of userWebhooks) {
      const deliveryId = await step.run(`create-delivery-${webhook.id}`, async () => {
        const payload: WebhookPayload = {
          eventType,
          data,
          timestamp: new Date().toISOString(),
        };

        const [delivery] = await db
          .insert(webhookDeliveries)
          .values({
            webhookId: webhook.id,
            eventType,
            payload,
            status: "pending",
            attemptCount: 0,
            maxAttempts: 5,
          })
          .returning({ id: webhookDeliveries.id });

        return delivery.id;
      });

      deliveryIds.push(deliveryId);
    }

    // Trigger processing for each delivery
    for (const deliveryId of deliveryIds) {
      await step.sendEvent("process-delivery", {
        name: "webhook/process-delivery",
        data: { deliveryId },
      });
    }

    logger.info(`Created ${deliveryIds.length} webhook deliveries`);

    return { success: true, deliveries: deliveryIds.length };
  }
);

// Process a single webhook delivery attempt
export const processWebhookDelivery = inngest.createFunction(
  {
    id: "process-webhook-delivery",
    name: "Process Webhook Delivery",
    retries: 0,
    concurrency: {
      limit: 10, // Limit concurrent webhook deliveries
    },
  },
  { event: "webhook/process-delivery" },
  async ({ event, step, logger }) => {
    const { deliveryId } = event.data as { deliveryId: string };

    logger.info(`Processing webhook delivery ${deliveryId}`);

    // Get the delivery and webhook details
    const delivery = await step.run("get-delivery", async () => {
      return await db.query.webhookDeliveries.findFirst({
        where: eq(webhookDeliveries.id, deliveryId),
        with: {
          webhook: true,
        },
      });
    });

    if (!delivery) {
      logger.error("Delivery not found");
      return { success: false, reason: "not_found" };
    }

    if (delivery.status === "success") {
      logger.info("Delivery already successful");
      return { success: true, reason: "already_delivered" };
    }

    if (delivery.attemptCount >= delivery.maxAttempts) {
      logger.info("Max attempts reached, marking as failed");
      await step.run("mark-failed", async () => {
        await db
          .update(webhookDeliveries)
          .set({
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(webhookDeliveries.id, deliveryId));
      });
      return { success: false, reason: "max_attempts" };
    }

    const webhook = delivery.webhook;
    const payload = JSON.stringify(delivery.payload);

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": delivery.eventType,
      "X-Webhook-Delivery-Id": deliveryId,
      ...(webhook.headers as Record<string, string> || {}),
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      headers["X-Webhook-Signature"] = `sha256=${generateSignature(payload, webhook.secret)}`;
    }

    // Attempt delivery
    const result = await step.run("attempt-delivery", async () => {
      const newAttemptCount = delivery.attemptCount + 1;

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: payload,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        const responseBody = await response.text().catch(() => "");

        if (response.ok) {
          // Success
          await db
            .update(webhookDeliveries)
            .set({
              status: "success",
              statusCode: response.status,
              responseBody: responseBody.substring(0, 1000), // Limit response size
              attemptCount: newAttemptCount,
              completedAt: new Date(),
            })
            .where(eq(webhookDeliveries.id, deliveryId));

          return { success: true, statusCode: response.status };
        } else {
          // HTTP error
          const retryDelayMinutes = RETRY_DELAYS_MINUTES[Math.min(newAttemptCount - 1, RETRY_DELAYS_MINUTES.length - 1)];
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + retryDelayMinutes);

          await db
            .update(webhookDeliveries)
            .set({
              status: newAttemptCount >= delivery.maxAttempts ? "failed" : "retrying",
              statusCode: response.status,
              responseBody: responseBody.substring(0, 1000),
              errorMessage: `HTTP ${response.status}: ${response.statusText}`,
              attemptCount: newAttemptCount,
              nextRetryAt: newAttemptCount < delivery.maxAttempts ? nextRetry : null,
              completedAt: newAttemptCount >= delivery.maxAttempts ? new Date() : null,
            })
            .where(eq(webhookDeliveries.id, deliveryId));

          return {
            success: false,
            statusCode: response.status,
            retry: newAttemptCount < delivery.maxAttempts,
          };
        }
      } catch (error) {
        // Network or timeout error
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const retryDelayMinutes = RETRY_DELAYS_MINUTES[Math.min(newAttemptCount - 1, RETRY_DELAYS_MINUTES.length - 1)];
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + retryDelayMinutes);

        await db
          .update(webhookDeliveries)
          .set({
            status: newAttemptCount >= delivery.maxAttempts ? "failed" : "retrying",
            errorMessage,
            attemptCount: newAttemptCount,
            nextRetryAt: newAttemptCount < delivery.maxAttempts ? nextRetry : null,
            completedAt: newAttemptCount >= delivery.maxAttempts ? new Date() : null,
          })
          .where(eq(webhookDeliveries.id, deliveryId));

        return {
          success: false,
          error: errorMessage,
          retry: newAttemptCount < delivery.maxAttempts,
        };
      }
    });

    logger.info(`Delivery result: ${JSON.stringify(result)}`);

    return result;
  }
);

// Retry pending webhook deliveries (runs every minute)
export const retryWebhookDeliveries = inngest.createFunction(
  {
    id: "retry-webhook-deliveries",
    name: "Retry Webhook Deliveries",
    retries: 3,
  },
  { cron: "* * * * *" }, // Run every minute
  async ({ step, logger }) => {
    const now = new Date();

    // Find deliveries that need to be retried
    const pendingRetries = await step.run("get-pending-retries", async () => {
      return await db.query.webhookDeliveries.findMany({
        where: and(
          eq(webhookDeliveries.status, "retrying"),
          lte(webhookDeliveries.nextRetryAt, now)
        ),
        columns: { id: true },
        limit: 100, // Process up to 100 at a time
      });
    });

    if (pendingRetries.length === 0) {
      return { success: true, retried: 0 };
    }

    logger.info(`Found ${pendingRetries.length} deliveries to retry`);

    // Trigger processing for each delivery
    for (const delivery of pendingRetries) {
      await step.sendEvent(`retry-${delivery.id}`, {
        name: "webhook/process-delivery",
        data: { deliveryId: delivery.id },
      });
    }

    return { success: true, retried: pendingRetries.length };
  }
);

// Clean up old webhook delivery records (runs weekly)
export const cleanupWebhookDeliveries = inngest.createFunction(
  {
    id: "cleanup-webhook-deliveries",
    name: "Cleanup Webhook Deliveries",
    retries: 3,
  },
  { cron: "0 2 * * 0" }, // Run weekly on Sunday at 2 AM UTC
  async ({ step, logger }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await step.run("delete-old-deliveries", async () => {
      const result = await db
        .delete(webhookDeliveries)
        .where(
          and(
            lt(webhookDeliveries.createdAt, thirtyDaysAgo),
            or(
              eq(webhookDeliveries.status, "success"),
              eq(webhookDeliveries.status, "failed")
            )
          )
        )
        .returning({ id: webhookDeliveries.id });

      return result.length;
    });

    logger.info(`Deleted ${deleted} old webhook deliveries`);

    return { success: true, deleted };
  }
);
