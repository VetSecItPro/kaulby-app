import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { captureEvent } from "@/lib/posthog";
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

/**
 * Telemetry outcome for a single IH fetch attempt.
 * Feeds PostHog dashboards (event: "ih_fetch") for the 7-day reliability review
 * mandated by .mdmp/apify-platform-cost-audit-2026-04-21.md. If 7-day error
 * rate exceeds ~5%, the audit's Crawlee-actor recommendation should come back.
 */
type IHFetchOutcome =
  | "feed_ok"                  // feed.json succeeded with posts
  | "feed_empty"               // feed.json succeeded but returned 0 items
  | "feed_fail_scrape_ok"      // feed.json failed, HTML scrape succeeded
  | "feed_fail_scrape_empty"   // feed.json failed, HTML scrape returned 0 items
  | "all_failed";              // both feed.json and HTML scrape errored

// Indie Hackers post interface
interface IndieHackersPost {
  id: string;
  title: string;
  body: string;
  author: string;
  url: string;
  createdAt: string;
  upvotes: number;
  commentCount: number;
  category?: string;
}

interface IHFetchResult {
  posts: IndieHackersPost[];
  outcome: IHFetchOutcome;
  httpStatus?: number;
  errorMessage?: string;
}

/**
 * Fetch Indie Hackers posts via their public feed
 * IH doesn't have an official API, but we can scrape the JSON feed
 */
async function fetchIndieHackersPosts(keywords: string[], maxPosts: number = 50): Promise<IHFetchResult> {
  let feedHttpStatus: number | undefined;
  try {
    // Indie Hackers has a public feed at /feed.json or we can scrape the homepage
    const response = await fetch("https://www.indiehackers.com/feed.json", {
      headers: {
        "User-Agent": "Kaulby/1.0 (Community Monitoring Tool)",
        "Accept": "application/json",
      },
    });
    feedHttpStatus = response.status;

    if (!response.ok) {
      // Fallback to scraping approach if feed doesn't exist / is blocked (429, 403, 5xx)
      logger.info("[IndieHackers] Feed not available, using fallback scraping", { feedHttpStatus });
      const scraped = await scrapeIndieHackers(keywords, maxPosts);
      return {
        posts: scraped.posts,
        outcome: scraped.posts.length > 0 ? "feed_fail_scrape_ok" : scraped.errored ? "all_failed" : "feed_fail_scrape_empty",
        httpStatus: feedHttpStatus,
        errorMessage: scraped.errorMessage,
      };
    }

    const data = await response.json();
    const posts: IndieHackersPost[] = [];

    // Parse the feed items
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items.slice(0, maxPosts)) {
        posts.push({
          id: item.id || item.url || "",
          title: item.title || "",
          body: item.content_text || item.content_html || "",
          author: item.author?.name || item.authors?.[0]?.name || "Unknown",
          url: item.url || "",
          createdAt: item.date_published || new Date().toISOString(),
          upvotes: 0, // Not available in feed
          commentCount: 0, // Not available in feed
          category: item.tags?.[0] || undefined,
        });
      }
    }

    return {
      posts,
      outcome: posts.length > 0 ? "feed_ok" : "feed_empty",
      httpStatus: feedHttpStatus,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[IndieHackers] Error fetching posts", { error: errorMessage });
    const scraped = await scrapeIndieHackers(keywords, maxPosts);
    return {
      posts: scraped.posts,
      outcome: scraped.posts.length > 0 ? "feed_fail_scrape_ok" : scraped.errored ? "all_failed" : "feed_fail_scrape_empty",
      httpStatus: feedHttpStatus,
      errorMessage,
    };
  }
}

interface IHScrapeResult {
  posts: IndieHackersPost[];
  errored: boolean;
  errorMessage?: string;
}

/**
 * Fallback scraping approach for Indie Hackers
 * Uses Apify actor or direct HTML parsing
 */
