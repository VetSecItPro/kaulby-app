import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { monitors, results, audiences } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { incrementResultsCount, getUserPlan, canAccessPlatformWithPlan } from "@/lib/limits";
import type { Platform } from "@/lib/plans";
import {
  fetchGoogleReviews,
  fetchYelpReviews,
  fetchAppStoreReviews,
  isApifyConfigured,
} from "@/lib/apify";
import { fetchPlayStoreReviews } from "@/lib/playstore";
import {
  fetchYouTubeCommentsApi,
  isYouTubeApiConfigured,
} from "@/lib/youtube";
import { fetchAppStoreRss } from "@/lib/appstore-rss";
import {
  searchG2Serper,
  searchYelpSerper,
  searchAmazonSerper,
  searchGoogleReviewsSerper,
  searchAppStoreSerper,
  isSerperConfigured,
} from "@/lib/serper";
import { fetchTrustpilotResilient } from "@/lib/trustpilot";
import { findRelevantSubredditsCached } from "@/lib/ai";
import { searchRedditResilient, searchRedditPublicSiteWide } from "@/lib/reddit";
import { searchX } from "./monitor-x";
import { searchHashnode } from "./monitor-hashnode";
import { searchDevTo } from "./monitor-devto";
import { fetchIndieHackersFeed } from "@/lib/indiehackers";
import { trackScanFailed } from "../utils/monitor-helpers";
import { searchMultipleKeywords as searchHNMultipleKeywords } from "@/lib/hackernews";
import { includesTokenized } from "@/lib/content-matcher";
import { logger } from "@/lib/logger";

// PERF-DX-001: Registry pattern replaces a 16-case `switch` over Platform.
// Each entry pairs an optional `gate` (env/config check) with a `scan` function.
// Adding a new platform = one row, not a new case + step.run boilerplate.
// `Partial<Record<...>>` so platforms without a scanner (e.g. deferred "quora")
// are simply absent rather than failing exhaustiveness.
type ScannerEntry = {
  gate?: () => boolean;
  scan: (monitor: MonitorData) => Promise<number>;
};

