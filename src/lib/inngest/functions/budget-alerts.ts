import { inngest } from "../client";
import { db } from "@/lib/db";
import { budgetAlerts, budgetAlertHistory, aiLogs } from "@/lib/db/schema";
import { eq, gte, and, sum, sql } from "drizzle-orm";

/**
 * Check budget alerts and send notifications when thresholds are hit
 * Runs every hour to check daily/weekly/monthly spend against configured limits
 */
export const checkBudgetAlerts = inngest.createFunction(
  {
    id: "check-budget-alerts",
    name: "Check Budget Alerts",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Get all active budget alerts
    const activeAlerts = await step.run("get-active-alerts", async () => {
      return db.query.budgetAlerts.findMany({
        where: eq(budgetAlerts.isActive, true),
      });
    });

    if (activeAlerts.length === 0) {
      return { checked: 0, triggered: 0 };
    }

    const results: { alertId: string; triggered: boolean; type?: string }[] = [];

    for (const alert of activeAlerts) {
      const result = await step.run(`check-alert-${alert.id}`, async () => {
        // Calculate period boundaries
        const now = new Date();
        let periodStart: Date;
        const periodEnd: Date = now;

        switch (alert.period) {
          case "daily":
            periodStart = new Date(now);
            periodStart.setHours(0, 0, 0, 0);
            break;
          case "weekly":
            periodStart = new Date(now);
            periodStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
            periodStart.setHours(0, 0, 0, 0);
            break;
          case "monthly":
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            periodStart = new Date(now);
            periodStart.setHours(0, 0, 0, 0);
        }

        // Get total AI spend for the period
        const [spendResult] = await db
          .select({
            totalSpend: sum(aiLogs.costUsd),
          })
          .from(aiLogs)
          .where(
            and(
              gte(aiLogs.createdAt, periodStart),
              sql`${aiLogs.createdAt} <= ${periodEnd}`
            )
          );

        const currentSpend = Number(spendResult?.totalSpend) || 0;
        const percentOfThreshold = (currentSpend / alert.thresholdUsd) * 100;

        // Update current period spend
        await db
          .update(budgetAlerts)
          .set({
            currentPeriodSpend: currentSpend,
            updatedAt: now,
          })
          .where(eq(budgetAlerts.id, alert.id));

        // Determine if we should alert
        const warningThreshold = alert.warningPercent;
        const isExceeded = percentOfThreshold >= 100;
        const isWarning = percentOfThreshold >= warningThreshold && percentOfThreshold < 100;

        // Check if we already notified recently (within 4 hours for same alert type)
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
        const recentNotification = alert.lastNotifiedAt &&
          new Date(alert.lastNotifiedAt).getTime() > fourHoursAgo.getTime();

        if ((isExceeded || isWarning) && !recentNotification) {
          const alertType = isExceeded ? "exceeded" : "warning";

          // Log to history
          await db.insert(budgetAlertHistory).values({
            alertId: alert.id,
            periodStart,
            periodEnd,
            spendUsd: currentSpend,
            thresholdUsd: alert.thresholdUsd,
            percentOfThreshold,
            alertType,
            notificationSent: false,
          });

          // Update last triggered
          await db
            .update(budgetAlerts)
            .set({
              lastTriggeredAt: now,
              lastNotifiedAt: now,
              updatedAt: now,
            })
            .where(eq(budgetAlerts.id, alert.id));

          // Send notifications
          await sendBudgetNotification(alert, currentSpend, percentOfThreshold, alertType);

          return { triggered: true, type: alertType };
        }

        return { triggered: false };
      });

      results.push({ alertId: alert.id, ...result });
    }

    return {
      checked: activeAlerts.length,
      triggered: results.filter((r) => r.triggered).length,
      results,
    };
  }
);

/**
 * Send budget alert notification via configured channels
 */
async function sendBudgetNotification(
  alert: {
    name: string;
    period: string;
    thresholdUsd: number;
    notifyEmail: string | null;
    notifySlack: string | null;
  },
  currentSpend: number,
  percentOfThreshold: number,
  alertType: "warning" | "exceeded"
) {
  const isExceeded = alertType === "exceeded";
  const emoji = isExceeded ? "🚨" : "⚠️";
  const status = isExceeded ? "EXCEEDED" : "WARNING";

  const message = `${emoji} Budget Alert: ${alert.name}

Status: ${status}
Period: ${alert.period.charAt(0).toUpperCase() + alert.period.slice(1)}
Current Spend: $${currentSpend.toFixed(2)}
Threshold: $${alert.thresholdUsd.toFixed(2)}
Usage: ${percentOfThreshold.toFixed(1)}%

${isExceeded
  ? "Your AI costs have exceeded the configured budget limit."
  : `You're at ${percentOfThreshold.toFixed(0)}% of your budget limit.`
}

Review costs at: ${process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com"}/manage/costs`;

  // Send email notification
  if (alert.notifyEmail) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "Kaulby Alerts <alerts@kaulbyapp.com>",
        to: alert.notifyEmail,
        subject: `${emoji} Budget ${status}: ${alert.name} - $${currentSpend.toFixed(2)} (${percentOfThreshold.toFixed(0)}%)`,
        text: message,
      });
    } catch (error) {
      console.error("Failed to send budget alert email:", error);
    }
  }

  // Send Slack notification
  if (alert.notifySlack) {
    try {
      const color = isExceeded ? "#dc2626" : "#f59e0b"; // red or amber

      await fetch(alert.notifySlack, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachments: [
            {
              color,
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: `${emoji} Budget ${status}: ${alert.name}`,
                    emoji: true,
                  },
                },
                {
                  type: "section",
                  fields: [
                    {
                      type: "mrkdwn",
                      text: `*Period:*\n${alert.period.charAt(0).toUpperCase() + alert.period.slice(1)}`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Usage:*\n${percentOfThreshold.toFixed(1)}%`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Current Spend:*\n$${currentSpend.toFixed(2)}`,
                    },
                    {
                      type: "mrkdwn",
                      text: `*Threshold:*\n$${alert.thresholdUsd.toFixed(2)}`,
                    },
                  ],
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "View Costs",
                        emoji: true,
                      },
                      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com"}/manage/costs`,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      console.error("Failed to send budget alert to Slack:", error);
    }
  }
}
