import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { fetchQuoraAnswers, isApifyConfigured, type QuoraAnswerItem } from "@/lib/apify";

/**
 * Monitor Quora for Q&A discussions matching keywords
 *
 * Searches Quora for questions and answers containing the monitor's keywords.
 * Great for finding pain points, solution requests, and product discussions.
 *
 * Runs every 4 hours - Quora has frequent discussions worth monitoring
 */
export const monitorQuora = inngest.createFunction(
  {
    id: "monitor-quora",
    name: "Monitor Quora",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour (tier-based delays apply)
  async ({ step }) => {
    // Check if Apify is configured
    if (!isApifyConfigured()) {
      return { message: "Apify API key not configured, skipping Quora monitoring" };
    }

    // Get all active monitors that include Quora
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const quoraMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("quora")
    );

    if (quoraMonitors.length === 0) {
      return { message: "No active Quora monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of quoraMonitors) {
      // Check if user has access to Quora platform
      const access = await canAccessPlatform(monitor.userId, "quora");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // For Quora, keywords are search queries to find relevant discussions
      for (const keyword of monitor.keywords) {
        const answers = await step.run(`fetch-quora-${monitor.id}-${keyword.slice(0, 20)}`, async () => {
          try {
            const fetchedAnswers = await fetchQuoraAnswers(keyword, 15);
            return fetchedAnswers;
          } catch (error) {
            console.error(`Error fetching Quora answers for "${keyword}":`, error);
            return [] as QuoraAnswerItem[];
          }
        });

        // Save answers as results
        if (answers.length > 0) {
          await step.run(`save-results-${monitor.id}-${keyword.slice(0, 20)}`, async () => {
            for (const answer of answers) {
              // Generate a unique URL for deduplication
              const answerUrl = answer.answerUrl || answer.questionUrl || `quora-${answer.questionId}-${answer.answerId || "q"}`;

              // Check if we already have this result
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, answerUrl),
              });

              if (!existing) {
                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "quora",
                  sourceUrl: answerUrl,
                  title: answer.questionTitle,
                  content: answer.answerText,
                  author: answer.answerAuthor,
                  postedAt: answer.answerDate ? new Date(answer.answerDate) : new Date(),
                  metadata: {
                    quoraQuestionId: answer.questionId,
                    quoraAnswerId: answer.answerId,
                    upvotes: answer.upvotes,
                    views: answer.views,
                    questionUrl: answer.questionUrl,
                  },
                }).returning();

                totalResults++;
                monitorMatchCount++;

                // Increment usage count for the user
                await incrementResultsCount(monitor.userId, 1);

                // Trigger content analysis
                await inngest.send({
                  name: "content/analyze",
                  data: {
                    resultId: newResult.id,
                    userId: monitor.userId,
                  },
                });
              }
            }
          });
        }
      }

      // Update monitor stats
      monitorResults[monitor.id] = monitorMatchCount;

      await step.run(`update-monitor-stats-${monitor.id}`, async () => {
        await db
          .update(monitors)
          .set({
            lastCheckedAt: new Date(),
            newMatchCount: monitorMatchCount,
            updatedAt: new Date(),
          })
          .where(eq(monitors.id, monitor.id));
      });
    }

    return {
      message: `Scanned Quora, found ${totalResults} new answers`,
      totalResults,
      monitorResults,
    };
  }
);
