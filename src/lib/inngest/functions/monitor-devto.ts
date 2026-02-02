import { inngest } from "../client";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  type MonitorStep,
} from "../utils/monitor-helpers";

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
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    const devtoMonitors = await getActiveMonitors("devto", step);
    if (devtoMonitors.length === 0) {
      return { message: "No active Dev.to monitors" };
    }

    const planMap = await prefetchPlans(devtoMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < devtoMonitors.length; i++) {
      const monitor = devtoMonitors[i];

      await applyStagger(i, devtoMonitors.length, "devto", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "devto")) continue;

      // Search Dev.to
      const articles = await step.run(`search-devto-${monitor.id}`, async () => {
        return searchDevTo(monitor.keywords, 50);
      });

      console.log(`[Dev.to] Found ${articles.length} articles for monitor ${monitor.id}`);

      // Check each article for matches
      const matchingArticles = articles.filter((article) => {
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
        return matchResult.matches;
      });

      // Save new results
      const { count, ids: newResultIds } = await saveNewResults<DevToArticle>({
        items: matchingArticles,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (article) => article.url,
        mapToResult: (article) => ({
          monitorId: monitor.id,
          platform: "devto" as const,
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
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "devto", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Dev.to, found ${totalResults} new matching articles`,
      totalResults,
      monitorResults,
    };
  }
);
