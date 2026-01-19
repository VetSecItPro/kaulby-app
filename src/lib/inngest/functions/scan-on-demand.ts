import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform } from "@/lib/limits";
import { fetchGoogleReviews, fetchTrustpilotReviews, fetchAppStoreReviews, fetchPlayStoreReviews, fetchQuoraAnswers, isApifyConfigured } from "@/lib/apify";
import { findRelevantSubredditsCached } from "@/lib/ai";
import { searchRedditResilient } from "@/lib/reddit";

/**
 * Scan a single monitor on-demand when user clicks "Scan Now"
 *
 * This function runs immediately when triggered and scans all platforms
 * configured for the monitor. It works independently of the cron jobs:
 * - Cron jobs run on schedule for all monitors
 * - This runs immediately for a single monitor
 * - Both can run concurrently without conflict (different result deduplication)
 */
export const scanOnDemand = inngest.createFunction(
  {
    id: "scan-on-demand",
    name: "Scan Monitor On-Demand",
    retries: 2,
    concurrency: {
      limit: 5, // Limit concurrent scans to prevent overload
    },
  },
  { event: "monitor/scan-now" },
  async ({ event, step }) => {
    const { monitorId, userId } = event.data;

    // Get the monitor
    const monitor = await step.run("get-monitor", async () => {
      return db.query.monitors.findFirst({
        where: eq(monitors.id, monitorId),
      });
    });

    if (!monitor) {
      return { error: "Monitor not found" };
    }

    if (monitor.userId !== userId) {
      return { error: "Unauthorized" };
    }

    // Mark as scanning
    await step.run("mark-scanning", async () => {
      await db
        .update(monitors)
        .set({ isScanning: true })
        .where(eq(monitors.id, monitorId));
    });

    let totalResults = 0;
    const platformResults: Record<string, number> = {};

    try {
      // Scan each platform configured for this monitor
      for (const platform of monitor.platforms) {
        // Check platform access
        const access = await canAccessPlatform(userId, platform);
        if (!access.hasAccess) continue;

        let platformCount = 0;

        switch (platform) {
          case "reddit":
            platformCount = await step.run(`scan-reddit-${monitorId}`, async () => {
              return scanRedditForMonitor(monitor);
            });
            break;

          case "hackernews":
            platformCount = await step.run(`scan-hackernews-${monitorId}`, async () => {
              return scanHackerNewsForMonitor(monitor);
            });
            break;

          case "googlereviews":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-googlereviews-${monitorId}`, async () => {
                return scanGoogleReviewsForMonitor(monitor);
              });
            }
            break;

          case "trustpilot":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-trustpilot-${monitorId}`, async () => {
                return scanTrustpilotForMonitor(monitor);
              });
            }
            break;

          case "appstore":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-appstore-${monitorId}`, async () => {
                return scanAppStoreForMonitor(monitor);
              });
            }
            break;

          case "playstore":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-playstore-${monitorId}`, async () => {
                return scanPlayStoreForMonitor(monitor);
              });
            }
            break;

          case "quora":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-quora-${monitorId}`, async () => {
                return scanQuoraForMonitor(monitor);
              });
            }
            break;

          case "producthunt":
            platformCount = await step.run(`scan-producthunt-${monitorId}`, async () => {
              return scanProductHuntForMonitor(monitor);
            });
            break;

          case "devto":
            platformCount = await step.run(`scan-devto-${monitorId}`, async () => {
              return scanDevToForMonitor(monitor);
            });
            break;
        }

        platformResults[platform] = platformCount;
        totalResults += platformCount;
      }

      // Update monitor stats and mark scan complete
      await step.run("complete-scan", async () => {
        await db
          .update(monitors)
          .set({
            isScanning: false,
            lastManualScanAt: new Date(),
            lastCheckedAt: new Date(),
            newMatchCount: totalResults,
            updatedAt: new Date(),
          })
          .where(eq(monitors.id, monitorId));
      });

      return {
        success: true,
        monitorId,
        totalResults,
        platformResults,
      };
    } catch (error) {
      // Make sure to reset scanning state on error
      await step.run("reset-scanning-on-error", async () => {
        await db
          .update(monitors)
          .set({ isScanning: false })
          .where(eq(monitors.id, monitorId));
      });

      throw error;
    }
  }
);

// ============================================================================
// Platform-specific scanning functions
// ============================================================================

interface MonitorData {
  id: string;
  userId: string;
  companyName: string | null;
  keywords: string[];
  audienceId: string | null;
}

async function scanRedditForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Get subreddits to scan - prioritize user-defined audiences, then AI discovery
  let subreddits: string[] = [];

  // First, check for user-defined audience
  if (monitor.audienceId) {
    const audience = await db.query.audiences.findFirst({
      where: eq(monitors.id, monitor.audienceId),
      with: { communities: true },
    });
    if (audience?.communities) {
      subreddits = audience.communities
        .filter((c) => c.platform === "reddit")
        .map((c) => c.identifier);
    }
  }

  // If no audience defined, use AI to find relevant subreddits
  if (subreddits.length === 0 && monitor.companyName) {
    try {
      console.log(`[Reddit] Using AI to find subreddits for "${monitor.companyName}"`);
      subreddits = await findRelevantSubredditsCached(
        monitor.companyName,
        monitor.keywords,
        10
      );
      console.log(`[Reddit] AI suggested subreddits: ${subreddits.join(", ")}`);
    } catch (error) {
      console.error("[Reddit] AI subreddit finder failed:", error);
    }
  }

  // Fallback to generic subreddits only if everything else fails
  if (subreddits.length === 0) {
    subreddits = ["AskReddit", "smallbusiness", "Entrepreneur", "business"];
  }

  for (const subreddit of subreddits) {
    try {
      // Use resilient Reddit search (Serper → Apify → Public JSON)
      const searchResult = await searchRedditResilient(subreddit, monitor.keywords, 50);

      if (searchResult.error) {
        console.warn(`[Reddit] Search warning for r/${subreddit}: ${searchResult.error}`);
      }

      console.log(`[Reddit] Using ${searchResult.source} for r/${subreddit}, found ${searchResult.posts.length} posts`);

      for (const post of searchResult.posts) {
        const text = `${post.title} ${post.selftext}`.toLowerCase();

        // Check for matches
        let isMatch = false;
        if (monitor.companyName && text.includes(monitor.companyName.toLowerCase())) {
          isMatch = true;
        } else if (monitor.keywords.length > 0) {
          isMatch = monitor.keywords.some((k) => text.includes(k.toLowerCase()));
        }

        if (isMatch) {
          const sourceUrl = post.url || `https://reddit.com${post.permalink}`;
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
                source: searchResult.source, // Track which provider was used
              },
            }).returning();

            count++;
            await incrementResultsCount(monitor.userId, 1);

            // Trigger content analysis
            await inngest.send({
              name: "content/analyze",
              data: { resultId: newResult.id, userId: monitor.userId },
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning r/${subreddit}:`, error);
    }
  }

  return count;
}

async function scanHackerNewsForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  try {
    // Fetch new stories
    const response = await fetch("https://hacker-news.firebaseio.com/v0/newstories.json");
    if (!response.ok) return 0;

    const storyIds: number[] = await response.json();
    const recentIds = storyIds.slice(0, 50);

    for (const id of recentIds) {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!storyRes.ok) continue;

        const story = await storyRes.json();
        if (!story || story.deleted || story.dead) continue;

        const text = `${story.title || ""} ${story.text || ""}`.toLowerCase();

        let isMatch = false;
        if (monitor.companyName && text.includes(monitor.companyName.toLowerCase())) {
          isMatch = true;
        } else if (monitor.keywords.length > 0) {
          isMatch = monitor.keywords.some((k) => text.includes(k.toLowerCase()));
        }

        if (isMatch) {
          const sourceUrl = `https://news.ycombinator.com/item?id=${id}`;
          const existing = await db.query.results.findFirst({
            where: eq(results.sourceUrl, sourceUrl),
          });

          if (!existing) {
            const [newResult] = await db.insert(results).values({
              monitorId: monitor.id,
              platform: "hackernews",
              sourceUrl,
              title: story.title || "HN Discussion",
              content: story.text || "",
              author: story.by,
              postedAt: story.time ? new Date(story.time * 1000) : new Date(),
              metadata: {
                hnId: id,
                score: story.score,
                descendants: story.descendants,
              },
            }).returning();

            count++;
            await incrementResultsCount(monitor.userId, 1);

            await inngest.send({
              name: "content/analyze",
              data: { resultId: newResult.id, userId: monitor.userId },
            });
          }
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error("Error scanning HN:", error);
  }

  return count;
}

