import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb, users, monitors, results, alerts } from "@/lib/db";
import { eq, and, gte, inArray, sql, desc } from "drizzle-orm";
import { sendAlertEmail } from "@/lib/email";
import { sendWebhookNotification } from "@/lib/notifications";

const DEFAULT_THRESHOLDS = {
  negativeSpikePct: 50,
  viralEngagement: 100,
  minNegativeCount: 5,
  volumeSpikeMultiplier: 2,
};

interface CrisisThresholds {
  negativeSpikePct: number;
  viralEngagement: number;
  minNegativeCount: number;
  volumeSpikeMultiplier: number;
}

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

/** Merge per-monitor thresholds with defaults, validating each value */
function resolveThresholds(
  raw: Partial<CrisisThresholds> | null | undefined,
): CrisisThresholds {
  if (!raw) return { ...DEFAULT_THRESHOLDS };
  return {
    negativeSpikePct:
      typeof raw.negativeSpikePct === "number" && raw.negativeSpikePct > 0
        ? raw.negativeSpikePct
        : DEFAULT_THRESHOLDS.negativeSpikePct,
    viralEngagement:
      typeof raw.viralEngagement === "number" && raw.viralEngagement > 0
        ? raw.viralEngagement
        : DEFAULT_THRESHOLDS.viralEngagement,
    minNegativeCount:
      typeof raw.minNegativeCount === "number" && raw.minNegativeCount > 0
        ? raw.minNegativeCount
        : DEFAULT_THRESHOLDS.minNegativeCount,
    volumeSpikeMultiplier:
      typeof raw.volumeSpikeMultiplier === "number" && raw.volumeSpikeMultiplier > 1
        ? raw.volumeSpikeMultiplier
        : DEFAULT_THRESHOLDS.volumeSpikeMultiplier,
  };
}

/**
 * Crisis Detection Function
 *
 * Runs every hour to detect:
 * 1. Sudden spikes in negative sentiment (configurable % increase)
 * 2. Viral negative posts (configurable engagement threshold)
 * 3. Volume spikes with negative sentiment (configurable multiplier)
 *
 * Thresholds are configurable per-monitor via the crisisThresholds column.
 * Only runs for Team tier users.
 */
