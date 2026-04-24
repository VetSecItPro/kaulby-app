import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { contentMatchesMonitor, includesTokenized } from "@/lib/content-matcher";
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

// Hashnode article interface
export interface HashnodeArticle {
  id: string;
  title: string;
  brief: string;
  content?: {
    markdown?: string;
    text?: string;
  };
  author: {
    username: string;
    name: string;
  };
  url: string;
  publishedAt: string;
  reactionCount: number;
  responseCount: number;
  readTimeInMinutes: number;
  tags: Array<{ name: string; slug: string }>;
  publication?: {
    title: string;
  };
}

/**
 * Search Hashnode articles via their GraphQL API
 * API is free and public
 */
export async function searchHashnode(keywords: string[], maxResults: number = 50): Promise<HashnodeArticle[]> {
  const articles: HashnodeArticle[] = [];
  const seenIds = new Set<string>();

  // NOTE (2026-04-23): Hashnode removed `searchPostsOfFeed` from their public
  // GraphQL schema. Their current feed filter supports only {type, tags,
  // minReadTime, maxReadTime} — no free-text search. Platform-wide keyword
  // search is no longer available in their public API.
  //
  // Strategy now: pull the RECENT feed (their most-active posts), filter
  // client-side by keyword match in title/brief/tags. This gets the last N
  // published articles on Hashnode's platform; we then grep locally.
  //
  // Confirmed via schema introspection 2026-04-23: `feed` and
  // `searchPostsOfPublication` are the only post-level queries available;
  // the latter is scoped to a single publication and thus unsuitable for
  // platform-wide monitoring.

  try {
    // One feed pull covers all keywords since we filter client-side
    const feedQuery = `
      query FeedPosts {
        feed(first: 50, filter: { type: RELEVANT }) {
          edges {
            node {
              id
              title
              brief
              content {
                markdown
              }
              author {
                username
                name
              }
              url
              publishedAt
              reactionCount
              responseCount
              readTimeInMinutes
              tags {
                name
                slug
              }
              publication {
                title
              }
            }
          }
        }
      }`;

    const response = await fetch("https://gql.hashnode.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Kaulby/1.0",
      },
      body: JSON.stringify({ query: feedQuery }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.errors) {
        logger.warn("[Hashnode] Feed GraphQL errors", { errors: data.errors });
      }
      const edges = data.data?.feed?.edges || [];

      for (const edge of edges) {
        const article = edge.node;
        if (!article || seenIds.has(article.id)) continue;

        // Client-side keyword filter — match in title, brief, content, or tag names.
        // includesTokenized handles multi-word keywords like "Anthropic Claude" by
        // matching when all tokens appear independently (not only as exact phrase).
        const haystack = [
          article.title || "",
          article.brief || "",
          article.content?.markdown?.slice(0, 2000) || "",
          ...(article.tags || []).map((t: { name: string }) => t.name),
        ]
          .join(" ")
          .toLowerCase();

        if (keywords.some((kw) => includesTokenized(haystack, kw))) {
          seenIds.add(article.id);
          articles.push(article);
        }
      }
    }

    return articles.slice(0, maxResults);
  } catch (error) {
    logger.error("[Hashnode] Search failed", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

// Scan Hashnode for new articles matching monitor keywords
export const monitorHashnode = inngest.createFunction(
  {
    id: "monitor-hashnode",
    name: "Monitor Hashnode",
    retries: 3,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "10 1-23/2 * * *" }, // :10 on odd hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

    const hashnodeMonitors = await getActiveMonitors("hashnode", step);
    if (hashnodeMonitors.length === 0) {
      return { message: "No active Hashnode monitors" };
    }

    const planMap = await prefetchPlans(hashnodeMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < hashnodeMonitors.length; i++) {
      const monitor = hashnodeMonitors[i];

      await applyStagger(i, hashnodeMonitors.length, "hashnode", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "hashnode")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      // Search Hashnode
      const articles = await step.run(`search-hashnode-${monitor.id}`, async () => {
        return searchHashnode(monitor.keywords, 50);
      });

      logger.info("[Hashnode] Found articles", { articleCount: articles.length, monitorId: monitor.id });

      // Check each article for matches
      const matchingArticles = articles.filter((article) => {
        const matchResult = contentMatchesMonitor(
          {
            title: article.title,
            body: article.brief + " " + (article.content?.text || article.content?.markdown || ""),
            author: article.author.username,
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
      const { count, ids: newResultIds } = await saveNewResults<HashnodeArticle>({
        items: matchingArticles,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (article) => article.url,
        mapToResult: (article) => ({
          monitorId: monitor.id,
          platform: "hashnode" as const,
          sourceUrl: article.url,
          title: article.title,
          content: article.brief,
          author: article.author.username,
          postedAt: new Date(article.publishedAt),
          metadata: {
            reactions: article.reactionCount,
            commentCount: article.responseCount,
            readingTime: article.readTimeInMinutes,
            tags: article.tags?.map(t => t.name) || [],
            authorName: article.author.name,
            publication: article.publication?.title,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "hashnode", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step, { userId: monitor.userId, platform: "hashnode" });
    }

    return {
      message: `Scanned Hashnode, found ${totalResults} new matching articles`,
      totalResults,
      monitorResults,
    };
  }
);