const SCANNERS: Partial<Record<Platform, ScannerEntry>> = {
  reddit:        { scan: (m) => scanRedditForMonitor(m) },
  hackernews:    { scan: (m) => scanHackerNewsForMonitor(m) },
  googlereviews: { gate: () => isSerperConfigured() || isApifyConfigured(), scan: (m) => scanGoogleReviewsForMonitor(m) },
  trustpilot:    { gate: () => isSerperConfigured(),                         scan: (m) => scanTrustpilotForMonitor(m) },
  appstore:      { scan: (m) => scanAppStoreForMonitor(m) },
  playstore:     { gate: () => isApifyConfigured(),                          scan: (m) => scanPlayStoreForMonitor(m) },
  producthunt:   { scan: (m) => scanProductHuntForMonitor(m) },
  youtube:       { gate: () => isYouTubeApiConfigured(),                     scan: (m) => scanYouTubeForMonitor(m) },
  g2:            { gate: () => isSerperConfigured(),                         scan: (m) => scanG2ForMonitor(m) },
  yelp:          { gate: () => isSerperConfigured() || isApifyConfigured(), scan: (m) => scanYelpForMonitor(m) },
  amazonreviews: { gate: () => isSerperConfigured(),                         scan: (m) => scanAmazonReviewsForMonitor(m) },
  github:        { scan: (m) => scanGitHubForMonitor(m) },
  hashnode:      { scan: (m) => scanHashnodeForMonitor(m) },
  indiehackers:  { scan: (m) => scanIndieHackersForMonitor(m) },
  devto:         { scan: (m) => scanDevToForMonitor(m) },
  x:             { scan: (m) => scanXForMonitor(m) },
};

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
    // 30m covers worst-case: 16 platforms × ~90s each when Reddit/GitHub are
    // cold and Apify is slow. Previous 10m budget was truncating scans mid-way
    // for monitors with many platforms (observed 2026-04-24: Peloton got only
    // last platform scanned, earlier ones ran but their step.run budget expired).
    timeouts: { finish: "30m" },
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

    // Pre-fetch user plan once instead of per-platform DB lookup
    const userPlan = await step.run("get-user-plan", async () => {
      return getUserPlan(userId);
    });

    // Filter out deferred platforms (quora) — DB enum still accepts them for historical
    // rows, but they are not scannable. Predicate narrows union to the active Platform type.
    const DEFERRED_PLATFORMS = new Set(["quora"]);
    const activePlatforms = monitor.platforms.filter(
      (p): p is Platform => !DEFERRED_PLATFORMS.has(p)
    );

    // Calculate accessible platforms for progress tracking
    const accessiblePlatforms = activePlatforms.filter(p => canAccessPlatformWithPlan(userPlan, p));

    // Mark as scanning with initial progress
    await step.run("mark-scanning", async () => {
      await pooledDb
        .update(monitors)
        .set({
          isScanning: true,
          scanProgress: {
            step: "scanning",
            platformsTotal: accessiblePlatforms.length,
            platformsCompleted: 0,
            platformResults: {},
            currentPlatform: accessiblePlatforms[0] || null,
            startedAt: new Date().toISOString(),
          },
        })
        .where(eq(monitors.id, monitorId));
    });

    let totalResults = 0;
    const platformResults: Record<string, number> = {};
    let platformsCompleted = 0;

    try {
      // Scan each platform configured for this monitor
      for (const platform of activePlatforms) {
        // Check platform access using pre-fetched plan (no DB hit)
        if (!canAccessPlatformWithPlan(userPlan, platform)) continue;

        // Update progress: current platform
        await step.run(`progress-${platform}-${monitorId}`, async () => {
          await pooledDb
            .update(monitors)
            .set({
              scanProgress: {
                step: "scanning",
                platformsTotal: accessiblePlatforms.length,
                platformsCompleted,
                platformResults,
                currentPlatform: platform,
                startedAt: new Date().toISOString(),
              },
            })
            .where(eq(monitors.id, monitorId));
        });

        // PERF-DX-001: dispatch via SCANNERS registry. Gate (if any) is
        // checked before paying for a step.run; absent platforms are skipped.
        let platformCount = 0;
        const entry = SCANNERS[platform];
        if (entry && (!entry.gate || entry.gate())) {
          platformCount = await step.run(`scan-${platform}-${monitorId}`, async () => {
            return entry.scan(monitor);
          });
        }

        platformResults[platform] = platformCount;
        totalResults += platformCount;
        platformsCompleted++;
      }

      // Update monitor stats and mark scan complete
      await step.run("complete-scan", async () => {
        await pooledDb
          .update(monitors)
          .set({
            isScanning: false,
            scanProgress: {
              step: "complete",
              platformsTotal: accessiblePlatforms.length,
              platformsCompleted: accessiblePlatforms.length,
              platformResults,
              currentPlatform: null,
              startedAt: new Date().toISOString(),
            },
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
          .set({ isScanning: false, scanProgress: null })
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
  platformUrls: Record<string, string> | null;
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

  // For keyword monitors, use traditional keyword matching.
  // includesTokenized lets multi-word needles like "Anthropic Claude" match
  // posts that mention both tokens independently (not only the exact phrase).
  if (monitor.monitorType !== "ai_discovery") {
    if (monitor.companyName && includesTokenized(text, monitor.companyName)) {
      return { isMatch: true, matchInfo: { type: "company_mention" } };
    }

    if (monitor.keywords.length > 0) {
      const matchedKeywords = monitor.keywords.filter((k) => includesTokenized(text, k));
      if (matchedKeywords.length > 0) {
        return { isMatch: true, matchInfo: { type: "keyword", signals: matchedKeywords } };
      }
    }

    return { isMatch: false };
  }

  // For AI Discovery monitors, use semantic matching
  if (!monitor.discoveryPrompt) {
    logger.warn("[AI Discovery] Monitor has no discovery prompt", { monitorId: monitor.id });
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
    logger.error("[AI Discovery] Error checking match", { monitorId: monitor.id, error: error instanceof Error ? error.message : String(error) });
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
      where: eq(audiences.id, monitor.audienceId),
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
      logger.info("[Reddit] Using AI to find subreddits", { companyName: monitor.companyName });
      subreddits = await findRelevantSubredditsCached(
        monitor.companyName,
        monitor.keywords,
        10
      );
      logger.info("[Reddit] AI suggested subreddits", { subreddits });
    } catch (error) {
      logger.error("[Reddit] AI subreddit finder failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Fallback to generic subreddits only if everything else fails
  if (subreddits.length === 0) {
    subreddits = ["AskReddit", "smallbusiness", "Entrepreneur", "business"];
  }

  for (const subreddit of subreddits) {
    try {
      // Use resilient Reddit search (Serper → Apify → Public JSON)
      // 30 items/sub matches cron cadence; see docs/planning/apify-cost-optimization-2026-04-24.md
      const searchResult = await searchRedditResilient(subreddit, monitor.keywords, 30);

      if (searchResult.error) {
        logger.warn("[Reddit] Search warning", { subreddit, error: searchResult.error });
      }

      logger.info("[Reddit] Search complete", { source: searchResult.source, subreddit, postCount: searchResult.posts.length });

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
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
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
      logger.error("[Reddit] Error scanning subreddit", { subreddit, error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Fallback: if subreddit-specific searches found nothing, try site-wide Reddit search
  if (count === 0) {
    const searchTerms = [
      ...(monitor.companyName ? [monitor.companyName] : []),
      ...monitor.keywords,
    ];

    if (searchTerms.length > 0) {
      try {
        const siteWideResult = await searchRedditPublicSiteWide(searchTerms, 30);

        if (siteWideResult.posts.length > 0) {
          logger.info("[Reddit] Site-wide fallback found posts", { count: siteWideResult.posts.length });

          // 1. Run content matching to find candidates
          interface SitewideMatchedPost {
            sourceUrl: string;
            title: string;
            content: string;
            author: string;
            postedAt: Date;
            metadata: Record<string, unknown>;
          }
          const sitewideMatched: SitewideMatchedPost[] = [];

          for (const post of siteWideResult.posts) {
            const matchResult = await contentMatchesMonitor(
              { title: post.title, body: post.selftext, author: post.author, platform: "reddit" },
              monitor
            );
            if (!matchResult.isMatch) continue;

            sitewideMatched.push({
              sourceUrl: post.url || `https://reddit.com${post.permalink}`,
              title: post.title,
              content: post.selftext,
              author: post.author,
              postedAt: new Date(post.created_utc * 1000),
              metadata: { subreddit: post.subreddit, score: post.score, numComments: post.num_comments, source: "sitewide-fallback" },
            });
          }

          if (sitewideMatched.length > 0) {
            // 2. Batch existence check — single inArray query
            const sitewideUrls = sitewideMatched.map((m) => m.sourceUrl);
            const sitewideExisting = await pooledDb.query.results.findMany({
              where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, sitewideUrls)),
              columns: { sourceUrl: true },
            });
            const sitewideExistingSet = new Set(sitewideExisting.map((r) => r.sourceUrl));

            // 3. Filter to new items only
            const sitewideNew = sitewideMatched.filter((m) => !sitewideExistingSet.has(m.sourceUrl));

            if (sitewideNew.length > 0) {
              // 4. Batch insert
              const inserted = await pooledDb.insert(results).values(
                sitewideNew.map((item) => ({
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
              await incrementResultsCount(monitor.userId, inserted.length);

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
        }
      } catch (error) {
        logger.error("[Reddit] Site-wide fallback failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return count;
}

async function scanHackerNewsForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  try {
    // Use HN Algolia Search API to actually search for keywords
    // This is far more effective than scanning the 50 newest stories
    interface MatchedHNStory {
      sourceUrl: string;
      title: string;
      content: string;
      author: string;
      postedAt: Date;
      metadata: Record<string, unknown>;
    }
    const matchedItems: MatchedHNStory[] = [];
    const seenIds = new Set<string>();

    // Use the shared searchMultipleKeywords helper. Cron uses a 24-hour
    // window because it runs every 2 hours (catches everything with overlap).
    // On-demand is a user-initiated one-shot scan — widen to 30 days so a
    // low-volume keyword doesn't return empty just because nothing posted
    // in the last 24h. The helper combines keywords into a single OR query.
    const searchQueries = monitor.keywords.length > 0
      ? monitor.keywords
      : monitor.companyName ? [monitor.companyName] : [];

    if (searchQueries.length > 0) {
      try {
        const hits = await searchHNMultipleKeywords(searchQueries, 24 * 30);
        logger.info("[HN] Algolia search results", { keywordCount: searchQueries.length, hitCount: hits.length });

        for (const hit of hits) {
          const storyId = hit.objectID;
          if (seenIds.has(storyId)) continue;
          seenIds.add(storyId);

          const matchResult = await contentMatchesMonitor(
            { title: hit.title || "", body: hit.story_text || "", author: hit.author, platform: "hackernews" },
            monitor
          );

          if (matchResult.isMatch) {
            matchedItems.push({
              sourceUrl: `https://news.ycombinator.com/item?id=${storyId}`,
              title: hit.title || "HN Discussion",
              content: hit.story_text || "",
              author: hit.author,
              postedAt: hit.created_at ? new Date(hit.created_at) : new Date(),
              metadata: {
                hnId: storyId,
                score: hit.points,
                descendants: hit.num_comments,
              },
            });
          }
        }
      } catch (error) {
        logger.warn("[HN] Algolia search failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (matchedItems.length > 0) {
      // 2. Batch check existence
      const matchedUrls = matchedItems.map(m => m.sourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
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
    logger.error("[HN] Error scanning", { error: error instanceof Error ? error.message : String(error) });
  }

  return count;
}

async function scanGoogleReviewsForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Use platformUrls.googlereviews if provided, then company name, then keywords
  // For Google Reviews, company name is more useful than keywords for finding the business
  const configuredUrl = monitor.platformUrls?.googlereviews;
  const searchTerms: string[] = [];
  if (configuredUrl) {
    searchTerms.push(configuredUrl);
    // Also add company name as fallback in case share link resolution fails
    if (monitor.companyName && configuredUrl.includes("share.google")) {
      searchTerms.push(monitor.companyName);
    }
  } else if (monitor.companyName) {
    searchTerms.push(monitor.companyName);
  } else if (monitor.keywords.length > 0) {
    searchTerms.push(...monitor.keywords);
  }

  if (searchTerms.length === 0) {
    return 0;
  }

  for (const term of searchTerms) {
    try {
      // Apify first (gets actual review content), Serper fallback (discovery only)
      let reviews: Array<{ reviewId: string; name: string; text: string; stars: number; publishedAtDate: string; reviewUrl: string; placeId?: string }> = [];

      // Only use Apify when term is a URL or Place ID (starts with ChI) —
      // plain company names cause Apify to timeout (120s) on invalid URLs
      const isUrl = term.startsWith("http") || term.includes("google.com") || term.includes("share.google");
      const isPlaceId = term.startsWith("ChI");
      const canUseApify = isApifyConfigured() && (isUrl || isPlaceId);

      if (canUseApify) {
        try {
          reviews = await fetchGoogleReviews(term, 20);
        } catch (apifyError) {
          logger.warn("[GoogleReviews] Apify failed, falling back to Serper", { term, error: apifyError instanceof Error ? apifyError.message : String(apifyError) });
        }
      }
      if (reviews.length === 0 && isSerperConfigured()) {
        reviews = await searchGoogleReviewsSerper(term, 20);
      }

      if (reviews.length === 0) continue;

      // Batch check for existing results
      const urls = reviews.map(review => review.reviewUrl || `google-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
          newReviews.map(review => {
            // review.name can be a string or an object { name, thumbnail, ... } from Serper
            const authorName = typeof review.name === "string"
              ? review.name
              : (review.name as { name?: string })?.name || "Anonymous";
            // publishedAtDate can be relative ("2 weeks ago") — parse or use current date
            const parsedDate = review.publishedAtDate ? new Date(review.publishedAtDate) : new Date();
            const postedAt = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
            return {
              monitorId: monitor.id,
              platform: "googlereviews" as const,
              sourceUrl: review.reviewUrl || `google-${review.reviewId}`,
              title: `${review.stars}-star review`,
              content: review.text,
              author: authorName,
              postedAt,
              metadata: {
                googleReviewId: review.reviewId,
                rating: review.stars,
                placeId: review.placeId,
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
      logger.error("[GoogleReviews] Error scanning", { term, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return count;
}

async function scanTrustpilotForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Use platformUrls.trustpilot if provided, then keywords, then company name
  const configuredUrl = monitor.platformUrls?.trustpilot;
  const searchTerms = configuredUrl
    ? [configuredUrl]
    : monitor.keywords.length > 0
      ? monitor.keywords
      : monitor.companyName
        ? [monitor.companyName]
        : [];

  for (const term of searchTerms) {
    try {
      const { items: reviews, source } = await fetchTrustpilotResilient(term, 20);
      logger.info("[Trustpilot] scan-on-demand fetch", { monitorId: monitor.id, source, count: reviews.length });

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `trustpilot-${review.id}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
      logger.error("[Trustpilot] Error scanning", { term, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return count;
}

async function scanAppStoreForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Use platformUrls.appstore if provided, then company name, then keywords
  const configuredUrl = monitor.platformUrls?.appstore;
  const searchTerms = configuredUrl
    ? [configuredUrl]
    : monitor.companyName
      ? [monitor.companyName]
      : monitor.keywords.length > 0
        ? monitor.keywords
        : [];

  for (const appRef of searchTerms) {
    try {
      // Apple RSS primary (free, official, full review data), Serper fallback, Apify last resort
      let reviews: Array<{ id: string; title: string; text: string; rating: number; date: string; userName: string; version?: string; appId?: string; url?: string }> = [];

      // Try Apple RSS feed first (free, returns up to 50 reviews with full data)
      logger.info("[AppStore] Trying Apple RSS feed", { appRef });
      const rssResults = await fetchAppStoreRss(appRef, 20);
      if (rssResults.length > 0) {
        reviews = rssResults;
      }

      // Serper fallback (keyword-based discovery)
      if (reviews.length === 0 && isSerperConfigured()) {
        logger.info("[AppStore] RSS returned 0, trying Serper", { appRef });
        const serperResults = await searchAppStoreSerper(appRef, 20);
        reviews = serperResults;
      }

      // Apify last resort (requires paid plan)
      if (reviews.length === 0 && isApifyConfigured()) {
        logger.info("[AppStore] Serper returned 0, trying Apify", { appRef });
        try {
          const apifyResults = await fetchAppStoreReviews(appRef, 20);
          reviews = apifyResults;
        } catch (apifyError) {
          logger.warn("[AppStore] Apify fallback failed (may need paid plan)", {
            appRef,
            error: apifyError instanceof Error ? apifyError.message : String(apifyError),
          });
        }
      }

      if (reviews.length === 0) continue;

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `appstore-${review.id}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
      logger.error("[AppStore] Error scanning", { appRef, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return count;
}

async function scanPlayStoreForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Use platformUrls.playstore if provided, then keywords
  const configuredUrl = monitor.platformUrls?.playstore;
  const appIds = configuredUrl ? [configuredUrl] : monitor.keywords.length > 0 ? monitor.keywords : [];

  if (appIds.length === 0) {
    trackScanFailed({
      userId: monitor.userId,
      monitorId: monitor.id,
      platform: "playstore",
      error: new Error("MissingInput: Play Store requires a play.google.com URL or a package name (e.g. com.example.app) in keywords or platformUrls.playstore. None provided — scan skipped."),
    });
    return 0;
  }

  for (const appId of appIds) {
    try {
      const reviews = await fetchPlayStoreReviews(appId, 20);

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `playstore-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
      logger.error("[PlayStore] Error scanning", { appId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return count;
}

// scanQuoraForMonitor removed 2026-04-22 — Quora deferred. See monitor-quora.ts for
// the reference implementation kept for reactivation reference.

/** Process Product Hunt posts: match, deduplicate, insert, and trigger analysis */
async function processProductHuntPosts(
  posts: Array<{ name: string; tagline: string; description: string; url: string; votesCount: number; createdAt: string; user: { name: string }; id?: string }>,
  monitor: MonitorData
): Promise<number> {
  let count = 0;

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
    const matchedUrls = matchedItems.map(m => m.sourceUrl);
    const existing = await pooledDb.query.results.findMany({
      where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
      columns: { sourceUrl: true },
    });
    const existingUrls = new Set(existing.map(r => r.sourceUrl));
    const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

    if (newItems.length > 0) {
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
      await incrementResultsCount(monitor.userId, inserted.length);

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

  return count;
}

// Product Hunt OAuth token cache (shared within this module)
let phAccessToken: string | null = null;
let phTokenExpiresAt: number = 0;

async function getProductHuntAccessToken(): Promise<string | null> {
  const clientId = process.env.PRODUCTHUNT_API_KEY;
  const clientSecret = process.env.PRODUCTHUNT_API_SECRET;

  if (!clientId || !clientSecret) {
    logger.error("[ProductHunt] Missing API credentials (need both API_KEY and API_SECRET)");
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
      logger.error("[ProductHunt] OAuth token request failed", { status: response.status, errorText });
      return null;
    }

    const data = await response.json();
    phAccessToken = data.access_token;
    phTokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 86400000);

    logger.info("[ProductHunt] Successfully obtained access token for on-demand scan");
    return phAccessToken;
  } catch (error) {
    logger.error("[ProductHunt] Error getting access token", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function scanProductHuntForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Strategy: Use Serper to search Product Hunt if available, otherwise fall back to GraphQL API
  const searchTerms = monitor.keywords.length > 0
    ? monitor.keywords.slice(0, 5)
    : monitor.companyName ? [monitor.companyName] : [];

  // Try Serper-based search first (more effective, searches full PH history)
  if (isSerperConfigured() && searchTerms.length > 0) {
    try {
      const allPosts: Array<{ name: string; tagline: string; description: string; url: string; votesCount: number; createdAt: string; user: { name: string } }> = [];

      for (const term of searchTerms.slice(0, 3)) {
        const query = `site:producthunt.com/posts "${term}"`;
        const apiKey = process.env.SERPER_API_KEY!;
        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, num: 20 }),
        });

        if (response.ok) {
          const data = await response.json();
          const results_list = (data.organic || []) as Array<{ title: string; link: string; snippet: string; date?: string }>;
          for (const r of results_list) {
            if (r.link.includes("producthunt.com/posts/")) {
              allPosts.push({
                name: r.title.replace(/ - Product Hunt$/i, "").trim(),
                tagline: r.snippet.slice(0, 200),
                description: r.snippet,
                url: r.link,
                votesCount: 0,
                createdAt: r.date || new Date().toISOString(),
                user: { name: "Product Hunt" },
              });
            }
          }
        }
      }

      if (allPosts.length > 0) {
        // Deduplicate by URL
        const seen = new Set<string>();
        const posts = allPosts.filter(p => {
          if (seen.has(p.url)) return false;
          seen.add(p.url);
          return true;
        });

        // Process using same logic as GraphQL path below
        return await processProductHuntPosts(posts, monitor);
      }
    } catch (error) {
      logger.warn("[ProductHunt] Serper search failed, falling back to GraphQL", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Fallback: Use Product Hunt GraphQL API (fetches newest 50, filters locally)
  const accessToken = await getProductHuntAccessToken();
  if (!accessToken) {
    logger.info("[ProductHunt] OAuth authentication failed, skipping on-demand scan");
    return 0;
  }

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
      logger.error("[ProductHunt] Failed to fetch", { status: response.status });
      return 0;
    }

    const data = await response.json();
    const posts = data.data?.posts?.edges?.map((e: { node: unknown }) => e.node) || [];

    count = await processProductHuntPosts(posts, monitor);
  } catch (error) {
    logger.error("[ProductHunt] Error in on-demand scan", { error: error instanceof Error ? error.message : String(error) });
  }

  return count;
}

// ============================================================================
// New Platform Scanning Functions (Phase 2 - Apify Integration)
// ============================================================================

/**
 * Scan YouTube for video comments matching monitor keywords.
 * Keywords should contain YouTube video URLs.
 * Uses official YouTube Data API v3
 */
async function scanYouTubeForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    logger.debug("[YouTube] YOUTUBE_API_KEY not configured, skipping");
    return 0;
  }

  // Collect video URLs: platformUrls.youtube, then keywords containing youtube URLs
  const configuredYoutubeUrl = monitor.platformUrls?.youtube;
  const videoUrls = configuredYoutubeUrl
    ? [configuredYoutubeUrl, ...monitor.keywords.filter(k => k.includes("youtube.com") || k.includes("youtu.be"))]
    : monitor.keywords.filter(k => k.includes("youtube.com") || k.includes("youtu.be"));

  // If no explicit video URLs, search YouTube for videos matching keywords
  if (videoUrls.length === 0) {
    const searchTerms = monitor.keywords.length > 0
      ? monitor.keywords.slice(0, 3) // Limit to 3 keyword searches (100 units each)
      : monitor.companyName ? [monitor.companyName] : [];

    for (const term of searchTerms) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(term)}&type=video&order=date&maxResults=5&key=${apiKey}`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(15000) });
        if (!searchRes.ok) {
          logger.warn("[YouTube] Search API failed", { term, status: searchRes.status });
          continue;
        }
        const searchData = await searchRes.json();
        const videos = searchData.items || [];
        for (const video of videos) {
          if (video.id?.videoId) {
            videoUrls.push(`https://www.youtube.com/watch?v=${video.id.videoId}`);
          }
        }
      } catch (error) {
        logger.warn("[YouTube] Search failed", { term, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  if (videoUrls.length === 0) {
    logger.debug("[YouTube] No videos found for keywords, skipping");
    return 0;
  }

  for (const videoUrl of videoUrls) {
    try {
      const comments = await fetchYouTubeCommentsApi(videoUrl, 50);

      // Batch check for existing results
      const urls = comments.map(comment => `https://www.youtube.com/watch?v=${comment.videoId}&lc=${comment.commentId}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
      logger.error("[YouTube] Error scanning", { videoUrl, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return count;
}

/**
 * Scan G2 for software reviews matching monitor keywords.
 * Keywords should contain G2 product page URLs.
 * Uses Apify actor: powerai/g2-product-reviews-scraper
 */
async function scanG2ForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Use platformUrls.g2 if provided, then keywords containing g2.com, then company name
  const configuredG2Url = monitor.platformUrls?.g2;
  const g2KeywordUrls = monitor.keywords.filter(k => k.includes("g2.com"));
  const searchTerms = configuredG2Url
    ? [configuredG2Url]
    : g2KeywordUrls.length > 0
      ? g2KeywordUrls
      : monitor.keywords.length > 0
        ? monitor.keywords.slice(0, 5)
        : monitor.companyName ? [monitor.companyName] : [];

  if (searchTerms.length === 0) {
    trackScanFailed({
      userId: monitor.userId,
      monitorId: monitor.id,
      platform: "g2",
      error: new Error("MissingInput: G2 requires a g2.com product URL in keywords, platformUrls.g2, or a companyName. None provided — scan skipped."),
    });
    return 0;
  }

  for (const productUrl of searchTerms) {
    try {
      const reviews = await searchG2Serper(productUrl, 30);

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `g2-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
      logger.error("[G2] Error scanning", { productUrl, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return count;
}

/**
 * Scan Yelp for business reviews matching monitor keywords.
 * Keywords should contain Yelp business page URLs.
 * Uses Apify actor: tri_angle/yelp-review-scraper
 */
async function scanYelpForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;

  // Use platformUrls.yelp if provided, then keywords containing yelp.com, then company name
  const configuredUrl = monitor.platformUrls?.yelp;
  const keywordUrls = monitor.keywords.filter(k => k.includes("yelp.com"));
  const searchTerms = configuredUrl
    ? [configuredUrl]
    : keywordUrls.length > 0
      ? keywordUrls
      : monitor.keywords.length > 0
        ? monitor.keywords.slice(0, 5)
        : monitor.companyName ? [monitor.companyName] : [];

  if (searchTerms.length === 0) {
    trackScanFailed({
      userId: monitor.userId,
      monitorId: monitor.id,
      platform: "yelp",
      error: new Error("MissingInput: Yelp requires a yelp.com URL in keywords, platformUrls.yelp, or a companyName. None provided — scan skipped."),
    });
    return 0;
  }

  for (const businessUrl of searchTerms) {
    try {
      // Use Apify for direct Yelp URLs (gets actual review content), Serper for keyword search
      const isDirectUrl = businessUrl.includes("yelp.com");
      let reviews: Array<{ reviewId: string; text: string; rating: number; date: string; author: string; authorLocation?: string; businessName?: string; photos?: string[]; url?: string }> = [];

      if (isDirectUrl && isApifyConfigured()) {
        logger.info("[Yelp] Using Apify for direct URL", { businessUrl });
        reviews = await fetchYelpReviews(businessUrl, 30);
      }
      if (reviews.length === 0 && isSerperConfigured()) {
        logger.info("[Yelp] Using Serper", { businessUrl });
        reviews = await searchYelpSerper(businessUrl, 30);
      }

      if (reviews.length === 0) continue;

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `yelp-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
      logger.error("[Yelp] Error scanning", { businessUrl, error: error instanceof Error ? error.message : String(error) });
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

  // Use platformUrls.amazonreviews if provided, then keywords containing amazon.com, then company name
  const configuredAmazonUrl = monitor.platformUrls?.amazonreviews;
  const amazonKeywordUrls = monitor.keywords.filter(k =>
    k.includes("amazon.com") || k.includes("amazon.") || /^[A-Z0-9]{10}$/i.test(k)
  );
  const searchTerms = configuredAmazonUrl
    ? [configuredAmazonUrl]
    : amazonKeywordUrls.length > 0
      ? amazonKeywordUrls
      : monitor.keywords.length > 0
        ? monitor.keywords.slice(0, 5)
        : monitor.companyName ? [monitor.companyName] : [];

  if (searchTerms.length === 0) {
    trackScanFailed({
      userId: monitor.userId,
      monitorId: monitor.id,
      platform: "amazonreviews",
      error: new Error("MissingInput: Amazon reviews requires an amazon.com product URL or ASIN in keywords or platformUrls.amazonreviews. None provided — scan skipped."),
    });
    return 0;
  }

  for (const productUrl of searchTerms) {
    try {
      const reviews = await searchAmazonSerper(productUrl, 30);

      // Batch check for existing results
      const urls = reviews.map(review => review.url || `amazon-${review.reviewId}`);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
      logger.error("[Amazon] Error scanning", { productUrl, error: error instanceof Error ? error.message : String(error) });
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
    // Search issues for each keyword (fall back to company name)
    const ghKeywords = monitor.keywords.length > 0
      ? monitor.keywords.slice(0, 5)
      : monitor.companyName ? [monitor.companyName] : [];
    for (const keyword of ghKeywords) {
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
          where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
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
    logger.error("[GitHub] Error scanning", { error: error instanceof Error ? error.message : String(error) });
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
    // Hashnode removed `searchPostsOfFeed` from their public schema
    // (2026-04-23). Use the shared `searchHashnode` helper from
    // monitor-hashnode.ts which pulls feed(type: RELEVANT) and filters
    // client-side — the only viable platform-wide search path now.
    const hashnodeKeywords = monitor.keywords.length > 0
      ? monitor.keywords
      : monitor.companyName ? [monitor.companyName] : [];
    if (hashnodeKeywords.length === 0) return 0;

    const articles = await searchHashnode(hashnodeKeywords, 50);

    interface MatchedHashnodeArticle {
      sourceUrl: string;
      title: string;
      content: string;
      author: string;
      postedAt: Date;
      metadata: Record<string, unknown>;
    }
    const matchedItems: MatchedHashnodeArticle[] = [];

    for (const article of articles) {
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
      const matchedUrls = matchedItems.map(m => m.sourceUrl);
      const existing = await pooledDb.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map(r => r.sourceUrl));
      const newItems = matchedItems.filter(m => !existingUrls.has(m.sourceUrl));

      if (newItems.length > 0) {
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
        await incrementResultsCount(monitor.userId, inserted.length);

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
    logger.error("[Hashnode] Error scanning", { error: error instanceof Error ? error.message : String(error) });
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

    const posts: FeedItem[] = [];

    // Strategy 1: Use Serper to search Indie Hackers by keyword (much more effective)
    const searchTerms = monitor.keywords.length > 0
      ? monitor.keywords.slice(0, 3)
      : monitor.companyName ? [monitor.companyName] : [];

    if (isSerperConfigured() && searchTerms.length > 0) {
      const apiKey = process.env.SERPER_API_KEY!;
      for (const term of searchTerms) {
        try {
          const query = `site:indiehackers.com "${term}"`;
          const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ q: query, num: 15 }),
          });
          if (response.ok) {
            const data = await response.json();
            for (const r of (data.organic || []) as Array<{ title: string; link: string; snippet: string; date?: string }>) {
              if (r.link.includes("indiehackers.com")) {
                posts.push({
                  url: r.link,
                  title: r.title.replace(/ - Indie Hackers$/i, "").trim(),
                  content_text: r.snippet,
                  date_published: r.date || new Date().toISOString(),
                  author: { name: "Indie Hackers" },
                });
              }
            }
          }
        } catch (error) {
          logger.warn("[IndieHackers] Serper search failed for term", { term, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    // Strategy 2: Also pull the JSON feed via shared helper (@/lib/indiehackers)
    // so feed-parsing lives in one place. Feed items get adapted to this
    // scanner's local FeedItem shape since the rest of the flow was built
    // around those field names.
    const feedResult = await fetchIndieHackersFeed(50);
    const existingUrls = new Set(posts.map((p) => p.url));
    for (const post of feedResult.posts) {
      if (!post.url || existingUrls.has(post.url)) continue;
      posts.push({
        id: post.id,
        url: post.url,
        title: post.title,
        content_text: post.body,
        date_published: post.createdAt,
        author: { name: post.author },
      });
      existingUrls.add(post.url);
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
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
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
    logger.error("[IndieHackers] Error scanning", { error: error instanceof Error ? error.message : String(error) });
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
    const devtoKeywords = monitor.keywords.length > 0
      ? monitor.keywords.slice(0, 5)
      : monitor.companyName ? [monitor.companyName] : [];

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

    const fetchDevToArticles = async (url: string): Promise<DevToArticle[]> => {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Kaulby/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) return [];
      return resp.json();
    };

    for (const keyword of devtoKeywords) {
      // Dev.to's /articles?search= endpoint is unreliable — it returns
      // recent articles even when nothing matches the keyword. TAG search
      // actually filters. Strategy: tag each token in the keyword, plus
      // a full-keyword tag for single-word cases.
      const tokens = keyword
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 3 && /^[a-z0-9]+$/.test(t));

      const tagQueries = Array.from(new Set([keyword.toLowerCase(), ...tokens])).filter(
        (t) => /^[a-z0-9]+$/.test(t),
      );

      const articleArrays = await Promise.all(
        tagQueries.map((t) =>
          fetchDevToArticles(
            `https://dev.to/api/articles?tag=${encodeURIComponent(t)}&per_page=30&state=fresh`
          )
        )
      );
      const articles: DevToArticle[] = articleArrays.flat();

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
          where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
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
    logger.error("[Dev.to] Error scanning", { error: error instanceof Error ? error.message : String(error) });
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
    // Use keywords if available, fall back to company name for search
    const searchKeywords = monitor.keywords.length > 0
      ? monitor.keywords
      : monitor.companyName
        ? [monitor.companyName]
        : [];
    if (searchKeywords.length === 0) return 0;

    const searchResult = await searchX(searchKeywords, 50);

    if (searchResult.error) {
      logger.warn("[X] Search warning", { monitorId: monitor.id, error: searchResult.error });
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
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, urls)),
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
    logger.error("[X] Error scanning", { error: error instanceof Error ? error.message : String(error) });
  }

  return count;
}