export const detectCrisis = inngest.createFunction(
  {
    id: "detect-crisis",
    name: "Crisis Detection",
    timeouts: { finish: "15m" },
  },
  { cron: "0 */4 * * *" }, // Every 4 hours (analyzes 24h windows, 4h granularity is sufficient)
  async ({ step }) => {
    // Get all Team tier users with active monitors
    const teamUsers = await step.run("get-team-users", async () => {
      return pooledDb.query.users.findMany({
        where: eq(users.subscriptionStatus, "growth"),
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

    // Process users in parallel batches of 10
    const USER_BATCH_SIZE = 10;
    for (let i = 0; i < teamUsers.length; i += USER_BATCH_SIZE) {
      const batch = teamUsers.slice(i, i + USER_BATCH_SIZE);
      await Promise.all(batch.map(user => step.run(`check-user-${user.id}`, async () => {
        // Get user's active monitors (including crisisThresholds)
        const userMonitors = await pooledDb.query.monitors.findMany({
          where: and(
            eq(monitors.userId, user.id),
            eq(monitors.isActive, true)
          ),
          columns: {
            id: true,
            name: true,
            companyName: true,
            crisisThresholds: true,
          },
        });

        if (userMonitors.length === 0) return;

        const monitorIds = userMonitors.map((m) => m.id);

        // Build per-monitor threshold map
        const thresholdsByMonitor = new Map<string, CrisisThresholds>();
        for (const m of userMonitors) {
          thresholdsByMonitor.set(m.id, resolveThresholds(m.crisisThresholds));
        }

        // Find the lowest viralEngagement threshold across all monitors
        // so the DB query captures all potentially viral posts
        const minViralEngagement = Math.min(
          ...userMonitors.map(
            (m) => resolveThresholds(m.crisisThresholds).viralEngagement,
          ),
        );

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

        // Get sentiment and total counts for previous 24h (needed for volume spike)
        const previousSentiment = await pooledDb
          .select({
            monitorId: results.monitorId,
            total: sql<number>`count(*)`,
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

        // Check for viral negative posts (using lowest threshold across monitors)
        const viralNegative = await pooledDb.query.results.findMany({
          where: and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, last24h),
            eq(results.sentiment, "negative"),
            gte(results.engagementScore, minViralEngagement)
          ),
          orderBy: [desc(results.engagementScore)],
          limit: 20, // Fetch more to filter per-monitor thresholds
          columns: {
            id: true,
            monitorId: true,
            title: true,
            platform: true,
            engagementScore: true,
          },
        });

        // PERF-ALGO-001: Build lookup maps to avoid O(n²) nested .find()/.filter()
        const currentSentimentByMonitor = new Map(
          currentSentiment.map(s => [s.monitorId, s])
        );
        const previousSentimentByMonitor = new Map(
          previousSentiment.map(s => [s.monitorId, s])
        );
        const viralByMonitor = new Map<string, typeof viralNegative>();
        for (const viral of viralNegative) {
          if (!viralByMonitor.has(viral.monitorId)) {
            viralByMonitor.set(viral.monitorId, []);
          }
          viralByMonitor.get(viral.monitorId)!.push(viral);
        }

        // Analyze each monitor
        for (const monitor of userMonitors) {
          const thresholds = thresholdsByMonitor.get(monitor.id)!;
          const current = currentSentimentByMonitor.get(monitor.id);
          const previous = previousSentimentByMonitor.get(monitor.id);

          const currentNegative = Number(current?.negative || 0);
          const previousNegative = Number(previous?.negative || 0);
          const currentTotal = Number(current?.total || 0);
          const previousTotal = Number(previous?.total || 0);

          // 1. Check for negative spike (configurable % increase with min negative count)
          if (previousNegative > 0 && currentNegative >= thresholds.minNegativeCount) {
            const percentageIncrease = ((currentNegative - previousNegative) / previousNegative) * 100;

            if (percentageIncrease >= thresholds.negativeSpikePct) {
              const monitorViralNegative = viralByMonitor.get(monitor.id) || [];

              crisisAlerts.push({
                userId: user.id,
                monitorId: monitor.id,
                monitorName: monitor.name,
                type: "negative_spike",
                severity: percentageIncrease >= thresholds.negativeSpikePct * 2 ? "critical" : "warning",
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

          // 2. Check for viral negative posts (using per-monitor engagement threshold)
          const allViralForMonitor = viralByMonitor.get(monitor.id) || [];
          // Filter by this monitor's specific threshold (DB query used the global minimum)
          const monitorViral = allViralForMonitor.filter(
            (r) => (r.engagementScore || 0) >= thresholds.viralEngagement,
          );
          if (monitorViral.length > 0) {
            const highestEngagement = monitorViral[0];
            crisisAlerts.push({
              userId: user.id,
              monitorId: monitor.id,
              monitorName: monitor.name,
              type: "viral_negative",
              severity: (highestEngagement.engagementScore || 0) >= thresholds.viralEngagement * 5 ? "critical" : "warning",
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

          // 3. Volume spike detection: total mentions jumped by multiplier AND has negatives
          if (
            previousTotal > 0 &&
            currentTotal > previousTotal * thresholds.volumeSpikeMultiplier &&
            currentNegative > 0
          ) {
            const volumeMultiplier = currentTotal / previousTotal;

            crisisAlerts.push({
              userId: user.id,
              monitorId: monitor.id,
              monitorName: monitor.name,
              type: "volume_spike",
              severity: volumeMultiplier >= thresholds.volumeSpikeMultiplier * 2 ? "critical" : "warning",
              message: `Volume spike detected: ${volumeMultiplier.toFixed(1)}x increase in total mentions (${previousTotal} → ${currentTotal}) with ${currentNegative} negative posts`,
              details: {
                currentNegative,
                previousNegative,
                percentageIncrease: ((currentTotal - previousTotal) / previousTotal) * 100,
              },
            });
          }
        }
      })));
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

      // Send email notifications grouped by user (parallel)
      await Promise.all(userIds.map(userId => {
        const userAlerts = alertsByUser[userId];
        return step.run(`send-crisis-email-${userId}`, async () => {
          const user = teamUsers.find((u) => u.id === userId);
          if (!user?.email) {
            logger.warn("No email found for user, skipping crisis email", { userId });
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
            logger.error("Failed to send crisis email", { userId, error: error instanceof Error ? error.message : String(error) });
          }
        });
      }));

      // Send webhook notifications (Slack/Discord) for each user's monitors (parallel)
      await Promise.all(userIds.map(userId => {
        const userAlerts = alertsByUser[userId];
        return step.run(`send-crisis-webhooks-${userId}`, async () => {
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
                logger.error("Crisis webhook failed", { type: result.type, error: result.error });
              }
            } catch (error) {
              logger.error("Failed to send crisis webhook", { destination: webhookAlert.destination, error: error instanceof Error ? error.message : String(error) });
            }
          }
        });
      }));

      logger.info("Crisis alerts processed", { alertCount: crisisAlerts.length, userCount: userIds.length });
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
