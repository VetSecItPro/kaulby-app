import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { calculateStaggerDelay, formatStaggerDuration, addJitter, getStaggerWindow } from "../utils/stagger";

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

/**
 * Fetch Indie Hackers posts via their public feed
 * IH doesn't have an official API, but we can scrape the JSON feed
 */
async function fetchIndieHackersPosts(keywords: string[], maxPosts: number = 50): Promise<IndieHackersPost[]> {
  try {
    // Indie Hackers has a public feed at /feed.json or we can scrape the homepage
    // For now, we'll use a simple approach - fetch recent posts and filter by keywords
    const response = await fetch("https://www.indiehackers.com/feed.json", {
      headers: {
        "User-Agent": "Kaulby/1.0 (Community Monitoring Tool)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      // Fallback to scraping approach if feed doesn't exist
      console.log("[IndieHackers] Feed not available, using fallback scraping");
      return await scrapeIndieHackers(keywords, maxPosts);
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

    return posts;
  } catch (error) {
    console.error("[IndieHackers] Error fetching posts:", error);
    return await scrapeIndieHackers(keywords, maxPosts);
  }
}

/**
 * Fallback scraping approach for Indie Hackers
 * Uses Apify actor or direct HTML parsing
 */
async function scrapeIndieHackers(keywords: string[], maxPosts: number): Promise<IndieHackersPost[]> {
  try {
    // Try to fetch the homepage and parse recent posts
    const response = await fetch("https://www.indiehackers.com/", {
      headers: {
        "User-Agent": "Kaulby/1.0 (Community Monitoring Tool)",
        "Accept": "text/html",
      },
    });

    if (!response.ok) {
      console.error("[IndieHackers] Failed to fetch homepage");
      return [];
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
        console.warn("[IndieHackers] Failed to parse __NEXT_DATA__");
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

    return posts;
  } catch (error) {
    console.error("[IndieHackers] Scraping failed:", error);
    return [];
  }
}

// Scan Indie Hackers for new posts matching monitor keywords
export const monitorIndieHackers = inngest.createFunction(
  {
    id: "monitor-indiehackers",
    name: "Monitor Indie Hackers",
    retries: 3,
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes (less frequent due to scraping)
  async ({ step }) => {
    // Get all active monitors that include Indie Hackers
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const ihMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("indiehackers")
    );

    if (ihMonitors.length === 0) {
      return { message: "No active Indie Hackers monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    // Calculate stagger window based on number of monitors
    const staggerWindow = getStaggerWindow("indiehackers");

    for (let i = 0; i < ihMonitors.length; i++) {
      const monitor = ihMonitors[i];

      // Stagger execution to prevent thundering herd
      if (i > 0 && ihMonitors.length > 3) {
        const baseDelay = calculateStaggerDelay(i, ihMonitors.length, staggerWindow);
        const delayWithJitter = addJitter(baseDelay, 10);
        const delayStr = formatStaggerDuration(delayWithJitter);
        await step.sleep(`stagger-${monitor.id}`, delayStr);
      }

      // Check if user has access to Indie Hackers platform
      const access = await canAccessPlatform(monitor.userId, "indiehackers");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // Fetch Indie Hackers posts
      const posts = await step.run(`fetch-ih-${monitor.id}`, async () => {
        return fetchIndieHackersPosts(monitor.keywords, 100);
      });

      console.log(`[IndieHackers] Fetched ${posts.length} posts for monitor ${monitor.id}`);

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

      // Save matching posts as results
      if (matchingPosts.length > 0) {
        await step.run(`save-results-${monitor.id}`, async () => {
          for (const post of matchingPosts) {
            // Check if we already have this result
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, post.url),
            });

            if (!existing) {
              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "indiehackers",
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
      message: `Scanned Indie Hackers, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
