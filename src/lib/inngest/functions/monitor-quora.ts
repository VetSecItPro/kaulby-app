import { inngest } from "../client";
import { logger } from "@/lib/logger";
import {
  searchQuoraSerper,
  isSerperConfigured,
  type QuoraAnswerItem,
} from "@/lib/serper";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  updateSkippedMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  hasAnyActiveMonitors,
  type MonitorStep,
} from "../utils/monitor-helpers";

/**
 * Monitor Quora for Q&A discussions via Serper (Google Search)
 *
 * Uses Google Search to find Quora questions and answers — legally compliant,
 * no direct scraping of Quora's site.
 *
 * Searches Quora for questions and answers containing the monitor's keywords.
 * Great for finding pain points, solution requests, and product discussions.
 */
export const monitorQuora = inngest.createFunction(
  {
    id: "monitor-quora",
    name: "Monitor Quora",
    retries: 2,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "31 1-23/2 * * *" }, // :31 on odd hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    if (!isSerperConfigured()) {
      return { message: "Serper API key not configured, skipping Quora monitoring" };
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
      if (shouldSkipMonitor(monitor, planMap, "quora")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      let monitorCount = 0;
      let allNewResultIds: string[] = [];

      // For Quora, keywords are search queries to find relevant discussions
      for (const keyword of monitor.keywords) {
        // Fetch answers via Serper (Google Search)
        const ki = monitor.keywords.indexOf(keyword);
        const answers = await step.run(`fetch-quora-${monitor.id}-kw${ki}`, async () => {
          try {
            return await searchQuoraSerper(keyword, 15);
          } catch (error) {
            logger.error("[Quora] Error searching via Serper", { keyword, error: error instanceof Error ? error.message : String(error) });
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
          stepSuffix: `kw${ki}`,
        });

        monitorCount += count;
        allNewResultIds = allNewResultIds.concat(newResultIds);
      }

      totalResults += monitorCount;
      await triggerAiAnalysis(allNewResultIds, monitor.id, monitor.userId, "quora", step);

      monitorResults[monitor.id] = monitorCount;
      await updateMonitorStats(monitor.id, monitorCount, step, { userId: monitor.userId, platform: "quora" });
    }

    return {
      message: `Scanned Quora via Serper, found ${totalResults} new answers`,
      totalResults,
      monitorResults,
    };
  }
);
