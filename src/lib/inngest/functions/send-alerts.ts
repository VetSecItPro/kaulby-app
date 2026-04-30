import { inngest } from "../client";
import { pooledDb, alerts, monitors, results, users } from "@/lib/db";
import { eq, and, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { sendAlertEmail, sendDigestEmail, type WeeklyInsights } from "@/lib/email";
import { getPlanLimits, normalizePlanKey, type PlanKey } from "@/lib/plans";
import { computeWeeklyInsightsFor } from "./weekly-insights-helper";
import { sendWebhookNotification, type NotificationResult } from "@/lib/notifications";
import { sendDiscordBotMessage } from "@/lib/integrations/discord";
import { sendTeamsMessage, formatTeamsAlert } from "@/lib/integrations/teams";
import { decryptIntegrationData } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { sortByAlertPriority } from "@/lib/alert-priority";
import { sendPushToUser } from "@/lib/push";

// PERF-BUILDTIME-002: Cache Intl.DateTimeFormat instances by timezone+type
const tzFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getCachedFormatter(timezone: string, type: "hour" | "weekday" | "day"): Intl.DateTimeFormat {
  const key = `${timezone}:${type}`;
  if (!tzFormatterCache.has(key)) {
    // PERF-MEM-001: Limit cache to 200 entries to prevent unbounded growth
    if (tzFormatterCache.size >= 200) {
      const firstKey = tzFormatterCache.keys().next().value;
      if (firstKey !== undefined) tzFormatterCache.delete(firstKey);
    }
    const options: Intl.DateTimeFormatOptions = { timeZone: timezone };
    if (type === "hour") { options.hour = "numeric"; options.hour12 = false; }
    else if (type === "weekday") { options.weekday = "short"; }
    else if (type === "day") { options.day = "numeric"; }
    tzFormatterCache.set(key, new Intl.DateTimeFormat("en-US", options));
  }
  return tzFormatterCache.get(key)!;
}

// Get current hour in a timezone (handles DST automatically)
function getCurrentHourInTimezone(timezone: string): number {
  try {
    return parseInt(getCachedFormatter(timezone, "hour").format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

// Get current day of week in a timezone (0 = Sunday, 1 = Monday, etc.)
function getCurrentDayInTimezone(timezone: string): number {
  try {
    const day = getCachedFormatter(timezone, "weekday").format(new Date());
    const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return days[day] ?? 0;
  } catch {
    return new Date().getUTCDay();
  }
}

// Get current day of month in a timezone (1-31)
function getCurrentDayOfMonthInTimezone(timezone: string): number {
  try {
    return parseInt(getCachedFormatter(timezone, "day").format(new Date()), 10);
  } catch {
    return new Date().getUTCDate();
  }
}

// Check if a timezone string is valid
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Minimal Inngest step interface (same structural pattern as MonitorStep) */
interface DigestStep {
  run<T>(id: string, callback: () => Promise<T>): Promise<T>;
  sleep(id: string, duration: string): Promise<void>;
}

// Types for query results
type UserWithMonitors = Awaited<ReturnType<typeof pooledDb.query.users.findMany>>[number] & {
  monitors: Array<{
    id: string;
    name: string;
    alerts: Array<{
      channel: string;
      frequency: string;
    }>;
  }>;
};

type ResultWithMonitor = Awaited<ReturnType<typeof pooledDb.query.results.findMany>>[number];

// Send instant alert
export const sendAlert = inngest.createFunction(
  {
    id: "send-alert",
    name: "Send Alert",
    retries: 3,
    timeouts: { finish: "2m" },
  },
  { event: "alert/send" },
  async ({ event, step }) => {
    const { alertId, resultIds } = event.data;

    // Get alert configuration
    const alertRaw = await step.run("get-alert", async () => {
      return pooledDb.query.alerts.findFirst({
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

    if (!alertRaw || !alertRaw.isActive) {
      return { skipped: true, reason: "Alert not found or inactive" };
    }

    // Cast to fix Drizzle relational query type inference (monitor is always a single object from findFirst)
    const alert = alertRaw as typeof alertRaw & {
      monitor: typeof monitors.$inferSelect & { user: typeof users.$inferSelect | null };
    };

    // Get the results.
    // Exclude rows where aiAnalyzed=false (analysis failed, sentiment unfabricated);
    // include NULL (legacy rows from before the aiAnalyzed column) and TRUE (success).
    const rawMatchingResults = await step.run("get-results", async () => {
      return pooledDb.query.results.findMany({
        where: and(
          inArray(results.id, resultIds),
          or(ne(results.aiAnalyzed, false), isNull(results.aiAnalyzed))
        ),
      });
    });

    if (rawMatchingResults.length === 0) {
      return { skipped: true, reason: "No results to send" };
    }

    // Task 2.5: reorder (do not filter) so highest-priority items lead the email.
    // Same set of rows, same alert rules — only the order the user sees changes.
    const matchingResults = sortByAlertPriority(rawMatchingResults);

    // Send based on channel
    if (alert.channel === "email") {
      await step.run("send-email", async () => {
        await sendAlertEmail({
          to: alert.destination,
          monitorName: alert.monitor.name,
          userId: alert.monitor.user?.id,
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
        logger.error("Webhook notification failed", { alertId, error: webhookResult.error });
      }

      return {
        sent: webhookResult.success,
        channel: alert.channel,
        webhookType: webhookResult.type,
        resultsCount: matchingResults.length,
        error: webhookResult.error,
      };
    }

    // Additive push delivery: fires for the alert's owner whenever they have
    // any active push subscriptions, regardless of the primary alert channel.
    // Subscribe in /dashboard/settings to receive these. Errors are logged
    // and never bubble — push must NEVER break email/slack/teams delivery.
    await step.run("send-push-additive", async () => {
      const userId = alert.monitor.userId;
      if (!userId) return { skipped: "no userId" };
      try {
        const top = matchingResults[0];
        const extra = matchingResults.length - 1;
        const title = `New ${alert.monitor.name} mention${extra > 0 ? ` (+${extra} more)` : ""}`;
        const body = (top.aiSummary || top.title || "Tap to view").slice(0, 140);
        const r = await sendPushToUser(userId, {
          title,
          body,
          url: `/dashboard/monitors/${alert.monitor.id}`,
          tag: `monitor-${alert.monitor.id}`,
        });
        return { pushSent: r.sent, pushPruned: r.pruned };
      } catch (err) {
        logger.error("Push delivery failed (non-fatal)", {
          alertId,
          error: err instanceof Error ? err.message : String(err),
        });
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    });

    // In-app notifications
    if (alert.channel === "in_app") {
      await step.run("send-in-app", async () => {
        const { notifications } = await import("@/lib/db/schema");
        await pooledDb.insert(notifications).values(
          matchingResults.slice(0, 10).map((r) => ({
            userId: alert.monitor.userId,
            title: `New match: ${r.title.slice(0, 100)}`,
            message: r.aiSummary || r.content?.slice(0, 200) || r.title,
            type: "alert" as const,
            monitorId: alert.monitor.id,
            resultId: r.id,
          }))
        );
      });

      return {
        sent: true,
        channel: alert.channel,
        resultsCount: matchingResults.length,
      };
    }

    // Teams webhook notifications
    if (alert.channel === "teams") {
      const teamsResult = await step.run("send-teams-webhook", async () => {
        try {
          const user = alert.monitor.user;
          if (!user) return { success: false, error: "No user on monitor" };

          // The destination contains the webhook URL (stored encrypted in integrations,
          // but for alert.destination it's stored directly like Slack webhooks)
          const card = formatTeamsAlert({
            monitorName: alert.monitor.name,
            results: matchingResults.map((r) => ({
              title: r.title,
              platform: r.platform,
              sourceUrl: r.sourceUrl,
              sentiment: r.sentiment,
              aiSummary: r.aiSummary,
            })),
            dashboardUrl: `https://kaulbyapp.com/dashboard/monitors/${alert.monitor.id}`,
          });

          return sendTeamsMessage(alert.destination, card);
        } catch (error) {
          logger.error("Teams webhook alert error", {
            alertId,
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error sending Teams alert",
          };
        }
      });

      if (!teamsResult.success) {
        logger.error("Teams webhook notification failed", { alertId, error: teamsResult.error });
      }

      return {
        sent: teamsResult.success,
        channel: alert.channel,
        resultsCount: matchingResults.length,
        error: teamsResult.error,
      };
    }

    // Discord integration alert (bot token + channel ID)
    // Runs in addition to any webhook-based alerts above. If the user has
    // connected Discord via OAuth AND selected a channel, send rich embeds
    // through the bot. Failures are logged but never crash the pipeline.
    const discordIntegrationResult = await step.run("send-discord-integration", async () => {
      try {
        const user = alert.monitor.user;
        if (!user) return { skipped: true, reason: "No user on monitor" };

        const integrations = (user.integrations as Record<string, unknown>) || {};
        const discordRaw = integrations.discord as Record<string, unknown> | undefined;

        if (!discordRaw?.connected) {
          return { skipped: true, reason: "Discord not connected" };
        }

        const discord = decryptIntegrationData(discordRaw);
        const channelId = discord.channelId as string | undefined;

        if (!channelId) {
          return { skipped: true, reason: "No Discord channel configured" };
        }

        const result = await sendDiscordBotMessage(channelId, {
          monitorName: alert.monitor.name,
          results: matchingResults.map((r) => ({
            title: r.title,
            sourceUrl: r.sourceUrl,
            platform: r.platform,
            sentiment: r.sentiment,
            aiSummary: r.aiSummary,
          })),
          dashboardUrl: `https://kaulbyapp.com/dashboard/monitors/${alert.monitor.id}`,
        });

        if (!result.success) {
          logger.error("Discord integration alert failed", {
            alertId,
            channelId,
            error: result.error,
          });
        }

        return { sent: result.success, error: result.error };
      } catch (error) {
        logger.error("Discord integration alert error", {
          alertId,
          error: error instanceof Error ? error.message : String(error),
        });
        return { sent: false, reason: "Unexpected error", error: error instanceof Error ? error.message : String(error) };
      }
    });

    return {
      sent: true,
      channel: alert.channel,
      resultsCount: matchingResults.length,
      discordIntegration: discordIntegrationResult,
      discordFailed: "sent" in discordIntegrationResult ? discordIntegrationResult.sent === false : false,
    };
  }
);

// Configuration for each digest frequency
interface DigestConfig {
  frequency: "daily" | "weekly" | "monthly";
  lookbackDays: number;
  topResultsLimit: number;
  includeCategories: boolean;
  includeAiInsights: boolean;
  checkPlanAccess: boolean;
}

const DIGEST_CONFIGS: Record<string, DigestConfig> = {
  daily: { frequency: "daily", lookbackDays: 1, topResultsLimit: 5, includeCategories: false, includeAiInsights: false, checkPlanAccess: true },
  weekly: { frequency: "weekly", lookbackDays: 7, topResultsLimit: 10, includeCategories: true, includeAiInsights: true, checkPlanAccess: false },
  monthly: { frequency: "monthly", lookbackDays: 30, topResultsLimit: 15, includeCategories: true, includeAiInsights: true, checkPlanAccess: false },
};

/** Group results by monitor, platform, and category */
function groupResults(userResults: ResultWithMonitor[], includeCategories: boolean) {
  const resultsByMonitor = new Map<string, ResultWithMonitor[]>();
  const resultsByPlatform = new Map<string, ResultWithMonitor[]>();
  const resultsByCategory = new Map<string, ResultWithMonitor[]>();

  for (const result of userResults) {
    const existingMonitor = resultsByMonitor.get(result.monitorId) || [];
    existingMonitor.push(result);
    resultsByMonitor.set(result.monitorId, existingMonitor);

    const existingPlatform = resultsByPlatform.get(result.platform) || [];
    existingPlatform.push(result);
    resultsByPlatform.set(result.platform, existingPlatform);

    if (includeCategories) {
      const category = result.conversationCategory || "general";
      const existingCategory = resultsByCategory.get(category) || [];
      existingCategory.push(result);
      resultsByCategory.set(category, existingCategory);
    }
  }

  return { resultsByMonitor, resultsByPlatform, resultsByCategory };
}

/** Build digest email data from grouped results */
function buildDigestData(
  user: UserWithMonitors,
  resultsByMonitor: Map<string, ResultWithMonitor[]>,
  resultsByPlatform: Map<string, ResultWithMonitor[]>,
  resultsByCategory: Map<string, ResultWithMonitor[]>,
  config: DigestConfig
) {
  const monitorsData = user.monitors
    .filter((m) => resultsByMonitor.has(m.id))
    .map((m) => {
      const monitorResults = resultsByMonitor.get(m.id) || [];
      return {
        name: m.name,
        resultsCount: monitorResults.length,
        topResults: monitorResults.slice(0, config.topResultsLimit).map((r) => ({
          title: r.title,
          url: r.sourceUrl,
          platform: r.platform,
          sentiment: r.sentiment,
          summary: r.aiSummary,
          category: r.conversationCategory,
        })),
      };
    });

  const platformBreakdown = Array.from(resultsByPlatform.entries()).map(([platform, platformResults]) => ({
    platform,
    count: platformResults.length,
  }));

  const categoryBreakdown = config.includeCategories
    ? Array.from(resultsByCategory.entries()).map(([category, categoryResults]) => ({
        category,
        count: categoryResults.length,
      }))
    : undefined;

  return { monitorsData, platformBreakdown, categoryBreakdown };
}

// Shared digest logic for all frequencies (daily/weekly/monthly)
async function sendDigestForTimezone(
  timezone: string,
  config: DigestConfig,
  step: DigestStep
) {
  // Get all users with email alerts for this frequency in this timezone
  const usersWithAlerts = await step.run(`get-users-${timezone.replace("/", "-")}`, async () => {
    return pooledDb.query.users.findMany({
      where: eq(users.timezone, timezone),
      with: {
        monitors: {
          with: {
            alerts: {
              where: and(
                eq(alerts.isActive, true),
                eq(alerts.frequency, config.frequency),
                eq(alerts.channel, "email")
              ),
            },
          },
        },
      },
    });
  }) as UserWithMonitors[];

  let digestsSent = 0;
  let skippedNoPlan = 0;
  let skippedNoResults = 0;

  for (const user of usersWithAlerts) {
    // Skip users who have paused digests
    if (user.digestPaused) {
      continue;
    }

    // Check if user's plan supports this digest frequency
    if (config.checkPlanAccess) {
      const limits = getPlanLimits(normalizePlanKey(user.subscriptionStatus));
      if (!limits.digestFrequencies.includes(config.frequency)) {
        skippedNoPlan++;
        continue;
      }
    }

    const hasEmailAlerts = user.monitors.some((m) =>
      m.alerts.some((a) => a.channel === "email" && a.frequency === config.frequency)
    );

    if (!hasEmailAlerts) continue;

    // Get results from the lookback period that haven't been sent in a digest
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.lookbackDays);

    const userResults: ResultWithMonitor[] = await step.run(`get-results-${user.id}`, async () => {
      const monitorIds = user.monitors.map((m) => m.id);
      if (monitorIds.length === 0) return [];

      return pooledDb.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, cutoffDate),
          isNull(results.lastSentInDigestAt),
          // Exclude rows whose AI analysis failed — sentiment is null on those,
          // including them produces misleading digest summaries.
          or(ne(results.aiAnalyzed, false), isNull(results.aiAnalyzed))
        ),
        orderBy: (results, { desc }) => [desc(results.createdAt)],
        limit: 5000, // Safety limit to prevent OOM on large digests
      });
    });

    if (userResults.length === 0) {
      skippedNoResults++;
      continue;
    }

    // Group results by monitor and platform
    const { resultsByMonitor, resultsByPlatform, resultsByCategory } = groupResults(
      userResults,
      config.includeCategories
    );

    // Generate AI insights for Pro+ users (weekly/monthly only).
    // Behavior preserved: gate on plan access, require >=5 results.
    // The helper wraps the AI call + cost logging and swallows errors
    // (so a failed insights call never blocks the digest email).
    let aiInsights: WeeklyInsights | undefined;
    if (config.includeAiInsights) {
      const limits = getPlanLimits(normalizePlanKey(user.subscriptionStatus));
      if (limits.aiFeatures.unlimitedAiAnalysis) {
        // COA 4 W2.7: pass plan for Team-tier Sonnet + persona-voice digest.
        aiInsights = await computeWeeklyInsightsFor(
          user.id,
          userResults.map((r) => ({
            title: r.title,
            content: r.content,
            platform: r.platform,
            sentiment: r.sentiment,
            painPointCategory: r.painPointCategory,
            aiSummary: r.aiSummary,
          })),
          step,
          5,
          user.subscriptionStatus as PlanKey
        );
      }
    }

    await step.run(`send-digest-${user.id}`, async () => {
      const { monitorsData, platformBreakdown, categoryBreakdown } = buildDigestData(
        user,
        resultsByMonitor,
        resultsByPlatform,
        resultsByCategory,
        config
      );

      await sendDigestEmail({
        to: user.email,
        userName: user.name || "there",
        userId: user.id,
        frequency: config.frequency,
        monitors: monitorsData,
        aiInsights,
        platformBreakdown,
        categoryBreakdown,
      });

      // Mark results as sent in digest (deduplication)
      const resultIds = userResults.map(r => r.id);
      if (resultIds.length > 0) {
        await pooledDb
          .update(results)
          .set({ lastSentInDigestAt: new Date() })
          .where(inArray(results.id, resultIds));
      }

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

// Daily digest - runs every hour to catch 9 AM in every timezone worldwide
export const sendDailyDigest = inngest.createFunction(
  {
    id: "send-daily-digest",
    name: "Daily Digest (Worldwide)",
    retries: 2,
    timeouts: { finish: "30m" },
  },
  { cron: "0 * * * *" }, // Run every hour to catch 9 AM in all timezones
  async ({ step }) => {
    const TARGET_HOUR = 9; // 9 AM local time

    // Get distinct timezones from users with daily email alerts (SQL JOIN instead of loading all user data)
    // DB: Safety limit on timezone query — FIX-104
    const uniqueTimezones = await step.run("get-unique-timezones", async () => {
      const rows = await pooledDb
        .selectDistinct({ timezone: users.timezone })
        .from(users)
        .innerJoin(monitors, eq(monitors.userId, users.id))
        .innerJoin(alerts, eq(alerts.monitorId, monitors.id))
        .where(and(
          eq(alerts.isActive, true),
          eq(alerts.frequency, "daily"),
          eq(alerts.channel, "email"),
          sql`${users.timezone} IS NOT NULL`
        ))
        .limit(1000);
      return rows
        .map(r => r.timezone)
        .filter((tz): tz is string => tz !== null && isValidTimezone(tz));
    });

    // Find which timezones are currently at 9 AM
    const timezonesAt9AM = uniqueTimezones.filter(
      tz => getCurrentHourInTimezone(tz) === TARGET_HOUR
    );

    if (timezonesAt9AM.length === 0) {
      return {
        message: "No user timezones at 9 AM right now",
        totalTimezones: uniqueTimezones.length,
        checkedTimezones: uniqueTimezones.slice(0, 10).map(tz => ({
          timezone: tz,
          currentHour: getCurrentHourInTimezone(tz),
        })),
      };
    }

    const digestResults = await Promise.all(
      timezonesAt9AM.map(tz => sendDigestForTimezone(tz, DIGEST_CONFIGS.daily, step as unknown as DigestStep))
    );

    return {
      message: "Daily digest completed",
      processedTimezones: timezonesAt9AM,
      results: digestResults,
    };
  }
);

// Weekly digest - runs every hour on Mondays to catch 9 AM in every timezone
export const sendWeeklyDigest = inngest.createFunction(
  {
    id: "send-weekly-digest",
    name: "Weekly Digest (Worldwide)",
    retries: 2,
    timeouts: { finish: "30m" },
  },
  { cron: "0 * * * 1" }, // Run every hour on Mondays
  async ({ step }) => {
    const TARGET_HOUR = 9; // 9 AM local time

    // Get distinct timezones from users with weekly email alerts (SQL JOIN instead of loading all user data)
    const uniqueTimezones = await step.run("get-unique-timezones", async () => {
      const rows = await pooledDb
        .selectDistinct({ timezone: users.timezone })
        .from(users)
        .innerJoin(monitors, eq(monitors.userId, users.id))
        .innerJoin(alerts, eq(alerts.monitorId, monitors.id))
        .where(and(
          eq(alerts.isActive, true),
          eq(alerts.frequency, "weekly"),
          eq(alerts.channel, "email"),
          sql`${users.timezone} IS NOT NULL`
        ));
      return rows
        .map(r => r.timezone)
        .filter((tz): tz is string => tz !== null && isValidTimezone(tz));
    });

    // Find which timezones are at 9 AM AND it's Monday there
    const timezonesAt9AMOnMonday = uniqueTimezones.filter(
      tz => getCurrentHourInTimezone(tz) === TARGET_HOUR && getCurrentDayInTimezone(tz) === 1
    );

    if (timezonesAt9AMOnMonday.length === 0) {
      return {
        message: "No user timezones at 9 AM Monday right now",
        totalTimezones: uniqueTimezones.length,
        checkedTimezones: uniqueTimezones.slice(0, 10).map(tz => ({
          timezone: tz,
          currentHour: getCurrentHourInTimezone(tz),
          currentDay: getCurrentDayInTimezone(tz),
        })),
      };
    }

    const digestResults = await Promise.all(
      timezonesAt9AMOnMonday.map(tz => sendDigestForTimezone(tz, DIGEST_CONFIGS.weekly, step as unknown as DigestStep))
    );

    return {
      message: "Weekly digest completed",
      processedTimezones: timezonesAt9AMOnMonday,
      results: digestResults,
    };
  }
);

// Monthly digest - runs every hour on the 1st of each month to catch 9 AM in every timezone
export const sendMonthlyDigest = inngest.createFunction(
  {
    id: "send-monthly-digest",
    name: "Monthly Digest (Worldwide)",
    retries: 2,
    timeouts: { finish: "30m" },
  },
  { cron: "0 * 1 * *" }, // Run every hour on the 1st of each month
  async ({ step }) => {
    const TARGET_HOUR = 9; // 9 AM local time

    // Get distinct timezones from users with monthly email alerts (SQL JOIN instead of loading all user data)
    const uniqueTimezones = await step.run("get-unique-timezones", async () => {
      const rows = await pooledDb
        .selectDistinct({ timezone: users.timezone })
        .from(users)
        .innerJoin(monitors, eq(monitors.userId, users.id))
        .innerJoin(alerts, eq(alerts.monitorId, monitors.id))
        .where(and(
          eq(alerts.isActive, true),
          eq(alerts.frequency, "monthly"),
          eq(alerts.channel, "email"),
          sql`${users.timezone} IS NOT NULL`
        ));
      return rows
        .map(r => r.timezone)
        .filter((tz): tz is string => tz !== null && isValidTimezone(tz));
    });

    // Find which timezones are at 9 AM AND it's the 1st of the month there
    const timezonesAt9AMOn1st = uniqueTimezones.filter(
      tz => getCurrentHourInTimezone(tz) === TARGET_HOUR && getCurrentDayOfMonthInTimezone(tz) === 1
    );

    if (timezonesAt9AMOn1st.length === 0) {
      return {
        message: "No user timezones at 9 AM on the 1st right now",
        totalTimezones: uniqueTimezones.length,
        checkedTimezones: uniqueTimezones.slice(0, 10).map(tz => ({
          timezone: tz,
          currentHour: getCurrentHourInTimezone(tz),
          currentDayOfMonth: getCurrentDayOfMonthInTimezone(tz),
        })),
      };
    }

    const digestResults = await Promise.all(
      timezonesAt9AMOn1st.map(tz => sendDigestForTimezone(tz, DIGEST_CONFIGS.monthly, step as unknown as DigestStep))
    );

    return {
      message: "Monthly digest completed",
      processedTimezones: timezonesAt9AMOn1st,
      results: digestResults,
    };
  }
);
