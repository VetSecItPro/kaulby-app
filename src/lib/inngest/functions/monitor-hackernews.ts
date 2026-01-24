import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { searchMultipleKeywords, getStoryUrl, type HNAlgoliaStory } from "@/lib/hackernews";
import { calculateStaggerDelay, formatStaggerDuration, addJitter, getStaggerWindow } from "../utils/stagger";

// Scan Hacker News for new posts matching monitor keywords
// Uses Algolia HN Search API for efficient keyword-based searching
export const monitorHackerNews = inngest.createFunction(
  {
    id: "monitor-hackernews",
    name: "Monitor Hacker News",
    retries: 3,
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    // Get all active monitors that include Hacker News
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const hnMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("hackernews")
    );

    if (hnMonitors.length === 0) {
      return { message: "No active Hacker News monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    // Calculate stagger window based on number of monitors
    const staggerWindow = getStaggerWindow("hackernews");

    for (let i = 0; i < hnMonitors.length; i++) {
      const monitor = hnMonitors[i];

      // Stagger execution to prevent thundering herd
      if (i > 0 && hnMonitors.length > 3) {
        const baseDelay = calculateStaggerDelay(i, hnMonitors.length, staggerWindow);
        const delayWithJitter = addJitter(baseDelay, 10);
        const delayStr = formatStaggerDuration(delayWithJitter);
        await step.sleep(`stagger-${monitor.id}`, delayStr);
      }

      // Check if user has access to Hacker News platform
      const access = await canAccessPlatform(monitor.userId, "hackernews");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // Build search keywords from monitor config
      const searchKeywords: string[] = [];
      if (monitor.companyName) {
        searchKeywords.push(monitor.companyName);
      }
      searchKeywords.push(...monitor.keywords);

      if (searchKeywords.length === 0) {
        continue; // No keywords to search for
      }

      // Use Algolia API to search for stories matching keywords (last 24 hours)
      const stories = await step.run(`search-hn-${monitor.id}`, async () => {
        try {
          return await searchMultipleKeywords(searchKeywords, 24);
        } catch (error) {
          console.error(`[HN Algolia] Search failed for monitor ${monitor.id}:`, error);
          return [];
        }
      });

      // Apply additional content matching for advanced search queries
      const matchingStories = stories.filter((story: HNAlgoliaStory) => {
        if (!story || !story.title) return false;

        // If monitor has an advanced search query, apply additional filtering
        if (monitor.searchQuery) {
          const matchResult = contentMatchesMonitor(
            {
              title: story.title,
              body: story.story_text || undefined,
              author: story.author,
            },
            {
              companyName: monitor.companyName,
              keywords: monitor.keywords,
              searchQuery: monitor.searchQuery,
            }
          );
          return matchResult.matches;
        }

        // Otherwise, the Algolia search already matched the keywords
        return true;
      });

      // Save matching stories as results
      if (matchingStories.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          for (const story of matchingStories) {
            if (!story) continue;

            // HN discussion URL (always use this as the primary source URL)
            const hnDiscussionUrl = getStoryUrl(story.objectID);

            // Check if we already have this result
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, hnDiscussionUrl),
            });

            if (!existing) {
              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "hackernews",
                sourceUrl: hnDiscussionUrl,
                title: story.title || "",
                content: story.story_text || null,
                author: story.author,
                postedAt: new Date(story.created_at_i * 1000),
                metadata: {
                  hnId: story.objectID,
                  score: story.points,
                  numComments: story.num_comments,
                  externalUrl: story.url,
                  tags: story._tags,
                  isAskHN: story._tags?.includes("ask_hn"),
                  isShowHN: story._tags?.includes("show_hn"),
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
      message: `Scanned Hacker News, found ${totalResults} new matching stories`,
      totalResults,
      monitorResults,
    };
  }
);
