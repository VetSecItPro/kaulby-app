import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { incrementResultsCount, getUserPlan, canAccessPlatformWithPlan } from "@/lib/limits";
import {
  fetchGoogleReviews,
  fetchTrustpilotReviews,
  fetchAppStoreReviews,
  fetchPlayStoreReviews,
  fetchQuoraAnswers,
  fetchYouTubeComments,
  fetchG2Reviews,
  fetchYelpReviews,
  fetchAmazonReviews,
  isApifyConfigured,
} from "@/lib/apify";
import { findRelevantSubredditsCached } from "@/lib/ai";
import { searchRedditResilient } from "@/lib/reddit";
import { searchX } from "./monitor-x";

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
    timeouts: { finish: "10m" },
    concurrency: {
      limit: 5, // Limit concurrent scans to prevent overload
    },
  },
  { event: "monitor/scan-now" },
  async ({ event, step }) => {
    const { monitorId, userId } = event.data;

    // Get the monitor
    const monitor = await step.run("get-monitor", async () => {
      return pooledDb.query.monitors.findFirst({
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
      await pooledDb
        .update(monitors)
        .set({ isScanning: true })
        .where(eq(monitors.id, monitorId));
    });

    let totalResults = 0;
    const platformResults: Record<string, number> = {};

    // Pre-fetch user plan once instead of per-platform DB lookup
    const userPlan = await step.run("get-user-plan", async () => {
      return getUserPlan(userId);
    });

    try {
      // Scan each platform configured for this monitor
      for (const platform of monitor.platforms) {
        // Check platform access using pre-fetched plan (no DB hit)
        if (!canAccessPlatformWithPlan(userPlan, platform)) continue;

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

          case "youtube":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-youtube-${monitorId}`, async () => {
                return scanYouTubeForMonitor(monitor);
              });
            }
            break;

          case "g2":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-g2-${monitorId}`, async () => {
                return scanG2ForMonitor(monitor);
              });
            }
            break;

          case "yelp":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-yelp-${monitorId}`, async () => {
                return scanYelpForMonitor(monitor);
              });
            }
            break;

          case "amazonreviews":
            if (isApifyConfigured()) {
              platformCount = await step.run(`scan-amazonreviews-${monitorId}`, async () => {
                return scanAmazonReviewsForMonitor(monitor);
              });
            }
            break;

          case "github":
            platformCount = await step.run(`scan-github-${monitorId}`, async () => {
              return scanGitHubForMonitor(monitor);
            });
            break;

          case "hashnode":
            platformCount = await step.run(`scan-hashnode-${monitorId}`, async () => {
              return scanHashnodeForMonitor(monitor);
            });
            break;

          case "indiehackers":
            platformCount = await step.run(`scan-indiehackers-${monitorId}`, async () => {
              return scanIndieHackersForMonitor(monitor);
            });
            break;

          case "devto":
            platformCount = await step.run(`scan-devto-${monitorId}`, async () => {
              return scanDevToForMonitor(monitor);
            });
            break;

          case "x":
            platformCount = await step.run(`scan-x-${monitorId}`, async () => {
              return scanXForMonitor(monitor);
            });
            break;
        }

        platformResults[platform] = platformCount;
        totalResults += platformCount;
      }

      // Update monitor stats and mark scan complete
      await step.run("complete-scan", async () => {
        await pooledDb
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
        await pooledDb
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
  monitorType: "keyword" | "ai_discovery";
  discoveryPrompt: string | null;
}

/**
 * Check if content matches monitor criteria.
 * For keyword monitors: uses keyword matching
 * For AI Discovery monitors: uses semantic AI matching
 */
async function contentMatchesMonitor(
  content: { title: string; body?: string; author?: string; platform?: string },
  monitor: MonitorData
): Promise<{ isMatch: boolean; matchInfo?: { type: string; signals?: string[] } }> {
  const text = `${content.title} ${content.body || ""}`.toLowerCase();

  // For keyword monitors, use traditional keyword matching
  if (monitor.monitorType !== "ai_discovery") {
    // Check company name match
    if (monitor.companyName && text.includes(monitor.companyName.toLowerCase())) {
      return { isMatch: true, matchInfo: { type: "company_mention" } };
    }

    // Check keyword match
    if (monitor.keywords.length > 0) {
      const matchedKeywords = monitor.keywords.filter((k) => text.includes(k.toLowerCase()));
      if (matchedKeywords.length > 0) {
        return { isMatch: true, matchInfo: { type: "keyword", signals: matchedKeywords } };
      }
    }

    return { isMatch: false };
  }

  // For AI Discovery monitors, use semantic matching
  if (!monitor.discoveryPrompt) {
    console.warn(`[AI Discovery] Monitor ${monitor.id} has no discovery prompt`);
    return { isMatch: false };
  }

  try {
    // Use the AI Discovery analyzer
    const { checkAIDiscoveryMatch } = await import("@/lib/ai/analyzers/ai-discovery");
    const { result } = await checkAIDiscoveryMatch(
      content,
      monitor.discoveryPrompt,
      monitor.companyName
    );

    if (result.isMatch && result.relevanceScore >= 0.5) {
      return {
        isMatch: true,
        matchInfo: {
          type: `ai_discovery_${result.matchType}`,
          signals: result.signals,
        },
      };
    }

    return { isMatch: false };
  } catch (error) {
    console.error(`[AI Discovery] Error checking match for monitor ${monitor.id}:`, error);
    return { isMatch: false };
  }
}

async function scanRedditForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Get subreddits to scan - prioritize user-defined audiences, then AI discovery
  let subreddits: string[] = [];

  // First, check for user-defined audience
  if (monitor.audienceId) {
    const audience = await pooledDb.query.audiences.findFirst({
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

      // 1. Run content matching to determine which items to save
      interface MatchedRedditPost {
        sourceUrl: string;
        title: string;
        content: string;
        author: string;
        postedAt: Date;
        metadata: Record<string, unknown>;
      }
      const matchedItems: MatchedRedditPost[] = [];

      for (const post of searchResult.posts) {
        // Check for matches using unified matching function
        const matchResult = await contentMatchesMonitor(
          { title: post.title, body: post.selftext, author: post.author, platform: "reddit" },
          monitor
        );

        if (matchResult.isMatch) {
          matchedItems.push({
            sourceUrl: post.url || `https://reddit.com${post.permalink}`,
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
          });
        }
      }

      if (matchedItems.length === 0) continue;

      // 2. Batch check existence
      const matchedUrls = matchedItems.map(m => m.sourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, matchedUrls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // 3. Filter to new items
      const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

      if (newItems.length > 0) {
        // 4. Batch insert
        const inserted = await pooledDb.insert(results).values(
          newItems.map(item => ({
            monitorId: monitor.id,
            platform: "reddit" as const,
            sourceUrl: item.sourceUrl,
            title: item.title,
            content: item.content,
            author: item.author,
            postedAt: item.postedAt,
            metadata: item.metadata,
          }))
        ).returning();

        count += inserted.length;

        // 5. Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // 6. Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
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

    // 1. Fetch stories and run content matching to determine which items to save
    interface MatchedHNStory {
      sourceUrl: string;
      title: string;
      content: string;
      author: string;
      postedAt: Date;
      metadata: Record<string, unknown>;
    }
    const matchedItems: MatchedHNStory[] = [];

    for (const id of recentIds) {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!storyRes.ok) continue;

        const story = await storyRes.json();
        if (!story || story.deleted || story.dead) continue;

        // Check for matches using unified matching function
        const matchResult = await contentMatchesMonitor(
          { title: story.title || "", body: story.text || "", author: story.by, platform: "hackernews" },
          monitor
        );

        if (matchResult.isMatch) {
          matchedItems.push({
            sourceUrl: `https://news.ycombinator.com/item?id=${id}`,
            title: story.title || "HN Discussion",
            content: story.text || "",
            author: story.by,
            postedAt: story.time ? new Date(story.time * 1000) : new Date(),
            metadata: {
              hnId: id,
              score: story.score,
              descendants: story.descendants,
            },
          });
        }
      } catch {
        continue;
      }
    }

    if (matchedItems.length > 0) {
      // 2. Batch check existence
      const matchedUrls = matchedItems.map(m => m.sourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, matchedUrls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // 3. Filter to new items
      const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

      if (newItems.length > 0) {
        // 4. Batch insert
        const inserted = await pooledDb.insert(results).values(
          newItems.map(item => ({
            monitorId: monitor.id,
            platform: "hackernews" as const,
            sourceUrl: item.sourceUrl,
            title: item.title,
            content: item.content,
            author: item.author,
            postedAt: item.postedAt,
            metadata: item.metadata,
          }))
        ).returning();

        count += inserted.length;

        // 5. Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // 6. Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
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

      // Batch check for existing results
      const urls = reviews.map(review => review.reviewUrl || `google-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new reviews
      const newReviews = reviews.filter(review => {
        const sourceUrl = review.reviewUrl || `google-${review.reviewId}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newReviews.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newReviews.map(review => ({
            monitorId: monitor.id,
            platform: "googlereviews" as const,
            sourceUrl: review.reviewUrl || `google-${review.reviewId}`,
            title: `${review.stars}-star review`,
            content: review.text,
            author: review.name,
            postedAt: review.publishedAtDate ? new Date(review.publishedAtDate) : new Date(),
            metadata: {
              googleReviewId: review.reviewId,
              rating: review.stars,
              placeId: review.placeId,
            },
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
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

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `trustpilot-${review.id}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new reviews
      const newReviews = reviews.filter(review => {
        const sourceUrl = review.url || `trustpilot-${review.id}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newReviews.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newReviews.map(review => ({
            monitorId: monitor.id,
            platform: "trustpilot" as const,
            sourceUrl: review.url || `trustpilot-${review.id}`,
            title: review.title || `${review.rating}-star review`,
            content: review.text,
            author: review.author,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              trustpilotId: review.id,
              rating: review.rating,
              authorLocation: review.authorLocation,
            },
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
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

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `appstore-${review.id}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new reviews
      const newReviews = reviews.filter(review => {
        const sourceUrl = review.url || `appstore-${review.id}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newReviews.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newReviews.map(review => ({
            monitorId: monitor.id,
            platform: "appstore" as const,
            sourceUrl: review.url || `appstore-${review.id}`,
            title: review.title || `${review.rating}-star review`,
            content: review.text,
            author: review.userName,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              appStoreReviewId: review.id,
              rating: review.rating,
              appVersion: review.version,
            },
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
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

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `playstore-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new reviews
      const newReviews = reviews.filter(review => {
        const sourceUrl = review.url || `playstore-${review.reviewId}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newReviews.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newReviews.map(review => ({
            monitorId: monitor.id,
            platform: "playstore" as const,
            sourceUrl: review.url || `playstore-${review.reviewId}`,
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
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
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

      // Batch check for existing results
      const urls = answers.map(answer => answer.answerUrl || answer.questionUrl || `quora-${answer.questionId}-${answer.answerId || "q"}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new answers
      const newAnswers = answers.filter(answer => {
        const sourceUrl = answer.answerUrl || answer.questionUrl || `quora-${answer.questionId}-${answer.answerId || "q"}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newAnswers.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newAnswers.map(answer => ({
            monitorId: monitor.id,
            platform: "quora" as const,
            sourceUrl: answer.answerUrl || answer.questionUrl || `quora-${answer.questionId}-${answer.answerId || "q"}`,
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
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
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

    // 1. Run content matching to determine which items to save
    interface MatchedPHPost {
      sourceUrl: string;
      title: string;
      content: string | null;
      author: string | null;
      postedAt: Date;
      metadata: Record<string, unknown>;
    }
    const matchedItems: MatchedPHPost[] = [];

    for (const post of posts) {
      // Check for matches using unified matching function
      const matchResult = await contentMatchesMonitor(
        { title: `${post.name} - ${post.tagline}`, body: post.description || "", author: post.user?.name, platform: "producthunt" },
        monitor
      );

      if (matchResult.isMatch) {
        matchedItems.push({
          sourceUrl: post.url,
          title: `${post.name} - ${post.tagline}`,
          content: post.description || null,
          author: post.user?.name || null,
          postedAt: new Date(post.createdAt),
          metadata: {
            phId: post.id,
            votesCount: post.votesCount,
          },
        });
      }
    }

    if (matchedItems.length > 0) {
      // 2. Batch check existence
      const matchedUrls = matchedItems.map(m => m.sourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, matchedUrls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // 3. Filter to new items
      const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

      if (newItems.length > 0) {
        // 4. Batch insert
        const inserted = await pooledDb.insert(results).values(
          newItems.map(item => ({
            monitorId: monitor.id,
            platform: "producthunt" as const,
            sourceUrl: item.sourceUrl,
            title: item.title,
            content: item.content,
            author: item.author,
            postedAt: item.postedAt,
            metadata: item.metadata,
          }))
        ).returning();

        count += inserted.length;

        // 5. Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // 6. Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
      }
    }
  } catch (error) {
    console.error("[ProductHunt] Error in on-demand scan:", error);
  }

  return count;
}

// ============================================================================
// New Platform Scanning Functions (Phase 2 - Apify Integration)
// ============================================================================

/**
 * Scan YouTube for video comments matching monitor keywords.
 * Keywords should contain YouTube video URLs.
 * Uses Apify actor: streamers/youtube-comment-scraper
 */
async function scanYouTubeForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Keywords should be YouTube video URLs for this platform
  const videoUrls = monitor.keywords.filter(k =>
    k.includes("youtube.com") || k.includes("youtu.be")
  );

  if (videoUrls.length === 0) {
    console.log("[YouTube] No video URLs found in keywords, skipping");
    return 0;
  }

  for (const videoUrl of videoUrls) {
    try {
      const comments = await fetchYouTubeComments(videoUrl, 50);

      // Batch check for existing results
      const urls = comments.map(comment => `https://www.youtube.com/watch?v=${comment.videoId}&lc=${comment.commentId}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new comments
      const newComments = comments.filter(comment => {
        const sourceUrl = `https://www.youtube.com/watch?v=${comment.videoId}&lc=${comment.commentId}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newComments.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newComments.map(comment => ({
            monitorId: monitor.id,
            platform: "youtube" as const,
            sourceUrl: `https://www.youtube.com/watch?v=${comment.videoId}&lc=${comment.commentId}`,
            title: comment.videoTitle || `YouTube Comment`,
            content: comment.text,
            author: comment.author,
            postedAt: comment.publishedAt ? new Date(comment.publishedAt) : new Date(),
            metadata: {
              youtubeCommentId: comment.commentId,
              videoId: comment.videoId,
              likeCount: comment.likeCount,
              replyCount: comment.replyCount,
            },
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
      }
    } catch (error) {
      console.error(`[YouTube] Error scanning "${videoUrl}":`, error);
    }
  }

  return count;
}

/**
 * Scan G2 for software reviews matching monitor keywords.
 * Keywords should contain G2 product page URLs.
 * Uses Apify actor: epctex/g2-scraper
 */
async function scanG2ForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Keywords should be G2 product URLs
  const productUrls = monitor.keywords.filter(k => k.includes("g2.com"));

  if (productUrls.length === 0) {
    console.log("[G2] No G2 product URLs found in keywords, skipping");
    return 0;
  }

  for (const productUrl of productUrls) {
    try {
      const reviews = await fetchG2Reviews(productUrl, 30);

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `g2-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new reviews
      const newReviews = reviews.filter(review => {
        const sourceUrl = review.url || `g2-${review.reviewId}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newReviews.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newReviews.map(review => {
            // Combine pros/cons with main text for content
            let content = review.text;
            if (review.pros) content += `\n\nPros: ${review.pros}`;
            if (review.cons) content += `\n\nCons: ${review.cons}`;

            return {
              monitorId: monitor.id,
              platform: "g2" as const,
              sourceUrl: review.url || `g2-${review.reviewId}`,
              title: review.title || `${review.rating}-star review`,
              content,
              author: review.author,
              postedAt: review.date ? new Date(review.date) : new Date(),
              metadata: {
                g2ReviewId: review.reviewId,
                rating: review.rating,
                authorRole: review.authorRole,
                companySize: review.companySize,
                industry: review.industry,
                productName: review.productName,
              },
            };
          })
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
      }
    } catch (error) {
      console.error(`[G2] Error scanning "${productUrl}":`, error);
    }
  }

  return count;
}

/**
 * Scan Yelp for business reviews matching monitor keywords.
 * Keywords should contain Yelp business page URLs.
 * Uses Apify actor: maxcopell/yelp-scraper
 */
async function scanYelpForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Keywords should be Yelp business URLs
  const businessUrls = monitor.keywords.filter(k => k.includes("yelp.com"));

  if (businessUrls.length === 0) {
    console.log("[Yelp] No Yelp business URLs found in keywords, skipping");
    return 0;
  }

  for (const businessUrl of businessUrls) {
    try {
      const reviews = await fetchYelpReviews(businessUrl, 30);

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `yelp-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new reviews
      const newReviews = reviews.filter(review => {
        const sourceUrl = review.url || `yelp-${review.reviewId}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newReviews.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newReviews.map(review => ({
            monitorId: monitor.id,
            platform: "yelp" as const,
            sourceUrl: review.url || `yelp-${review.reviewId}`,
            title: `${review.rating}-star review${review.businessName ? ` for ${review.businessName}` : ""}`,
            content: review.text,
            author: review.author,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              yelpReviewId: review.reviewId,
              rating: review.rating,
              authorLocation: review.authorLocation,
              businessName: review.businessName,
              hasPhotos: review.photos && review.photos.length > 0,
            },
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
      }
    } catch (error) {
      console.error(`[Yelp] Error scanning "${businessUrl}":`, error);
    }
  }

  return count;
}

/**
 * Scan Amazon for product reviews matching monitor keywords.
 * Keywords should contain Amazon product URLs or ASINs.
 * Uses Apify actor: junglee/amazon-reviews-scraper
 */
async function scanAmazonReviewsForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Keywords should be Amazon URLs or ASINs
  const productUrls = monitor.keywords.filter(k =>
    k.includes("amazon.com") || k.includes("amazon.") || /^[A-Z0-9]{10}$/i.test(k)
  );

  if (productUrls.length === 0) {
    console.log("[Amazon] No Amazon product URLs/ASINs found in keywords, skipping");
    return 0;
  }

  for (const productUrl of productUrls) {
    try {
      const reviews = await fetchAmazonReviews(productUrl, 30);

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `amazon-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new reviews
      const newReviews = reviews.filter(review => {
        const sourceUrl = review.url || `amazon-${review.reviewId}`;
        return !existingUrls.has(sourceUrl);
      });

      if (newReviews.length > 0) {
        // Batch insert all new results
        const inserted = await pooledDb.insert(results).values(
          newReviews.map(review => ({
            monitorId: monitor.id,
            platform: "amazonreviews" as const,
            sourceUrl: review.url || `amazon-${review.reviewId}`,
            title: review.title || `${review.rating}-star review`,
            content: review.text,
            author: review.author,
            postedAt: review.date ? new Date(review.date) : new Date(),
            metadata: {
              amazonReviewId: review.reviewId,
              rating: review.rating,
              verifiedPurchase: review.verifiedPurchase,
              helpfulVotes: review.helpfulVotes,
              productName: review.productName,
              productAsin: review.productAsin,
            },
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
      }
    } catch (error) {
      console.error(`[Amazon] Error scanning "${productUrl}":`, error);
    }
  }

  return count;
}

/**
 * Scan GitHub Issues and Discussions for a monitor
 * Uses GitHub API (free: 5000 requests/hour authenticated)
 */
async function scanGitHubForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Kaulby/1.0",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    // Search issues for each keyword
    for (const keyword of monitor.keywords.slice(0, 5)) {
      const query = encodeURIComponent(`${keyword} in:title,body type:issue`);
      const response = await fetch(
        `https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=30`,
        { headers }
      );

      if (!response.ok) continue;
      const data = await response.json();

      // 1. Run content matching to determine which items to save
      interface MatchedGHIssue {
        sourceUrl: string;
        title: string;
        content: string;
        author: string;
        postedAt: Date;
        metadata: Record<string, unknown>;
      }
      const matchedItems: MatchedGHIssue[] = [];

      for (const issue of data.items || []) {
        // Check for matches using unified matching function
        const matchResult = await contentMatchesMonitor(
          { title: issue.title || "", body: issue.body || "", author: issue.user?.login, platform: "github" },
          monitor
        );

        if (matchResult.isMatch) {
          matchedItems.push({
            sourceUrl: issue.html_url,
            title: `[Issue] ${issue.title}`,
            content: issue.body || "",
            author: issue.user?.login || "Unknown",
            postedAt: new Date(issue.created_at),
            metadata: {
              type: "issue",
              state: issue.state,
              commentCount: issue.comments,
              labels: issue.labels?.map((l: { name: string }) => l.name) || [],
            },
          });
        }
      }

      if (matchedItems.length > 0) {
        // 2. Batch check existence
        const matchedUrls = matchedItems.map(m => m.sourceUrl);
        const existing = await pooledDb.query.results.findMany({
          where: inArray(results.sourceUrl, matchedUrls),
          columns: { sourceUrl: true },
        });
        const existingUrls = new Set(existing.map(r => r.sourceUrl));

        // 3. Filter to new items
        const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

        if (newItems.length > 0) {
          // 4. Batch insert
          const inserted = await pooledDb.insert(results).values(
            newItems.map(item => ({
              monitorId: monitor.id,
              platform: "github" as const,
              sourceUrl: item.sourceUrl,
              title: item.title,
              content: item.content,
              author: item.author,
              postedAt: item.postedAt,
              metadata: item.metadata,
            }))
          ).returning();

          count += inserted.length;

          // 5. Single batch usage increment
          await incrementResultsCount(monitor.userId, inserted.length);

          // 6. Batch send analysis events
          if (inserted.length > 0) {
            await inngest.send(
              inserted.map(result => ({
                name: "content/analyze" as const,
                data: { resultId: result.id, userId: monitor.userId },
              }))
            );
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error("[GitHub] Error scanning:", error);
  }

  return count;
}

/**
 * Scan Hashnode for articles matching monitor keywords
 * Uses Hashnode GraphQL API (free, public)
 */
async function scanHashnodeForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  try {
    for (const keyword of monitor.keywords.slice(0, 5)) {
      const query = `
        query SearchPosts($query: String!) {
          searchPostsOfFeed(first: 20, filter: { query: $query }) {
            edges {
              node {
                id
                title
                brief
                author { username name }
                url
                publishedAt
                reactionCount
                responseCount
                readTimeInMinutes
                tags { name }
              }
            }
          }
        }
      `;

      const response = await fetch("https://gql.hashnode.com/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Kaulby/1.0",
        },
        body: JSON.stringify({ query, variables: { query: keyword } }),
      });

      if (!response.ok) continue;
      const data = await response.json();
      const edges = data.data?.searchPostsOfFeed?.edges || [];

      // 1. Run content matching to determine which items to save
      interface MatchedHashnodeArticle {
        sourceUrl: string;
        title: string;
        content: string;
        author: string;
        postedAt: Date;
        metadata: Record<string, unknown>;
      }
      const matchedItems: MatchedHashnodeArticle[] = [];

      for (const edge of edges) {
        const article = edge.node;
        if (!article) continue;

        // Check for matches using unified matching function
        const matchResult = await contentMatchesMonitor(
          { title: article.title || "", body: article.brief || "", author: article.author?.username, platform: "hashnode" },
          monitor
        );

        if (matchResult.isMatch) {
          matchedItems.push({
            sourceUrl: article.url,
            title: article.title,
            content: article.brief || "",
            author: article.author?.username || "Unknown",
            postedAt: new Date(article.publishedAt),
            metadata: {
              reactions: article.reactionCount,
              commentCount: article.responseCount,
              readingTime: article.readTimeInMinutes,
              tags: article.tags?.map((t: { name: string }) => t.name) || [],
            },
          });
        }
      }

      if (matchedItems.length > 0) {
        // 2. Batch check existence
        const matchedUrls = matchedItems.map(m => m.sourceUrl);
        const existing = await pooledDb.query.results.findMany({
          where: inArray(results.sourceUrl, matchedUrls),
          columns: { sourceUrl: true },
        });
        const existingUrls = new Set(existing.map(r => r.sourceUrl));

        // 3. Filter to new items
        const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

        if (newItems.length > 0) {
          // 4. Batch insert
          const inserted = await pooledDb.insert(results).values(
            newItems.map(item => ({
              monitorId: monitor.id,
              platform: "hashnode" as const,
              sourceUrl: item.sourceUrl,
              title: item.title,
              content: item.content,
              author: item.author,
              postedAt: item.postedAt,
              metadata: item.metadata,
            }))
          ).returning();

          count += inserted.length;

          // 5. Single batch usage increment
          await incrementResultsCount(monitor.userId, inserted.length);

          // 6. Batch send analysis events
          if (inserted.length > 0) {
            await inngest.send(
              inserted.map(result => ({
                name: "content/analyze" as const,
                data: { resultId: result.id, userId: monitor.userId },
              }))
            );
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("[Hashnode] Error scanning:", error);
  }

  return count;
}

/**
 * Scan Indie Hackers for posts matching monitor keywords
 * Uses IH feed or scraping fallback
 */
async function scanIndieHackersForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  try {
    // Try to fetch the feed
    const response = await fetch("https://www.indiehackers.com/feed.json", {
      headers: {
        "User-Agent": "Kaulby/1.0 (Community Monitoring Tool)",
        "Accept": "application/json",
      },
    });

    interface FeedItem {
      id?: string;
      url?: string;
      title?: string;
      content_text?: string;
      content_html?: string;
      author?: { name?: string };
      authors?: Array<{ name?: string }>;
      date_published?: string;
    }

    let posts: FeedItem[] = [];

    if (response.ok) {
      const data = await response.json();
      posts = data.items || [];
    }

    // 1. Run content matching to determine which items to save
    interface MatchedIHPost {
      sourceUrl: string;
      title: string;
      content: string;
      author: string;
      postedAt: Date;
      metadata: Record<string, unknown>;
    }
    const matchedItems: MatchedIHPost[] = [];

    for (const post of posts.slice(0, 50)) {
      if (!post.url) continue;

      // Check for matches using unified matching function
      const matchResult = await contentMatchesMonitor(
        { title: post.title || "", body: post.content_text || "", author: post.author?.name || post.authors?.[0]?.name, platform: "indiehackers" },
        monitor
      );

      if (matchResult.isMatch) {
        matchedItems.push({
          sourceUrl: post.url,
          title: post.title || "Indie Hackers Post",
          content: post.content_text || "",
          author: post.author?.name || post.authors?.[0]?.name || "Unknown",
          postedAt: post.date_published ? new Date(post.date_published) : new Date(),
          metadata: {},
        });
      }
    }

    if (matchedItems.length > 0) {
      // 2. Batch check existence
      const matchedUrls = matchedItems.map(m => m.sourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, matchedUrls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // 3. Filter to new items
      const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

      if (newItems.length > 0) {
        // 4. Batch insert
        const inserted = await pooledDb.insert(results).values(
          newItems.map(item => ({
            monitorId: monitor.id,
            platform: "indiehackers" as const,
            sourceUrl: item.sourceUrl,
            title: item.title,
            content: item.content,
            author: item.author,
            postedAt: item.postedAt,
            metadata: item.metadata,
          }))
        ).returning();

        count += inserted.length;

        // 5. Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // 6. Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
      }
    }
  } catch (error) {
    console.error("[IndieHackers] Error scanning:", error);
  }

  return count;
}

/**
 * Scan Dev.to for articles matching monitor keywords
 * Uses Dev.to API (free, 30 requests/minute)
 */
async function scanDevToForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;
  const seenIds = new Set<number>();

  try {
    for (const keyword of monitor.keywords.slice(0, 5)) {
      // Search by tag
      const response = await fetch(
        `https://dev.to/api/articles?tag=${encodeURIComponent(keyword)}&per_page=30&state=fresh`,
        {
          headers: {
            "User-Agent": "Kaulby/1.0",
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) continue;

      interface DevToArticle {
        id: number;
        title: string;
        description?: string;
        body_markdown?: string;
        user: { username: string; name?: string };
        url: string;
        published_at?: string;
        created_at: string;
        positive_reactions_count?: number;
        comments_count?: number;
        reading_time_minutes?: number;
        tags?: string[];
      }

      const articles: DevToArticle[] = await response.json();

      // 1. Run content matching to determine which items to save
      interface MatchedDevToArticle {
        sourceUrl: string;
        title: string;
        content: string;
        author: string;
        postedAt: Date;
        metadata: Record<string, unknown>;
      }
      const matchedItems: MatchedDevToArticle[] = [];

      for (const article of articles) {
        if (seenIds.has(article.id)) continue;
        seenIds.add(article.id);

        // Check for matches using unified matching function
        const matchResult = await contentMatchesMonitor(
          { title: article.title || "", body: article.description || "", author: article.user.username, platform: "devto" },
          monitor
        );

        if (matchResult.isMatch) {
          matchedItems.push({
            sourceUrl: article.url,
            title: article.title,
            content: article.description || "",
            author: article.user.username,
            postedAt: new Date(article.published_at || article.created_at),
            metadata: {
              reactions: article.positive_reactions_count || 0,
              commentCount: article.comments_count || 0,
              readingTime: article.reading_time_minutes || 0,
              tags: article.tags || [],
            },
          });
        }
      }

      if (matchedItems.length > 0) {
        // 2. Batch check existence
        const matchedUrls = matchedItems.map(m => m.sourceUrl);
        const existing = await pooledDb.query.results.findMany({
          where: inArray(results.sourceUrl, matchedUrls),
          columns: { sourceUrl: true },
        });
        const existingUrls = new Set(existing.map(r => r.sourceUrl));

        // 3. Filter to new items
        const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

        if (newItems.length > 0) {
          // 4. Batch insert
          const inserted = await pooledDb.insert(results).values(
            newItems.map(item => ({
              monitorId: monitor.id,
              platform: "devto" as const,
              sourceUrl: item.sourceUrl,
              title: item.title,
              content: item.content,
              author: item.author,
              postedAt: item.postedAt,
              metadata: item.metadata,
            }))
          ).returning();

          count += inserted.length;

          // 5. Single batch usage increment
          await incrementResultsCount(monitor.userId, inserted.length);

          // 6. Batch send analysis events
          if (inserted.length > 0) {
            await inngest.send(
              inserted.map(result => ({
                name: "content/analyze" as const,
                data: { resultId: result.id, userId: monitor.userId },
              }))
            );
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error("[Dev.to] Error scanning:", error);
  }

  return count;
}

/**
 * Scan X/Twitter for posts matching monitor keywords.
 * Uses xAI's Grok API with x_search tool.
 */
async function scanXForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  try {
    const searchResult = await searchX(monitor.keywords, 50);

    if (searchResult.error) {
      console.warn(`[X] Search warning for monitor ${monitor.id}: ${searchResult.error}`);
      if (searchResult.posts.length === 0) return 0;
    }

    // Filter posts using content matching
    const matchedItems = [];
    for (const post of searchResult.posts) {
      const matchResult = await contentMatchesMonitor(
        { title: post.text.slice(0, 100), body: post.text, author: post.authorUsername, platform: "x" },
        monitor
      );

      if (matchResult.isMatch) {
        matchedItems.push({
          sourceUrl: post.url || `https://x.com/${post.authorUsername}`,
          title: post.text.slice(0, 200),
          content: post.text,
          author: post.authorUsername,
          postedAt: post.createdAt ? new Date(post.createdAt) : new Date(),
          metadata: {
            authorDisplayName: post.author,
            likes: post.likes,
            retweets: post.retweets,
            replies: post.replies,
          },
        });
      }
    }

    if (matchedItems.length > 0) {
      // Batch check for existing results
      const urls = matchedItems.map(m => m.sourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: inArray(results.sourceUrl, urls),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));

      // Filter to only new items
      const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

      if (newItems.length > 0) {
        // Batch insert
        const inserted = await pooledDb.insert(results).values(
          newItems.map(item => ({
            monitorId: monitor.id,
            platform: "x" as const,
            sourceUrl: item.sourceUrl,
            title: item.title,
            content: item.content,
            author: item.author,
            postedAt: item.postedAt,
            metadata: item.metadata,
          }))
        ).returning();

        count += inserted.length;

        // Single batch usage increment
        await incrementResultsCount(monitor.userId, inserted.length);

        // Batch send analysis events
        if (inserted.length > 0) {
          await inngest.send(
            inserted.map(result => ({
              name: "content/analyze" as const,
              data: { resultId: result.id, userId: monitor.userId },
            }))
          );
        }
      }
    }
  } catch (error) {
    console.error("[X] Error scanning:", error);
  }

  return count;
}
