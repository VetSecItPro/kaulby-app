import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { contentMatchesMonitor } from "@/lib/content-matcher";
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
 *
 * Strategy:
 * 1. Full-text search via /api/articles?search= (finds articles by title/body)
 * 2. Tag-based search for single-word keywords (finds articles tagged with the term)
 * 3. Deduplicates across both approaches
 */
async function searchDevTo(keywords: string[], maxResults: number = 50): Promise<DevToArticle[]> {
  const articles: DevToArticle[] = [];
  const seenIds = new Set<number>();

  const addArticles = (data: DevToArticle[]) => {
    for (const article of data) {
      if (!seenIds.has(article.id)) {
        seenIds.add(article.id);
        articles.push(article);
      }
    }
  };

  const fetchArticles = async (url: string): Promise<DevToArticle[]> => {
    const response = await fetch(url, {
      headers: { "User-Agent": "Kaulby/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    return response.json();
  };

  try {
    for (const keyword of keywords.slice(0, 5)) {
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

      for (const tag of tagQueries) {
        const tagData = await fetchArticles(
          `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=${Math.min(maxResults, 30)}&state=fresh`
        );
        addArticles(tagData);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Rate limit between keywords
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return articles.slice(0, maxResults);
  } catch (error) {
    logger.error("[Dev.to] Search failed", { error: error instanceof Error ? error.message : String(error) });
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
  { cron: "3 1-23/2 * * *" }, // :03 on odd hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

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
      if (shouldSkipMonitor(monitor, planMap, "devto")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Search Dev.to
      const articles = await step.run(`search-devto-${monitor.id}`, async () => {
        return searchDevTo(monitor.keywords, 50);
      });

      logger.info("[Dev.to] Found articles", { articleCount: articles.length, monitorId: monitor.id });

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
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "devto" });
    }

    return {
      message: `Scanned Dev.to, found ${totalResults} new matching articles`,
      totalResults,
      monitorResults,
    };
  }
);
