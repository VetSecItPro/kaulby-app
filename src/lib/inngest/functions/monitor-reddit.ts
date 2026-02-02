import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { findRelevantSubredditsCached } from "@/lib/ai";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { searchRedditResilient } from "@/lib/reddit";
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

// Scan Reddit for new posts matching monitor keywords
export const monitorReddit = inngest.createFunction(
  {
    id: "monitor-reddit",
    name: "Monitor Reddit",
    retries: 3,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    const redditMonitors = await getActiveMonitors("reddit", step);
    if (redditMonitors.length === 0) {
      return { message: "No active Reddit monitors" };
    }

    const planMap = await prefetchPlans(redditMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < redditMonitors.length; i++) {
      const monitor = redditMonitors[i];

      await applyStagger(i, redditMonitors.length, "reddit", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "reddit")) continue;

      let monitorMatchCount = 0;
      const newResultIds: string[] = [];

      // Get audience communities, use AI to find relevant subreddits, or fall back to defaults
      const subreddits = await step.run(`get-subreddits-${monitor.id}`, async () => {
        // First, check for user-defined audience
        if (monitor.audienceId) {
          const audience = await pooledDb.query.audiences.findFirst({
            where: eq(monitors.id, monitor.audienceId),
            with: { communities: true },
          });
          const audienceSubreddits = audience?.communities
            .filter((c) => c.platform === "reddit")
            .map((c) => c.identifier) || [];
          if (audienceSubreddits.length > 0) {
            return audienceSubreddits;
          }
        }

        // Use AI to find relevant subreddits based on company name
        if (monitor.companyName) {
          try {
            console.log(`[Reddit] Using AI to find subreddits for "${monitor.companyName}"`);
            const aiSubreddits = await findRelevantSubredditsCached(
              monitor.companyName,
              monitor.keywords,
              10
            );
            if (aiSubreddits.length > 0) {
              console.log(`[Reddit] AI suggested: ${aiSubreddits.join(", ")}`);
              return aiSubreddits;
            }
          } catch (error) {
            console.error("[Reddit] AI subreddit finder failed:", error);
          }
        }

        // Fallback to generic business subreddits
        return ["AskReddit", "smallbusiness", "Entrepreneur", "business"];
      });

      for (const subreddit of subreddits) {
        // Use resilient Reddit search (Serper -> Apify -> Public JSON) with caching
        const searchResult = await step.run(`fetch-${monitor.id}-${subreddit}`, async () => {
          return searchRedditResilient(subreddit, monitor.keywords, 50);
        });

        if (searchResult.error) {
          console.warn(`[Reddit] Search warning for r/${subreddit}: ${searchResult.error}`);
        }

        console.log(`[Reddit] Using ${searchResult.source} for r/${subreddit}, found ${searchResult.posts.length} posts`);

        // Check each post for matches using content matcher
        // Supports: company name, keywords, and advanced boolean search
        const matchingPosts = searchResult.posts.filter((post) => {
          const matchResult = contentMatchesMonitor(
            {
              title: post.title,
              body: post.selftext,
              author: post.author,
              subreddit: post.subreddit,
            },
            {
              companyName: monitor.companyName,
              keywords: monitor.keywords,
              searchQuery: monitor.searchQuery,
            }
          );
          return matchResult.matches;
        });

        // Save matching posts as results (batch operation)
        if (matchingPosts.length > 0) {
          const { count, ids } = await saveNewResults({
            items: matchingPosts,
            monitorId: monitor.id,
            userId: monitor.userId,
            getSourceUrl: (post) => post.url || `https://reddit.com${post.permalink}`,
            mapToResult: (post) => ({
              monitorId: monitor.id,
              platform: "reddit" as const,
              sourceUrl: post.url || `https://reddit.com${post.permalink}`,
              title: post.title,
              content: post.selftext,
              author: post.author,
              postedAt: new Date(post.created_utc * 1000),
              metadata: {
                subreddit: post.subreddit,
                score: post.score,
                numComments: post.num_comments,
              },
            }),
            step,
            stepSuffix: subreddit,
          });

          totalResults += count;
          monitorMatchCount += count;
          newResultIds.push(...ids);
        }
      }

      // Trigger AI analysis ONCE with all accumulated newResultIds across subreddits
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "reddit", step);

      monitorResults[monitor.id] = monitorMatchCount;
      await updateMonitorStats(monitor.id, monitorMatchCount, step);
    }

    return {
      message: `Scanned Reddit, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
