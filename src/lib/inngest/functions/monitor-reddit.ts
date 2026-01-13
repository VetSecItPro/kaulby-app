import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform } from "@/lib/limits";

// Reddit RSS feed URL
function getRedditRssUrl(subreddit: string): string {
  return `https://www.reddit.com/r/${subreddit}/new.json?limit=100`;
}

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    permalink: string;
    created_utc: number;
    score: number;
    num_comments: number;
    subreddit: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

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

    for (const monitor of redditMonitors) {
      // Check if user has access to Reddit platform
      const access = await canAccessPlatform(monitor.userId, "reddit");
      if (!access.hasAccess) {
        continue; // Skip monitors for users without platform access
      }

      let monitorMatchCount = 0;

      // Get audience communities or use default subreddits
      const subreddits = await step.run(`get-subreddits-${monitor.id}`, async () => {
        if (monitor.audienceId) {
          const audience = await db.query.audiences.findFirst({
            where: eq(monitors.id, monitor.audienceId),
            with: { communities: true },
          });
          return audience?.communities
            .filter((c) => c.platform === "reddit")
            .map((c) => c.identifier) || [];
        }
        // Default to popular subreddits if no audience defined
        return ["technology", "programming", "webdev", "startups", "SaaS"];
      });

      for (const subreddit of subreddits) {
        const posts = await step.run(`fetch-${monitor.id}-${subreddit}`, async () => {
          try {
            const response = await fetch(getRedditRssUrl(subreddit), {
              headers: {
                "User-Agent": "Kaulby/1.0",
              },
            });

            if (!response.ok) {
              console.error(`Failed to fetch r/${subreddit}: ${response.status}`);
              return [];
            }

            const data: RedditResponse = await response.json();
            return data.data.children;
          } catch (error) {
            console.error(`Error fetching r/${subreddit}:`, error);
            return [];
          }
        });

        // Check each post for keyword matches
        const matchingPosts = posts.filter((post) => {
          const text = `${post.data.title} ${post.data.selftext}`.toLowerCase();
          return monitor.keywords.some((keyword) =>
            text.includes(keyword.toLowerCase())
          );
        });

        // Save matching posts as results
        if (matchingPosts.length > 0) {
          await step.run(`save-results-${monitor.id}-${subreddit}`, async () => {
            for (const post of matchingPosts) {
              // Check if we already have this result
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, `https://reddit.com${post.data.permalink}`),
              });

              if (!existing) {
                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "reddit",
                  sourceUrl: `https://reddit.com${post.data.permalink}`,
                  title: post.data.title,
                  content: post.data.selftext,
                  author: post.data.author,
                  postedAt: new Date(post.data.created_utc * 1000),
                  metadata: {
                    subreddit: post.data.subreddit,
                    score: post.data.score,
                    numComments: post.data.num_comments,
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