async function scanGoogleReviewsForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Use keywords as business URLs/names, or companyName as fallback
  const searchTerms = monitor.keywords.length > 0
    ? monitor.keywords
    : monitor.companyName
      ? [monitor.companyName]
      : [];

  for (const term of searchTerms) {
    try {
      const reviews = await fetchGoogleReviews(term, 20);

      for (const review of reviews) {
        const sourceUrl = review.reviewUrl || `google-${review.reviewId}`;
        const existing = await db.query.results.findFirst({
          where: eq(results.sourceUrl, sourceUrl),
        });

        if (!existing) {
          const [newResult] = await db.insert(results).values({
            monitorId: monitor.id,
            platform: "googlereviews",
            sourceUrl,
            title: `${review.stars}-star review`,
            content: review.text,
            author: review.name,
            postedAt: review.publishedAtDate ? new Date(review.publishedAtDate) : new Date(),
            metadata: {
              googleReviewId: review.reviewId,
              rating: review.stars,
              placeId: review.placeId,
            },
          }).returning();

          count++;
          await incrementResultsCount(monitor.userId, 1);

          await inngest.send({
            name: "content/analyze",
            data: { resultId: newResult.id, userId: monitor.userId },
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning Google Reviews for "${term}":`, error);
    }
  }

  return count;
}

async function scanTrustpilotForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  const searchTerms = monitor.keywords.length > 0
    ? monitor.keywords
    : monitor.companyName
      ? [monitor.companyName]
      : [];

  for (const term of searchTerms) {
    try {
      const reviews = await fetchTrustpilotReviews(term, 20);

      for (const review of reviews) {
        const sourceUrl = review.url || `trustpilot-${review.id}`;
        const existing = await db.query.results.findFirst({
          where: eq(results.sourceUrl, sourceUrl),
        });

        if (!existing) {
          const [newResult] = await db.insert(results).values({
            monitorId: monitor.id,
            platform: "trustpilot",
            sourceUrl,
            title: review.title || `${review.rating}-star review`,
            content: review.text,
            author: review.author,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              trustpilotId: review.id,
              rating: review.rating,
              authorLocation: review.authorLocation,
            },
          }).returning();

          count++;
          await incrementResultsCount(monitor.userId, 1);

          await inngest.send({
            name: "content/analyze",
            data: { resultId: newResult.id, userId: monitor.userId },
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning Trustpilot for "${term}":`, error);
    }
  }

  return count;
}

async function scanAppStoreForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  const appIds = monitor.keywords.length > 0 ? monitor.keywords : [];

  for (const appId of appIds) {
    try {
      const reviews = await fetchAppStoreReviews(appId, 20);

      for (const review of reviews) {
        const sourceUrl = review.url || `appstore-${review.id}`;
        const existing = await db.query.results.findFirst({
          where: eq(results.sourceUrl, sourceUrl),
        });

        if (!existing) {
          const [newResult] = await db.insert(results).values({
            monitorId: monitor.id,
            platform: "appstore",
            sourceUrl,
            title: review.title || `${review.rating}-star review`,
            content: review.text,
            author: review.userName,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              appStoreReviewId: review.id,
              rating: review.rating,
              appVersion: review.version,
            },
          }).returning();

          count++;
          await incrementResultsCount(monitor.userId, 1);

          await inngest.send({
            name: "content/analyze",
            data: { resultId: newResult.id, userId: monitor.userId },
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning App Store for "${appId}":`, error);
    }
  }

  return count;
}

async function scanPlayStoreForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  const appIds = monitor.keywords.length > 0 ? monitor.keywords : [];

  for (const appId of appIds) {
    try {
      const reviews = await fetchPlayStoreReviews(appId, 20);

      for (const review of reviews) {
        const sourceUrl = review.url || `playstore-${review.reviewId}`;
        const existing = await db.query.results.findFirst({
          where: eq(results.sourceUrl, sourceUrl),
        });

        if (!existing) {
          const [newResult] = await db.insert(results).values({
            monitorId: monitor.id,
            platform: "playstore",
            sourceUrl,
            title: `${review.score}-star review`,
            content: review.text,
            author: review.userName,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              playStoreReviewId: review.reviewId,
              rating: review.score,
              appVersion: review.appVersion,
              thumbsUp: review.thumbsUpCount,
            },
          }).returning();

          count++;
          await incrementResultsCount(monitor.userId, 1);

          await inngest.send({
            name: "content/analyze",
            data: { resultId: newResult.id, userId: monitor.userId },
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning Play Store for "${appId}":`, error);
    }
  }

  return count;
}

async function scanQuoraForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  const searchTerms = monitor.keywords.length > 0
    ? monitor.keywords
    : monitor.companyName
      ? [monitor.companyName]
      : [];

  for (const term of searchTerms) {
    try {
      const answers = await fetchQuoraAnswers(term, 15);

      for (const answer of answers) {
        const sourceUrl = answer.answerUrl || answer.questionUrl || `quora-${answer.questionId}-${answer.answerId || "q"}`;
        const existing = await db.query.results.findFirst({
          where: eq(results.sourceUrl, sourceUrl),
        });

        if (!existing) {
          const [newResult] = await db.insert(results).values({
            monitorId: monitor.id,
            platform: "quora",
            sourceUrl,
            title: answer.questionTitle,
            content: answer.answerText,
            author: answer.answerAuthor,
            postedAt: answer.answerDate ? new Date(answer.answerDate) : new Date(),
            metadata: {
              quoraQuestionId: answer.questionId,
              quoraAnswerId: answer.answerId,
              upvotes: answer.upvotes,
              views: answer.views,
            },
          }).returning();

          count++;
          await incrementResultsCount(monitor.userId, 1);

          await inngest.send({
            name: "content/analyze",
            data: { resultId: newResult.id, userId: monitor.userId },
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning Quora for "${term}":`, error);
    }
  }

  return count;
}

// Product Hunt OAuth token cache (shared within this module)
let phAccessToken: string | null = null;
let phTokenExpiresAt: number = 0;

async function getProductHuntAccessToken(): Promise<string | null> {
  const clientId = process.env.PRODUCTHUNT_API_KEY;
  const clientSecret = process.env.PRODUCTHUNT_API_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[ProductHunt] Missing API credentials (need both API_KEY and API_SECRET)");
    return null;
  }

  // Return cached token if still valid (with 5 min buffer)
  if (phAccessToken && Date.now() < phTokenExpiresAt - 300000) {
    return phAccessToken;
  }

  try {
    const response = await fetch("https://api.producthunt.com/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ProductHunt] OAuth token request failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    phAccessToken = data.access_token;
    phTokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 86400000);

    console.log("[ProductHunt] Successfully obtained access token for on-demand scan");
    return phAccessToken;
  } catch (error) {
    console.error("[ProductHunt] Error getting access token:", error);
    return null;
  }
}

async function scanProductHuntForMonitor(monitor: MonitorData): Promise<number> {
  // Get OAuth access token
  const accessToken = await getProductHuntAccessToken();
  if (!accessToken) {
    console.log("[ProductHunt] OAuth authentication failed, skipping on-demand scan");
    return 0;
  }

  let count = 0;

  try {
    const query = `
      query {
        posts(first: 50, order: NEWEST) {
          edges {
            node {
              id
              name
              tagline
              description
              url
              votesCount
              createdAt
              user {
                name
              }
            }
          }
        }
      }
    `;

    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`[ProductHunt] Failed to fetch: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    const posts = data.data?.posts?.edges?.map((e: { node: unknown }) => e.node) || [];

    for (const post of posts) {
      // Check if post matches monitor keywords
      const text = `${post.name} ${post.tagline} ${post.description || ""}`.toLowerCase();
      const isMatch = monitor.keywords.some((keyword: string) =>
        text.includes(keyword.toLowerCase())
      );

      if (!isMatch) continue;

      // Check for existing result
      const existing = await db.query.results.findFirst({
        where: eq(results.sourceUrl, post.url),
      });

      if (!existing) {
        const [newResult] = await db.insert(results).values({
          monitorId: monitor.id,
          platform: "producthunt",
          sourceUrl: post.url,
          title: `${post.name} - ${post.tagline}`,
          content: post.description || null,
          author: post.user?.name || null,
          postedAt: new Date(post.createdAt),
          metadata: {
            phId: post.id,
            votesCount: post.votesCount,
          },
        }).returning();

        count++;
        await incrementResultsCount(monitor.userId, 1);

        await inngest.send({
          name: "content/analyze",
          data: { resultId: newResult.id, userId: monitor.userId },
        });
      }
    }
  } catch (error) {
    console.error("[ProductHunt] Error in on-demand scan:", error);
  }

  return count;
}

async function scanDevToForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  const searchTerms = monitor.keywords.length > 0
    ? monitor.keywords
    : monitor.companyName
      ? [monitor.companyName]
      : [];

  for (const term of searchTerms) {
    try {
      const response = await fetch(`https://dev.to/api/articles?tag=${encodeURIComponent(term)}&per_page=30`);
      if (!response.ok) continue;

      const articles = await response.json();

      for (const article of articles) {
        const sourceUrl = article.url;
        const existing = await db.query.results.findFirst({
          where: eq(results.sourceUrl, sourceUrl),
        });

        if (!existing) {
          const [newResult] = await db.insert(results).values({
            monitorId: monitor.id,
            platform: "devto",
            sourceUrl,
            title: article.title,
            content: article.description || "",
            author: article.user?.username,
            postedAt: article.published_at ? new Date(article.published_at) : new Date(),
            metadata: {
              devToId: article.id,
              reactions: article.public_reactions_count,
              comments: article.comments_count,
              tags: article.tag_list,
            },
          }).returning();

          count++;
          await incrementResultsCount(monitor.userId, 1);

          await inngest.send({
            name: "content/analyze",
            data: { resultId: newResult.id, userId: monitor.userId },
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning Dev.to for "${term}":`, error);
    }
  }

  return count;
}
