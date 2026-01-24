import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { findRelevantSubredditsCached } from "@/lib/ai";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { searchRedditResilient } from "@/lib/reddit";
import { calculateStaggerDelay, formatStaggerDuration, addJitter, getStaggerWindow } from "../utils/stagger";

// Scan Reddit for new posts matching monitor keywords
export const monitorReddit = inngest.createFunction(
  {
    id: "monitor-reddit",
    name: "Monitor Reddit",
    retries: 3,
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    // Get all active monitors that include Reddit
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const redditMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("reddit")
    );

    if (redditMonitors.length === 0) {
      return { message: "No active Reddit monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    // Calculate stagger window based on number of monitors
    const staggerWindow = getStaggerWindow("reddit");

    for (let i = 0; i < redditMonitors.length; i++) {
      const monitor = redditMonitors[i];

      // Stagger execution to prevent thundering herd
      if (i > 0 && redditMonitors.length > 3) {
        const baseDelay = calculateStaggerDelay(i, redditMonitors.length, staggerWindow);
        const delayWithJitter = addJitter(baseDelay, 10);
        const delayStr = formatStaggerDuration(delayWithJitter);
        await step.sleep(`stagger-${monitor.id}`, delayStr);
      }

      // Check if user has access to Reddit platform
      const access = await canAccessPlatform(monitor.userId, "reddit");
      if (!access.hasAccess) {
        continue; // Skip monitors for users without platform access
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue; // Skip monitors that are within refresh delay period
      }

      let monitorMatchCount = 0;

      // Get audience communities, use AI to find relevant subreddits, or fall back to defaults
      const subreddits = await step.run(`get-subreddits-${monitor.id}`, async () => {
        // First, check for user-defined audience
        if (monitor.audienceId) {
          const audience = await db.query.audiences.findFirst({
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
        // Use resilient Reddit search (Serper → Apify → Public JSON) with caching
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

        // Save matching posts as results
        if (matchingPosts.length > 0) {
          await step.run(`save-results-${monitor.id}-${subreddit}`, async () => {
            for (const post of matchingPosts) {
              // Build source URL
              const sourceUrl = post.url || `https://reddit.com${post.permalink}`;

              // Check if we already have this result
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, sourceUrl),
              });

              if (!existing) {
                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "reddit",
                  sourceUrl,
                  title: post.title,
                  content: post.selftext,
                  author: post.author,
                  postedAt: new Date(post.created_utc * 1000),
                  metadata: {
                    subreddit: post.subreddit,
                    score: post.score,
                    numComments: post.num_comments,
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
      message: `Scanned Reddit, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
