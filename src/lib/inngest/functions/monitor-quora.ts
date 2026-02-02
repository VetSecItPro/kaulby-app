import { inngest } from "../client";
import { fetchQuoraAnswers, isApifyConfigured, type QuoraAnswerItem } from "@/lib/apify";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  type MonitorStep,
} from "../utils/monitor-helpers";

/**
 * Monitor Quora for Q&A discussions matching keywords
 *
 * Searches Quora for questions and answers containing the monitor's keywords.
 * Great for finding pain points, solution requests, and product discussions.
 *
 * Runs every hour - shouldProcessMonitor() handles tier-based delays:
 * - Team: every 2 hours
 * - Pro: every 4 hours
 * - Free: every 24 hours (but Quora is Team only)
 */
export const monitorQuora = inngest.createFunction(
  {
    id: "monitor-quora",
    name: "Monitor Quora",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 * * * *" }, // Every hour (tier-based delays apply)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Quora monitoring" };
    }

    const quoraMonitors = await getActiveMonitors("quora", step);
    if (quoraMonitors.length === 0) {
      return { message: "No active Quora monitors" };
    }

    const planMap = await prefetchPlans(quoraMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < quoraMonitors.length; i++) {
      const monitor = quoraMonitors[i];

      await applyStagger(i, quoraMonitors.length, "quora", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "quora")) continue;

      let monitorCount = 0;
      let allNewResultIds: string[] = [];

      // For Quora, keywords are search queries to find relevant discussions
      for (const keyword of monitor.keywords) {
        // Fetch answers (platform-specific)
        const answers = await step.run(`fetch-quora-${monitor.id}-${keyword.slice(0, 20)}`, async () => {
          try {
            return await fetchQuoraAnswers(keyword, 15);
          } catch (error) {
            console.error(`Error fetching Quora answers for "${keyword}":`, error);
            return [] as QuoraAnswerItem[];
          }
        });

        // Save new results per keyword
        const { count, ids: newResultIds } = await saveNewResults<QuoraAnswerItem>({
          items: answers,
          monitorId: monitor.id,
          userId: monitor.userId,
          getSourceUrl: (a) =>
            a.answerUrl || a.questionUrl || `quora-${a.questionId}-${a.answerId || "q"}`,
          mapToResult: (a) => ({
            monitorId: monitor.id,
            platform: "quora" as const,
            sourceUrl: a.answerUrl || a.questionUrl || `quora-${a.questionId}-${a.answerId || "q"}`,
            title: a.questionTitle,
            content: a.answerText,
            author: a.answerAuthor,
            postedAt: a.answerDate ? new Date(a.answerDate) : new Date(),
            metadata: {
              quoraQuestionId: a.questionId,
              quoraAnswerId: a.answerId,
              upvotes: a.upvotes,
              views: a.views,
              questionUrl: a.questionUrl,
            },
          }),
          step,
          stepSuffix: keyword.slice(0, 20),
        });

        monitorCount += count;
        allNewResultIds = allNewResultIds.concat(newResultIds);
      }

      totalResults += monitorCount;
      await triggerAiAnalysis(allNewResultIds, monitor.id, monitor.userId, "quora", step);

      monitorResults[monitor.id] = monitorCount;
      await updateMonitorStats(monitor.id, monitorCount, step);
    }

    return {
      message: `Scanned Quora, found ${totalResults} new answers`,
      totalResults,
      monitorResults,
    };
  }
);
