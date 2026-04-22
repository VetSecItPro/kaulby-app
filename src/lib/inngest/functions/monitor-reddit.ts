// Reddit scheduled monitor.
// Read `.github/runbooks/reddit-safety.md` (R12) before editing. Key rules:
// Apify primary → Public JSON fallback → Serper disabled by default. Actor
// swap or cadence changes require runbook update.
import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb } from "@/lib/db";
import { audiences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { findRelevantSubredditsCached } from "@/lib/ai";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { searchRedditResilient, searchRedditSiteWide, getRedditWatermark, setRedditWatermark } from "@/lib/reddit";
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

// Scan Reddit for new posts matching monitor keywords
export const monitorReddit = inngest.createFunction(
  {
    id: "monitor-reddit",
    name: "Monitor Reddit",
    retries: 3,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 */2 * * *" }, // Every 2 hours (matches fastest plan tier)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

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
      if (shouldSkipMonitor(monitor, planMap, "reddit")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      let monitorMatchCount = 0;
      const newResultIds: string[] = [];

      // Get audience communities, use AI to find relevant subreddits, or fall back to defaults
      const subreddits = await step.run(`get-subreddits-${monitor.id}`, async () => {
        // First, check for user-defined audience
        if (monitor.audienceId) {
          const audience = await pooledDb.query.audiences.findFirst({
            where: eq(audiences.id, monitor.audienceId),
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
            logger.info("[Reddit] Using AI to find subreddits", { companyName: monitor.companyName });
            const aiSubreddits = await findRelevantSubredditsCached(
              monitor.companyName,
              monitor.keywords,
              10
            );
            if (aiSubreddits.length > 0) {
              logger.info("[Reddit] AI suggested subreddits", { subreddits: aiSubreddits });
              return aiSubreddits;
            }
          } catch (error) {
            logger.error("[Reddit] AI subreddit finder failed", { error: error instanceof Error ? error.message : String(error) });
          }
        }

        // Fallback to generic business subreddits
        return ["AskReddit", "smallbusiness", "Entrepreneur", "business"];
      });

      // Build search terms: company name (quoted for exact match) + additional keywords
      const searchTerms = [
        ...(monitor.companyName ? [monitor.companyName] : []),
        ...monitor.keywords,
      ];

      for (const subreddit of subreddits) {
        // Use resilient Reddit search (Serper -> Apify -> Public JSON) with caching
        const searchResult = await step.run(`fetch-${monitor.id}-${subreddit}`, async () => {
          return searchRedditResilient(subreddit, searchTerms, 50);
        });

        if (searchResult.error) {
          logger.warn("[Reddit] Search warning", { subreddit, error: searchResult.error });
        }

        logger.info("[Reddit] Search complete", { source: searchResult.source, subreddit, postCount: searchResult.posts.length });

        // COA 4 W2.1 — Read watermark for this (user, subreddit). Posts are
        // ordered newest-first; once we hit the URL we saw on the previous run
        // we can stop processing (everything from there is already ingested).
        const watermark = await step.run(`watermark-read-${monitor.id}-${subreddit}`, async () => {
          return getRedditWatermark(monitor.userId, subreddit);
        });

        const postsToProcess: typeof searchResult.posts = [];
        for (const post of searchResult.posts) {
          const postUrl = post.url || `https://reddit.com${post.permalink}`;
          if (watermark && postUrl === watermark) break;
          postsToProcess.push(post);
        }

        if (watermark && postsToProcess.length < searchResult.posts.length) {
          logger.debug("[Reddit] watermark short-circuit", {
            subreddit,
            processed: postsToProcess.length,
            total: searchResult.posts.length,
          });
        }

        // Check each post for matches using content matcher
        // Supports: company name, keywords, and advanced boolean search
        const matchingPosts = postsToProcess.filter((post) => {
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

        // COA 4 W2.1 — Update watermark to the newest post URL from this scan
        // (regardless of match — we still don't want to re-process it next run).
        // Uses posts[0] since Reddit returns newest-first.
        const newestPost = searchResult.posts[0];
        if (newestPost) {
          const newestUrl = newestPost.url || `https://reddit.com${newestPost.permalink}`;
          await step.run(`watermark-write-${monitor.id}-${subreddit}`, async () => {
            await setRedditWatermark(monitor.userId, subreddit, newestUrl);
          });
        }
      }

      // Fallback: if subreddit-specific searches found nothing, try site-wide Reddit search
      if (monitorMatchCount === 0 && searchTerms.length > 0) {
        const siteWideResult = await step.run(`reddit-sitewide-${monitor.id}`, async () => {
          return searchRedditSiteWide(searchTerms, 50);
        });

        if (siteWideResult.posts.length > 0) {
          logger.info("[Reddit] Site-wide fallback found posts", { count: siteWideResult.posts.length, monitorId: monitor.id });

          const siteWideMatches = siteWideResult.posts.filter((post) => {
            const matchResult = contentMatchesMonitor(
              { title: post.title, body: post.selftext, author: post.author, subreddit: post.subreddit },
              { companyName: monitor.companyName, keywords: monitor.keywords, searchQuery: monitor.searchQuery }
            );
            return matchResult.matches;
          });

          if (siteWideMatches.length > 0) {
            const { count: swCount, ids: swIds } = await saveNewResults({
              items: siteWideMatches,
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
                metadata: { subreddit: post.subreddit, score: post.score, numComments: post.num_comments, source: "sitewide-fallback" },
              }),
              step,
              stepSuffix: "sitewide",
            });

            totalResults += swCount;
            monitorMatchCount += swCount;
            newResultIds.push(...swIds);
          }
        }
      }

      // Trigger AI analysis ONCE with all accumulated newResultIds across subreddits
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "reddit", step);

      monitorResults[monitor.id] = monitorMatchCount;
      await updateMonitorStats(monitor.id, monitorMatchCount, step, { userId: monitor.userId, platform: "reddit" });
    }

    return {
      message: `Scanned Reddit, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
