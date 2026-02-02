import { inngest } from "../client";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { searchMultipleKeywords, getStoryUrl, type HNAlgoliaStory } from "@/lib/hackernews";
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

// Scan Hacker News for new posts matching monitor keywords
// Uses Algolia HN Search API for efficient keyword-based searching
export const monitorHackerNews = inngest.createFunction(
  {
    id: "monitor-hackernews",
    name: "Monitor Hacker News",
    retries: 3,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    const hnMonitors = await getActiveMonitors("hackernews", step);
    if (hnMonitors.length === 0) {
      return { message: "No active Hacker News monitors" };
    }

    const planMap = await prefetchPlans(hnMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < hnMonitors.length; i++) {
      const monitor = hnMonitors[i];

      await applyStagger(i, hnMonitors.length, "hackernews", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "hackernews")) continue;

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

      // Filter out null/undefined stories before saving
      const validStories = matchingStories.filter((s): s is HNAlgoliaStory => !!s);

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<HNAlgoliaStory>({
        items: validStories,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (story) => getStoryUrl(story.objectID),
        mapToResult: (story) => ({
          monitorId: monitor.id,
          platform: "hackernews" as const,
          sourceUrl: getStoryUrl(story.objectID),
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
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "hackernews", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Hacker News, found ${totalResults} new matching stories`,
      totalResults,
      monitorResults,
    };
  }
);
