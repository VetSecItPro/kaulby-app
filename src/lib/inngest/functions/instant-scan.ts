import { inngest } from "../client";
import { pooledDb } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { isSerperConfigured } from "@/lib/serper";
import { searchRedditSiteWide } from "@/lib/reddit";
import { logger } from "@/lib/logger";

/**
 * Instant lightweight scan triggered immediately after monitor creation.
 *
 * Does a single quick search for the monitor's first keyword on its first
 * platform to give the user early results while the full scan-on-demand
 * function runs in parallel for comprehensive coverage.
 */
export const instantScan = inngest.createFunction(
  {
    id: "instant-scan",
    name: "Instant Lightweight Scan",
    retries: 1,
    timeouts: { finish: "2m" },
    concurrency: {
      limit: 5,
    },
  },
  { event: "monitor/scan.requested" },
  async ({ event, step }) => {
    const { monitorId, userId } = event.data;

    // Fetch monitor details
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

    // Determine the first keyword and first platform
    const firstKeyword = monitor.keywords?.[0] || monitor.companyName;
    const firstPlatform = monitor.platforms?.[0];

    if (!firstKeyword || !firstPlatform) {
      return { skipped: true, reason: "No keyword or platform configured" };
    }

    // Run a lightweight scan for the first keyword on the first platform
    const scanResult = await step.run("quick-scan", async () => {
      try {
        // Reddit uses its own API; everything else uses Serper
        if (firstPlatform === "reddit") {
          const searchResult = await searchRedditSiteWide([firstKeyword], 10);
          if (!searchResult || searchResult.posts.length === 0) {
            return { items: [], platform: firstPlatform };
          }

          // Map to result format
          const items = searchResult.posts.slice(0, 5).map((post) => ({
            sourceUrl: post.url || `https://reddit.com${post.permalink}`,
            title: post.title,
            content: post.selftext || post.title,
            author: post.author,
            platform: "reddit" as const,
            postedAt: new Date(post.created_utc * 1000),
            metadata: {
              subreddit: post.subreddit,
              score: post.score,
              numComments: post.num_comments,
              source: "instant-scan",
            },
          }));
          return { items, platform: firstPlatform };
        }

        // For all other platforms, use a generic Serper search
        if (!isSerperConfigured()) {
          return { items: [], platform: firstPlatform, reason: "Serper not configured" };
        }

        // Build a platform-scoped Serper query
        const siteMap: Record<string, string> = {
          hackernews: "site:news.ycombinator.com",
          producthunt: "site:producthunt.com",
          trustpilot: "site:trustpilot.com",
          g2: "site:g2.com",
          quora: "site:quora.com",
          devto: "site:dev.to",
          hashnode: "site:hashnode.dev OR site:hashnode.com",
          youtube: "site:youtube.com",
          appstore: "site:apps.apple.com",
          playstore: "site:play.google.com",
          yelp: "site:yelp.com",
          amazonreviews: "site:amazon.com",
          indiehackers: "site:indiehackers.com",
          github: "site:github.com",
          googlereviews: "site:google.com/maps",
          x: "site:x.com OR site:twitter.com",
        };

        const siteFilter = siteMap[firstPlatform] || "";
        const query = `${siteFilter} "${firstKeyword}"`;

        const apiKey = process.env.SERPER_API_KEY;
        if (!apiKey) {
          return { items: [], platform: firstPlatform, reason: "No API key" };
        }

        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: query, num: 5 }),
        });

        if (!response.ok) {
          logger.error("Instant scan Serper error", {
            status: response.status,
            monitorId,
          });
          return { items: [], platform: firstPlatform, reason: "Serper error" };
        }

        const data = await response.json();
        const organic = data.organic || [];

        const items = organic.slice(0, 5).map((result: { link: string; title: string; snippet: string; date?: string }) => ({
          sourceUrl: result.link,
          title: result.title,
          content: result.snippet,
          author: null,
          platform: firstPlatform,
          postedAt: result.date ? new Date(result.date) : new Date(),
          metadata: { source: "instant-scan" },
        }));

        return { items, platform: firstPlatform };
      } catch (error) {
        logger.error("Instant scan failed", {
          error: error instanceof Error ? error.message : String(error),
          monitorId,
          platform: firstPlatform,
        });
        return { items: [], platform: firstPlatform, reason: "Error" };
      }
    });

    if (!scanResult.items || scanResult.items.length === 0) {
      return { found: 0, platform: firstPlatform };
    }

    // Deduplicate against existing results and insert new ones
    const insertedCount = await step.run("save-results", async () => {
      const sourceUrls = scanResult.items.map((item: { sourceUrl: string }) => item.sourceUrl);

      // Check for existing results with same URLs
      const existing = await pooledDb.query.results.findMany({
        where: and(
          eq(results.monitorId, monitorId),
          inArray(results.sourceUrl, sourceUrls)
        ),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map((r) => r.sourceUrl));

      const newItems = scanResult.items.filter(
        (item: { sourceUrl: string }) => !existingUrls.has(item.sourceUrl)
      );

      if (newItems.length === 0) {
        return 0;
      }

      const inserted = await pooledDb
        .insert(results)
        .values(
          newItems.map((item: {
            sourceUrl: string;
            title: string;
            content: string;
            author: string | null;
            platform: string;
            postedAt: Date;
            metadata: Record<string, unknown>;
          }) => ({
            monitorId: monitor.id,
            platform: item.platform as "reddit" | "hackernews" | "producthunt" | "devto" | "googlereviews" | "trustpilot" | "appstore" | "playstore" | "quora" | "youtube" | "g2" | "yelp" | "amazonreviews" | "indiehackers" | "github" | "hashnode" | "x",
            sourceUrl: item.sourceUrl,
            title: item.title,
            content: item.content,
            author: item.author,
            postedAt: item.postedAt,
            metadata: item.metadata,
          }))
        )
        .returning({ id: results.id });

      return inserted.length;
    });

    logger.info("Instant scan completed", {
      monitorId,
      platform: firstPlatform,
      keyword: firstKeyword,
      found: insertedCount,
    });

    return {
      found: insertedCount,
      platform: firstPlatform,
      keyword: firstKeyword,
    };
  }
);
