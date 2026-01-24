import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { calculateStaggerDelay, formatStaggerDuration, addJitter, getStaggerWindow } from "../utils/stagger";

// Dev.to article interface (from their API)
interface DevToArticle {
  id: number;
  title: string;
  description: string;
  body_markdown?: string;
  body_html?: string;
  user: {
    username: string;
    name: string;
  };
  url: string;
  created_at: string;
  published_at: string;
  positive_reactions_count: number;
  comments_count: number;
  reading_time_minutes: number;
  tags: string[];
  tag_list: string;
}

/**
 * Search Dev.to articles via their public API
 * API is free and doesn't require authentication for read operations
 * Rate limit: 30 requests per minute
 */
async function searchDevTo(keywords: string[], maxResults: number = 50): Promise<DevToArticle[]> {
  const articles: DevToArticle[] = [];
  const seenIds = new Set<number>();

  try {
    for (const keyword of keywords.slice(0, 5)) { // Limit keywords for rate limits
      const response = await fetch(
        `https://dev.to/api/articles?tag=${encodeURIComponent(keyword)}&per_page=${Math.min(maxResults, 30)}&state=fresh`,
        {
          headers: {
            "User-Agent": "Kaulby/1.0",
            "Accept": "application/json",
          },
        }
      );

      if (response.ok) {
        const data: DevToArticle[] = await response.json();
        for (const article of data) {
          if (!seenIds.has(article.id)) {
            seenIds.add(article.id);
            articles.push(article);
          }
        }
      } else {
        console.warn(`[Dev.to] Search failed for tag "${keyword}": ${response.status}`);
      }

      // Also search by query string
      const searchResponse = await fetch(
        `https://dev.to/api/articles?per_page=${Math.min(maxResults, 30)}`,
        {
          headers: {
            "User-Agent": "Kaulby/1.0",
            "Accept": "application/json",
          },
        }
      );

      if (searchResponse.ok) {
        const searchData: DevToArticle[] = await searchResponse.json();
        for (const article of searchData) {
          // Filter by keyword in title or description
          const matchesKeyword =
            article.title.toLowerCase().includes(keyword.toLowerCase()) ||
            article.description?.toLowerCase().includes(keyword.toLowerCase()) ||
            article.tag_list.toLowerCase().includes(keyword.toLowerCase());

          if (matchesKeyword && !seenIds.has(article.id)) {
            seenIds.add(article.id);
            articles.push(article);
          }
        }
      }

      // Rate limit: wait 2 seconds between requests (30/min = 1 every 2s)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return articles.slice(0, maxResults);
  } catch (error) {
    console.error("[Dev.to] Search failed:", error);
    return [];
  }
}

// Scan Dev.to for new articles matching monitor keywords
export const monitorDevTo = inngest.createFunction(
  {
    id: "monitor-devto",
    name: "Monitor Dev.to",
    retries: 3,
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step }) => {
    // Get all active monitors that include Dev.to
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const devtoMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("devto")
    );

    if (devtoMonitors.length === 0) {
      return { message: "No active Dev.to monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    const staggerWindow = getStaggerWindow("devto");

    for (let i = 0; i < devtoMonitors.length; i++) {
      const monitor = devtoMonitors[i];

      // Stagger execution
      if (i > 0 && devtoMonitors.length > 3) {
        const baseDelay = calculateStaggerDelay(i, devtoMonitors.length, staggerWindow);
        const delayWithJitter = addJitter(baseDelay, 10);
        const delayStr = formatStaggerDuration(delayWithJitter);
        await step.sleep(`stagger-${monitor.id}`, delayStr);
      }

      // Check platform access
      const access = await canAccessPlatform(monitor.userId, "devto");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      let monitorMatchCount = 0;

      // Search Dev.to
      const articles = await step.run(`search-devto-${monitor.id}`, async () => {
        return searchDevTo(monitor.keywords, 50);
      });

      console.log(`[Dev.to] Found ${articles.length} articles for monitor ${monitor.id}`);

      // Check each article for matches
      for (const article of articles) {
        const matchResult = contentMatchesMonitor(
          {
            title: article.title,
            body: article.description + " " + (article.body_markdown || ""),
            author: article.user.username,
          },
          {
            companyName: monitor.companyName,
            keywords: monitor.keywords,
            searchQuery: monitor.searchQuery,
          }
        );

        if (matchResult.matches) {
          // Check if already exists
          const existing = await db.query.results.findFirst({
            where: eq(results.sourceUrl, article.url),
          });

          if (!existing) {
            const [newResult] = await db.insert(results).values({
              monitorId: monitor.id,
              platform: "devto",
              sourceUrl: article.url,
              title: article.title,
              content: article.description,
              author: article.user.username,
              postedAt: new Date(article.published_at || article.created_at),
              metadata: {
                reactions: article.positive_reactions_count,
                commentCount: article.comments_count,
                readingTime: article.reading_time_minutes,
                tags: article.tags,
                authorName: article.user.name,
              },
            }).returning();

            totalResults++;
            monitorMatchCount++;
            await incrementResultsCount(monitor.userId, 1);

            await inngest.send({
              name: "content/analyze",
              data: {
                resultId: newResult.id,
                userId: monitor.userId,
              },
            });
          }
        }
      }

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
      message: `Scanned Dev.to, found ${totalResults} new matching articles`,
      totalResults,
      monitorResults,
    };
  }
);
