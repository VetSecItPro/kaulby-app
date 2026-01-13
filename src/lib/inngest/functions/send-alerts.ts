import { inngest } from "../client";
import { db, alerts, results } from "@/lib/db";
import { eq, and, gte, inArray } from "drizzle-orm";
import { sendAlertEmail, sendDigestEmail, type WeeklyInsights } from "@/lib/loops";
import { getPlanLimits } from "@/lib/stripe";
import { generateWeeklyInsights } from "@/lib/ai";

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

// Send daily digest - Pro+ users only
export const sendDigest = inngest.createFunction(
  {
    id: "send-daily-digest",
    name: "Send Daily Digest Emails",
    retries: 2,
  },
  { cron: "0 9 * * *" }, // Every day at 9 AM UTC
  async ({ step }) => {
    // Get all users with daily email alerts (Pro+ only can have daily)
    const usersWithAlerts = await step.run("get-users", async () => {
      return db.query.users.findMany({
        with: {
          monitors: {
            with: {
              alerts: {
                where: and(
                  eq(alerts.isActive, true),
                  eq(alerts.frequency, "daily"),
                  eq(alerts.channel, "email")
                ),
              },
            },
          },
        },
      });
    });

    let digestsSent = 0;
    let skippedNoPlan = 0;
    let skippedNoResults = 0;

    for (const user of usersWithAlerts) {
      // Check if user has Pro+ plan for daily digests
      const limits = getPlanLimits(user.subscriptionStatus);
      if (!limits.digestFrequencies.includes("daily")) {
        skippedNoPlan++;
        continue;
      }

      const hasEmailAlerts = user.monitors.some((m) =>
        m.alerts.some((a) => a.channel === "email" && a.frequency === "daily")
      );

      if (!hasEmailAlerts) continue;

      // Get results from last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const userResults = await step.run(`get-results-${user.id}`, async () => {
        const monitorIds = user.monitors.map((m) => m.id);
        if (monitorIds.length === 0) return [];

        return db.query.results.findMany({
          where: and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, yesterday)
          ),
          orderBy: (results, { desc }) => [desc(results.createdAt)],
        });
      });

      if (userResults.length === 0) {
        skippedNoResults++;
        continue;
      }

      // Group results by monitor
      const resultsByMonitor = new Map<string, typeof userResults>();
      for (const result of userResults) {
        const existing = resultsByMonitor.get(result.monitorId) || [];
        existing.push(result);
        resultsByMonitor.set(result.monitorId, existing);
      }

      await step.run(`send-digest-${user.id}`, async () => {
        const monitorsData = user.monitors
          .filter((m) => resultsByMonitor.has(m.id))
          .map((m) => {
            const monitorResults = resultsByMonitor.get(m.id) || [];
            return {
              name: m.name,
              resultsCount: monitorResults.length,
              topResults: monitorResults.slice(0, 5).map((r) => ({
                title: r.title,
                url: r.sourceUrl,
                platform: r.platform,
                sentiment: r.sentiment,
                summary: r.aiSummary,
              })),
            };
          });

        await sendDigestEmail({
          to: user.email,
          userName: user.name || "there",
          frequency: "daily",
          monitors: monitorsData,
        });

        digestsSent++;
      });
    }

    return {
      message: "Daily digest completed",
      digestsSent,
      skippedNoPlan,
      skippedNoResults,
    };
  }
);

// Send weekly digest - All users (including free tier)
export const sendWeeklyDigest = inngest.createFunction(
  {
    id: "send-weekly-digest",
    name: "Send Weekly Digest Emails",
    retries: 2,
  },
  { cron: "0 9 * * 1" }, // Every Monday at 9 AM UTC
  async ({ step }) => {
    // Get all users with weekly email alerts
    const usersWithAlerts = await step.run("get-users", async () => {
      return db.query.users.findMany({
        with: {
          monitors: {
            with: {
              alerts: {
                where: and(
                  eq(alerts.isActive, true),
                  eq(alerts.frequency, "weekly"),
                  eq(alerts.channel, "email")
                ),
              },
            },
          },
        },
      });
    });

    let digestsSent = 0;
    let skippedNoResults = 0;

    for (const user of usersWithAlerts) {
      const hasEmailAlerts = user.monitors.some((m) =>
        m.alerts.some((a) => a.channel === "email" && a.frequency === "weekly")
      );

      if (!hasEmailAlerts) continue;

      // Get results from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const userResults = await step.run(`get-results-${user.id}`, async () => {
        const monitorIds = user.monitors.map((m) => m.id);
        if (monitorIds.length === 0) return [];

        return db.query.results.findMany({
          where: and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, weekAgo)
          ),
          orderBy: (results, { desc }) => [desc(results.createdAt)],
        });
      });

      if (userResults.length === 0) {
        skippedNoResults++;
        continue;
      }

      // Group results by monitor
      const resultsByMonitor = new Map<string, typeof userResults>();
      for (const result of userResults) {
        const existing = resultsByMonitor.get(result.monitorId) || [];
        existing.push(result);
        resultsByMonitor.set(result.monitorId, existing);
      }

      // Check if user has Pro+ plan for AI insights
      const limits = getPlanLimits(user.subscriptionStatus);
      const includeAiInsights = limits.aiFeatures.unlimitedAiAnalysis;

      // Generate AI insights for Pro+ users
      let aiInsights: WeeklyInsights | undefined;
      if (includeAiInsights && userResults.length >= 5) {
        try {
          const insightsResult = await step.run(`generate-insights-${user.id}`, async () => {
            const analysisResults = userResults.map(r => ({
              title: r.title,
              content: r.content,
              platform: r.platform,
              sentiment: r.sentiment,
              painPointCategory: r.painPointCategory,
              aiSummary: r.aiSummary,
            }));
            return generateWeeklyInsights(analysisResults);
          });
          aiInsights = insightsResult.result;
        } catch (error) {
          console.error(`Failed to generate AI insights for user ${user.id}:`, error);
          // Continue without AI insights
        }
      }

      await step.run(`send-digest-${user.id}`, async () => {
        const monitorsData = user.monitors
          .filter((m) => resultsByMonitor.has(m.id))
          .map((m) => {
            const monitorResults = resultsByMonitor.get(m.id) || [];
            return {
              name: m.name,
              resultsCount: monitorResults.length,
              topResults: monitorResults.slice(0, 10).map((r) => ({
                title: r.title,
                url: r.sourceUrl,
                platform: r.platform,
                sentiment: r.sentiment,
                summary: r.aiSummary,
              })),
            };
          });

        await sendDigestEmail({
          to: user.email,
          userName: user.name || "there",
          frequency: "weekly",
          monitors: monitorsData,
          aiInsights,
        });

        digestsSent++;
      });
    }

    return {
      message: "Weekly digest completed",
      digestsSent,
      skippedNoResults,
    };
  }
);
