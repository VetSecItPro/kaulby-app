import { inngest } from "../client";
import { db, users, monitors, results } from "@/lib/db";
import { eq, and, gte, inArray, sql, desc } from "drizzle-orm";

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
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Get all Team tier users with active monitors
    const teamUsers = await step.run("get-team-users", async () => {
      return db.query.users.findMany({
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
        const userMonitors = await db.query.monitors.findMany({
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
        const currentSentiment = await db
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
        const previousSentiment = await db
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
        const viralNegative = await db.query.results.findMany({
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
      await step.run("send-crisis-alerts", async () => {
        // Here you would send email/Slack notifications
        // For now, we'll just log and could store in a crisis_alerts table
        console.log(`Crisis alerts detected: ${crisisAlerts.length}`);

        // You could also trigger email notifications via Resend
        // or Slack webhooks for each alert
        for (const alert of crisisAlerts) {
          console.log(
            `[${alert.severity.toUpperCase()}] ${alert.monitorName}: ${alert.message}`
          );
        }
      });
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