async function scrapeIndieHackers(keywords: string[], maxPosts: number): Promise<IHScrapeResult> {
  try {
    // Try to fetch the homepage and parse recent posts
    const response = await fetch("https://www.indiehackers.com/", {
      headers: {
        "User-Agent": "Kaulby/1.0 (Community Monitoring Tool)",
        "Accept": "text/html",
      },
    });

    if (!response.ok) {
      logger.error("[IndieHackers] Failed to fetch homepage", { httpStatus: response.status });
      return { posts: [], errored: true, errorMessage: `homepage HTTP ${response.status}` };
    }

    const html = await response.text();
    const posts: IndieHackersPost[] = [];

    // Extract post data from __NEXT_DATA__ script tag (if Next.js)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData.props?.pageProps;

        // Look for posts in the page props
        const feedPosts = pageProps?.posts || pageProps?.feed || [];
        for (const post of feedPosts.slice(0, maxPosts)) {
          posts.push({
            id: post.id || post._id || "",
            title: post.title || post.headline || "",
            body: post.body || post.content || post.text || "",
            author: post.author?.username || post.user?.username || "Unknown",
            url: post.url || `https://www.indiehackers.com/post/${post.id}`,
            createdAt: post.createdAt || post.created_at || new Date().toISOString(),
            upvotes: post.upvotes || post.score || 0,
            commentCount: post.commentCount || post.comments?.length || 0,
            category: post.category || post.group?.name || undefined,
          });
        }
      } catch {
        logger.warn("[IndieHackers] Failed to parse __NEXT_DATA__");
      }
    }

    // If no posts found via Next.js data, try regex patterns
    if (posts.length === 0) {
      // Basic regex to extract post links and titles
      const postPattern = /<a[^>]+href="(\/post\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      while ((match = postPattern.exec(html)) !== null && posts.length < maxPosts) {
        posts.push({
          id: match[1],
          title: match[2].trim(),
          body: "",
          author: "Unknown",
          url: `https://www.indiehackers.com${match[1]}`,
          createdAt: new Date().toISOString(),
          upvotes: 0,
          commentCount: 0,
        });
      }
    }

    return { posts, errored: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[IndieHackers] Scraping failed", { error: errorMessage });
    return { posts: [], errored: true, errorMessage };
  }
}

// Scan Indie Hackers for new posts matching monitor keywords
export const monitorIndieHackers = inngest.createFunction(
  {
    id: "monitor-indiehackers",
    name: "Monitor Indie Hackers",
    retries: 3,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "49 */2 * * *" }, // :49 on even hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    const ihMonitors = await getActiveMonitors("indiehackers", step);
    if (ihMonitors.length === 0) {
      return { message: "No active Indie Hackers monitors" };
    }

    const planMap = await prefetchPlans(ihMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < ihMonitors.length; i++) {
      const monitor = ihMonitors[i];

      await applyStagger(i, ihMonitors.length, "indiehackers", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "indiehackers")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Fetch Indie Hackers posts with outcome telemetry
      const { posts, outcome, httpStatus, errorMessage, durationMs } = await step.run(`fetch-ih-${monitor.id}`, async () => {
        const start = Date.now();
        const result = await fetchIndieHackersPosts(monitor.keywords, 100);
        return { ...result, durationMs: Date.now() - start };
      });

      logger.info("[IndieHackers] Fetched posts", {
        postCount: posts.length,
        monitorId: monitor.id,
        outcome,
        httpStatus,
        durationMs,
      });

      // Emit a structured event so 7-day reliability can be queried from PostHog.
      // See .mdmp/apify-platform-cost-audit-2026-04-21.md — if error rate > ~5%,
      // revisit the Crawlee-actor recommendation.
      captureEvent({
        distinctId: monitor.userId,
        event: "ih_fetch",
        properties: {
          monitor_id: monitor.id,
          outcome,
          http_status: httpStatus,
          duration_ms: durationMs,
          posts_count: posts.length,
          error_message: errorMessage,
        },
      });

      // Check each post for matches using content matcher
      const matchingPosts = posts.filter((post) => {
        const matchResult = contentMatchesMonitor(
          {
            title: post.title,
            body: post.body,
            author: post.author,
          },
          {
            companyName: monitor.companyName,
            keywords: monitor.keywords,
            searchQuery: monitor.searchQuery,
          }
        );
        return matchResult.matches;
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<IndieHackersPost>({
        items: matchingPosts,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (post) => post.url,
        mapToResult: (post) => ({
          monitorId: monitor.id,
          platform: "indiehackers" as const,
          sourceUrl: post.url,
          title: post.title,
          content: post.body,
          author: post.author,
          postedAt: new Date(post.createdAt),
          metadata: {
            upvotes: post.upvotes,
            commentCount: post.commentCount,
            category: post.category,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "indiehackers", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "indiehackers" });
    }

    return {
      message: `Scanned Indie Hackers, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
