import { inngest } from "../client";
import { db, alerts, results, users } from "@/lib/db";
import { eq, and, gte, inArray } from "drizzle-orm";
import { sendAlertEmail, sendDigestEmail, type WeeklyInsights } from "@/lib/email";
import { getPlanLimits } from "@/lib/stripe";
import { generateWeeklyInsights } from "@/lib/ai";
import { sendWebhookNotification, type NotificationResult } from "@/lib/notifications";

// Supported timezones (IANA format for DST handling)
const SUPPORTED_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;

type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number];

// Get current hour in a timezone (handles DST automatically)
function getCurrentHourInTimezone(timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

// Get current day of week in a timezone (0 = Sunday, 1 = Monday, etc.)
function getCurrentDayInTimezone(timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const day = formatter.format(new Date());
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return days[day] ?? 0;
}

// Get timezones where it's currently the target hour
function getTimezonesAtHour(targetHour: number): SupportedTimezone[] {
  return SUPPORTED_TIMEZONES.filter(
    (tz) => getCurrentHourInTimezone(tz) === targetHour
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InngestStep = any;

// Types for query results
type UserWithMonitors = Awaited<ReturnType<typeof db.query.users.findMany>>[number] & {
  monitors: Array<{
    id: string;
    name: string;
    alerts: Array<{
      channel: string;
      frequency: string;
    }>;
  }>;
};

type ResultWithMonitor = Awaited<ReturnType<typeof db.query.results.findMany>>[number];

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

    // Slack webhook notifications (works for both Slack and Discord)
    if (alert.channel === "slack") {
      const webhookResult = await step.run("send-webhook", async () => {
        // Format results for webhook notification
        const notificationResults: NotificationResult[] = matchingResults.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          sourceUrl: r.sourceUrl,
          platform: r.platform,
          author: r.author,
          postedAt: r.postedAt,
          sentiment: r.sentiment,
          conversationCategory: r.conversationCategory as NotificationResult["conversationCategory"],
          aiSummary: r.aiSummary,
        }));

        return sendWebhookNotification(alert.destination, {
          monitorName: alert.monitor.name,
          results: notificationResults,
          dashboardUrl: `https://kaulbyapp.com/dashboard/monitors/${alert.monitor.id}`,
        });
      });

      if (!webhookResult.success) {
        console.error(`Webhook notification failed for alert ${alertId}: ${webhookResult.error}`);
      }

      return {
        sent: webhookResult.success,
        channel: alert.channel,
        webhookType: webhookResult.type,
        resultsCount: matchingResults.length,
        error: webhookResult.error,
      };
    }

    // TODO: Implement in-app notifications

    return {
      sent: true,
      channel: alert.channel,
      resultsCount: matchingResults.length,
    };
  }
);

// Shared daily digest logic for a specific timezone
async function sendDailyDigestForTimezone(
  timezone: SupportedTimezone,
  step: InngestStep
) {
  // Get all users with daily email alerts in this timezone
  const usersWithAlerts: UserWithMonitors[] = await step.run(`get-users-${timezone}`, async () => {
    return db.query.users.findMany({
      where: eq(users.timezone, timezone),
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

    const userResults: ResultWithMonitor[] = await step.run(`get-results-${user.id}`, async () => {
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
    const resultsByMonitor = new Map<string, ResultWithMonitor[]>();
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
    timezone,
    digestsSent,
    skippedNoPlan,
    skippedNoResults,
  };
}

// Shared weekly digest logic for a specific timezone
async function sendWeeklyDigestForTimezone(
  timezone: SupportedTimezone,
  step: InngestStep
) {
  // Get all users with weekly email alerts in this timezone
  const usersWithAlerts: UserWithMonitors[] = await step.run(`get-users-${timezone}`, async () => {
    return db.query.users.findMany({
      where: eq(users.timezone, timezone),
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

    const userResults: ResultWithMonitor[] = await step.run(`get-results-${user.id}`, async () => {
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
    const resultsByMonitor = new Map<string, ResultWithMonitor[]>();
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
    timezone,
    digestsSent,
    skippedNoResults,
  };
}

// Daily digest - runs at hours when 9 AM occurs in US timezones
// UTC 13-17 covers 9 AM for all US timezones during both DST and standard time
export const sendDailyDigest = inngest.createFunction(
  {
    id: "send-daily-digest",
    name: "Daily Digest (DST-aware)",
    retries: 2,
  },
  { cron: "0 13,14,15,16,17 * * *" }, // 5 runs/day instead of 24
  async ({ step }) => {
    const TARGET_HOUR = 9; // 9 AM local time

    // Find which timezones are currently at 9 AM
    const timezonesAt9AM = getTimezonesAtHour(TARGET_HOUR);

    if (timezonesAt9AM.length === 0) {
      return {
        message: "No timezones at 9 AM right now",
        checkedTimezones: SUPPORTED_TIMEZONES.map(tz => ({
          timezone: tz,
          currentHour: getCurrentHourInTimezone(tz),
        })),
      };
    }

    const results = [];
    for (const timezone of timezonesAt9AM) {
      const result = await sendDailyDigestForTimezone(timezone, step);
      results.push(result);
    }

    return {
      message: "Daily digest completed",
      processedTimezones: timezonesAt9AM,
      results,
    };
  }
);

// Weekly digest - runs at hours when 9 AM Monday occurs in US timezones
export const sendWeeklyDigest = inngest.createFunction(
  {
    id: "send-weekly-digest",
    name: "Weekly Digest (DST-aware)",
    retries: 2,
  },
  { cron: "0 13,14,15,16,17 * * 1" }, // 5 runs on Mondays
  async ({ step }) => {
    const TARGET_HOUR = 9; // 9 AM local time

    // Find which timezones are currently at 9 AM
    const timezonesAt9AM = getTimezonesAtHour(TARGET_HOUR);

    // Double-check it's Monday in those timezones (edge case around midnight)
    const timezonesAt9AMOnMonday = timezonesAt9AM.filter(
      tz => getCurrentDayInTimezone(tz) === 1
    );

    if (timezonesAt9AMOnMonday.length === 0) {
      return {
        message: "No timezones at 9 AM Monday right now",
        checkedTimezones: SUPPORTED_TIMEZONES.map(tz => ({
          timezone: tz,
          currentHour: getCurrentHourInTimezone(tz),
          currentDay: getCurrentDayInTimezone(tz),
        })),
      };
    }

    const results = [];
    for (const timezone of timezonesAt9AMOnMonday) {
      const result = await sendWeeklyDigestForTimezone(timezone, step);
      results.push(result);
    }

    return {
      message: "Weekly digest completed",
      processedTimezones: timezonesAt9AMOnMonday,
      results,
    };
  }
);
