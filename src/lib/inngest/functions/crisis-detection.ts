import { inngest } from "../client";
import { pooledDb, users, monitors, results, alerts } from "@/lib/db";
import { eq, and, gte, inArray, sql, desc } from "drizzle-orm";
import { sendAlertEmail } from "@/lib/email";
import { sendWebhookNotification } from "@/lib/notifications";

interface CrisisAlert {
  userId: string;
  monitorId: string;
  monitorName: string;
  type: "negative_spike" | "viral_negative" | "volume_spike";
  severity: "warning" | "critical";
  message: string;
  details: {
    currentNegative: number;
    previousNegative: number;
    percentageIncrease: number;
    topNegativeResults?: Array<{
      id: string;
      title: string;
      platform: string;
      engagementScore: number;
    }>;
  };
}

/**
 * Crisis Detection Function
 *
 * Runs every hour to detect:
 * 1. Sudden spikes in negative sentiment (>50% increase)
 * 2. Viral negative posts (>100 engagement in 24h)
 * 3. Volume spikes with negative sentiment
 *
 * Only runs for Team tier users.
 */
export const detectCrisis = inngest.createFunction(
  {
    id: "detect-crisis",
    name: "Crisis Detection",
    timeouts: { finish: "15m" },
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Get all Team tier users with active monitors
    const teamUsers = await step.run("get-team-users", async () => {
      return pooledDb.query.users.findMany({
        where: eq(users.subscriptionStatus, "enterprise"),
        columns: {
          id: true,
          email: true,
        },
      });
    });

    if (teamUsers.length === 0) {
      return { message: "No Team users to process" };
    }

    const crisisAlerts: CrisisAlert[] = [];

    // Process each user
    for (const user of teamUsers) {
      await step.run(`check-user-${user.id}`, async () => {
        // Get user's active monitors
        const userMonitors = await pooledDb.query.monitors.findMany({
          where: and(
            eq(monitors.userId, user.id),
            eq(monitors.isActive, true)
          ),
          columns: {
            id: true,
            name: true,
            companyName: true,
          },
        });

        if (userMonitors.length === 0) return;

        const monitorIds = userMonitors.map((m) => m.id);

        // Time windows
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const previous24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        // Get sentiment counts for last 24h
        const currentSentiment = await pooledDb
          .select({
            monitorId: results.monitorId,
            total: sql<number>`count(*)`,
            negative: sql<number>`count(*) filter (where ${results.sentiment} = 'negative')`,
            positive: sql<number>`count(*) filter (where ${results.sentiment} = 'positive')`,
          })
          .from(results)
          .where(
            and(
              inArray(results.monitorId, monitorIds),
              gte(results.createdAt, last24h)
            )
          )
          .groupBy(results.monitorId);

        // Get sentiment counts for previous 24h
        const previousSentiment = await pooledDb
          .select({
            monitorId: results.monitorId,
            negative: sql<number>`count(*) filter (where ${results.sentiment} = 'negative')`,
          })
          .from(results)
          .where(
            and(
              inArray(results.monitorId, monitorIds),
              gte(results.createdAt, previous24h),
              sql`${results.createdAt} < ${last24h}`
            )
          )
          .groupBy(results.monitorId);

        // Check for viral negative posts (high engagement)
        const viralNegative = await pooledDb.query.results.findMany({
          where: and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, last24h),
            eq(results.sentiment, "negative"),
            gte(results.engagementScore, 100)
          ),
          orderBy: [desc(results.engagementScore)],
          limit: 5,
          columns: {
            id: true,
            monitorId: true,
            title: true,
            platform: true,
            engagementScore: true,
          },
        });

        // Analyze each monitor
        for (const monitor of userMonitors) {
          const current = currentSentiment.find((s) => s.monitorId === monitor.id);
          const previous = previousSentiment.find((s) => s.monitorId === monitor.id);

          const currentNegative = Number(current?.negative || 0);
          const previousNegative = Number(previous?.negative || 0);

          // Check for negative spike (>50% increase with at least 5 negative)
          if (previousNegative > 0 && currentNegative >= 5) {
            const percentageIncrease = ((currentNegative - previousNegative) / previousNegative) * 100;

            if (percentageIncrease >= 50) {
              const monitorViralNegative = viralNegative.filter(
                (r) => r.monitorId === monitor.id
              );

              crisisAlerts.push({
                userId: user.id,
                monitorId: monitor.id,
                monitorName: monitor.name,
                type: "negative_spike",
                severity: percentageIncrease >= 100 ? "critical" : "warning",
                message: `Negative sentiment spike detected: ${percentageIncrease.toFixed(0)}% increase in the last 24 hours`,
                details: {
                  currentNegative,
                  previousNegative,
                  percentageIncrease,
                  topNegativeResults: monitorViralNegative.map((r) => ({
                    id: r.id,
                    title: r.title,
                    platform: r.platform,
                    engagementScore: r.engagementScore || 0,
                  })),
                },
              });
            }
          }

          // Check for viral negative posts
          const monitorViral = viralNegative.filter((r) => r.monitorId === monitor.id);
          if (monitorViral.length > 0) {
            const highestEngagement = monitorViral[0];
            crisisAlerts.push({
              userId: user.id,
              monitorId: monitor.id,
              monitorName: monitor.name,
              type: "viral_negative",
              severity: (highestEngagement.engagementScore || 0) >= 500 ? "critical" : "warning",
              message: `Viral negative post detected with ${highestEngagement.engagementScore} engagement`,
              details: {
                currentNegative,
                previousNegative,
                percentageIncrease: 0,
                topNegativeResults: monitorViral.map((r) => ({
                  id: r.id,
                  title: r.title,
                  platform: r.platform,
                  engagementScore: r.engagementScore || 0,
                })),
              },
            });
          }
        }
      });
    }

    // Send alerts
    if (crisisAlerts.length > 0) {
      // Group alerts by user to avoid sending multiple emails per user
      const alertsByUser: Record<string, CrisisAlert[]> = {};
      for (const alert of crisisAlerts) {
        if (!alertsByUser[alert.userId]) {
          alertsByUser[alert.userId] = [];
        }
        alertsByUser[alert.userId].push(alert);
      }

      const userIds = Object.keys(alertsByUser);

      // Send email notifications grouped by user
      for (const userId of userIds) {
        const userAlerts = alertsByUser[userId];
        await step.run(`send-crisis-email-${userId}`, async () => {
          const user = teamUsers.find((u) => u.id === userId);
          if (!user?.email) {
            console.warn(`No email found for user ${userId}, skipping crisis email`);
            return;
          }

          // Build results array for sendAlertEmail from crisis details
          const emailResults = userAlerts.flatMap((crisisAlert: CrisisAlert) => {
            const severityLabel = crisisAlert.severity === "critical" ? "CRITICAL" : "WARNING";
            // Include the top negative results if available
            if (crisisAlert.details.topNegativeResults && crisisAlert.details.topNegativeResults.length > 0) {
              return crisisAlert.details.topNegativeResults.map((r) => ({
                title: `[${severityLabel}] ${r.title}`,
                url: `https://kaulbyapp.com/dashboard/monitors/${crisisAlert.monitorId}`,
                platform: r.platform,
                sentiment: "negative" as const,
                summary: crisisAlert.message,
              }));
            }
            // Fallback: create a single entry for the alert itself
            return [{
              title: `[${severityLabel}] ${crisisAlert.monitorName}: ${crisisAlert.type.replace(/_/g, " ")}`,
              url: `https://kaulbyapp.com/dashboard/monitors/${crisisAlert.monitorId}`,
              platform: "multiple",
              sentiment: "negative" as const,
              summary: crisisAlert.message,
            }];
          });

          try {
            await sendAlertEmail({
              to: user.email,
              monitorName: `Crisis Alert: ${userAlerts.map((a: CrisisAlert) => a.monitorName).join(", ")}`,
              userId: user.id,
              results: emailResults,
            });
          } catch (error) {
            console.error(`Failed to send crisis email to user ${userId}:`, error);
          }
        });
      }

      // Send webhook notifications (Slack/Discord) for each user's monitors
      for (const userId of userIds) {
        const userAlerts = alertsByUser[userId];
        await step.run(`send-crisis-webhooks-${userId}`, async () => {
          // Get all active Slack/webhook alerts for this user's monitors
          const monitorIdSet: Record<string, boolean> = {};
          userAlerts.forEach((a: CrisisAlert) => { monitorIdSet[a.monitorId] = true; });
          const monitorIds = Object.keys(monitorIdSet);

          const webhookAlerts = await pooledDb.query.alerts.findMany({
            where: and(
              inArray(alerts.monitorId, monitorIds),
              eq(alerts.channel, "slack"),
              eq(alerts.isActive, true)
            ),
          });

          if (webhookAlerts.length === 0) return;

          // Deduplicate webhook URLs to avoid sending duplicate messages
          const sentWebhookUrls: Record<string, boolean> = {};

          for (const webhookAlert of webhookAlerts) {
            if (sentWebhookUrls[webhookAlert.destination]) continue;
            sentWebhookUrls[webhookAlert.destination] = true;

            // Find the crisis alerts relevant to this monitor
            const relevantAlerts = userAlerts.filter(
              (a: CrisisAlert) => a.monitorId === webhookAlert.monitorId
            );

            const webhookResults = relevantAlerts.flatMap((crisisAlert: CrisisAlert) => {
              const severityLabel = crisisAlert.severity === "critical" ? "CRITICAL" : "WARNING";
              if (crisisAlert.details.topNegativeResults && crisisAlert.details.topNegativeResults.length > 0) {
                return crisisAlert.details.topNegativeResults.map((r) => ({
                  id: r.id,
                  title: `[${severityLabel}] ${r.title}`,
                  sourceUrl: `https://kaulbyapp.com/dashboard/monitors/${crisisAlert.monitorId}`,
                  platform: r.platform,
                  sentiment: "negative" as const,
                  aiSummary: crisisAlert.message,
                }));
              }
              return [{
                id: crisisAlert.monitorId,
                title: `[${severityLabel}] ${crisisAlert.monitorName}: ${crisisAlert.type.replace(/_/g, " ")}`,
                sourceUrl: `https://kaulbyapp.com/dashboard/monitors/${crisisAlert.monitorId}`,
                platform: "multiple",
                sentiment: "negative" as const,
                aiSummary: crisisAlert.message,
              }];
            });

            try {
              const result = await sendWebhookNotification(webhookAlert.destination, {
                monitorName: `Crisis Alert: ${relevantAlerts.map((a: CrisisAlert) => a.monitorName).join(", ")}`,
                results: webhookResults,
                dashboardUrl: `https://kaulbyapp.com/dashboard`,
              });

              if (!result.success) {
                console.error(`Crisis webhook failed for ${result.type}: ${result.error}`);
              }
            } catch (error) {
              console.error(`Failed to send crisis webhook to ${webhookAlert.destination}:`, error);
            }
          }
        });
      }

      console.log(`Crisis alerts processed: ${crisisAlerts.length} alerts for ${userIds.length} users`);
    }

    return {
      processed: teamUsers.length,
      alertsGenerated: crisisAlerts.length,
      alerts: crisisAlerts.map((a) => ({
        monitor: a.monitorName,
        type: a.type,
        severity: a.severity,
      })),
    };
  }
);
