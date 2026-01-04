import { inngest } from "../client";
import { db, alerts, results } from "@/lib/db";
import { eq, and, gte, inArray } from "drizzle-orm";
import { sendAlertEmail, sendDigestEmail } from "@/lib/loops";

// Send instant alert
export const sendAlert = inngest.createFunction(
  {
    id: "send-alert",
    name: "Send Alert",
    retries: 3,
  },
  { event: "alert/send" },
  async ({ event, step }) => {
    const { alertId, resultIds } = event.data;

    // Get alert configuration
    const alert = await step.run("get-alert", async () => {
      return db.query.alerts.findFirst({
        where: eq(alerts.id, alertId),
        with: {
          monitor: {
            with: {
              user: true,
            },
          },
        },
      });
    });

    if (!alert || !alert.isActive) {
      return { skipped: true, reason: "Alert not found or inactive" };
    }

    // Get the results
    const matchingResults = await step.run("get-results", async () => {
      return db.query.results.findMany({
        where: inArray(results.id, resultIds),
      });
    });

    if (matchingResults.length === 0) {
      return { skipped: true, reason: "No results to send" };
    }

    // Send based on channel
    if (alert.channel === "email") {
      await step.run("send-email", async () => {
        await sendAlertEmail({
          to: alert.destination,
          monitorName: alert.monitor.name,
          results: matchingResults.map((r) => ({
            title: r.title,
            url: r.sourceUrl,
            platform: r.platform,
            sentiment: r.sentiment,
            summary: r.aiSummary,
          })),
        });
      });
    }

    // TODO: Implement Slack and in-app notifications

    return {
      sent: true,
      channel: alert.channel,
      resultsCount: matchingResults.length,
    };
  }
);

// Send daily/weekly digest
export const sendDigest = inngest.createFunction(
  {
    id: "send-digest",
    name: "Send Alert Digest",
    retries: 3,
  },
  { cron: "0 9 * * *" }, // Daily at 9 AM
  async ({ step }) => {
    // Get all users with active daily alerts
    const usersWithAlerts = await step.run("get-users", async () => {
      return db.query.users.findMany({
        with: {
          monitors: {
            with: {
              alerts: {
                where: and(
                  eq(alerts.isActive, true),
                  eq(alerts.frequency, "daily")
                ),
              },
              results: {
                where: gte(
                  results.createdAt,
                  new Date(Date.now() - 24 * 60 * 60 * 1000)
                ),
              },
            },
          },
        },
      });
    });

    let digestsSent = 0;

    for (const user of usersWithAlerts) {
      const allResults = user.monitors.flatMap((m) => m.results);

      if (allResults.length === 0) continue;

      const emailAlerts = user.monitors
        .flatMap((m) => m.alerts)
        .filter((a) => a.channel === "email");

      if (emailAlerts.length === 0) continue;

      await step.run(`send-digest-${user.id}`, async () => {
        await sendDigestEmail({
          to: user.email,
          userName: user.name || "there",
          frequency: "daily",
          monitors: user.monitors.map((m) => ({
            name: m.name,
            resultsCount: m.results.length,
            topResults: m.results.slice(0, 3).map((r) => ({
              title: r.title,
              url: r.sourceUrl,
              platform: r.platform,
              sentiment: r.sentiment,
              summary: r.aiSummary,
            })),
          })),
        });

        digestsSent++;
      });
    }

    return {
      digestsSent,
    };
  }
);
