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

// Hashnode article interface
interface HashnodeArticle {
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
async function searchHashnode(keywords: string[], maxResults: number = 50): Promise<HashnodeArticle[]> {
  const articles: HashnodeArticle[] = [];
  const seenIds = new Set<string>();

  try {
    for (const keyword of keywords.slice(0, 5)) {
      // Hashnode uses GraphQL API
      const query = `
        query SearchPosts($query: String!) {
          searchPostsOfFeed(first: 20, filter: { query: $query }) {
            edges {
              node {
                id
                title
                brief
                content {
                  markdown
                  text
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
        }
      `;

      const response = await fetch("https://gql.hashnode.com/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Kaulby/1.0",
        },
        body: JSON.stringify({
          query,
          variables: { query: keyword },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const edges = data.data?.searchPostsOfFeed?.edges || [];

        for (const edge of edges) {
          const article = edge.node;
          if (article && !seenIds.has(article.id)) {
            seenIds.add(article.id);
            articles.push(article);
          }
        }
      } else {
        console.warn(`[Hashnode] Search failed for "${keyword}": ${response.status}`);

        // Fallback: Try the feed API
        const feedQuery = `
          query FeedPosts {
            feed(first: 30, filter: { type: RELEVANT }) {
              edges {
                node {
                  id
                  title
                  brief
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
                }
              }
            }
          }
        `;

        const feedResponse = await fetch("https://gql.hashnode.com/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Kaulby/1.0",
          },
          body: JSON.stringify({ query: feedQuery }),
        });

        if (feedResponse.ok) {
          const feedData = await feedResponse.json();
          const feedEdges = feedData.data?.feed?.edges || [];

          for (const edge of feedEdges) {
            const article = edge.node;
            if (!article || seenIds.has(article.id)) continue;

            // Filter by keyword match
            const matchesKeyword =
              article.title.toLowerCase().includes(keyword.toLowerCase()) ||
              article.brief?.toLowerCase().includes(keyword.toLowerCase()) ||
              article.tags?.some((t: { name: string }) => t.name.toLowerCase().includes(keyword.toLowerCase()));

            if (matchesKeyword) {
              seenIds.add(article.id);
              articles.push(article);
            }
          }
        }
      }

      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return articles.slice(0, maxResults);
  } catch (error) {
    console.error("[Hashnode] Search failed:", error);
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
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

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
      if (shouldSkipMonitor(monitor, planMap, "hashnode")) continue;

      // Search Hashnode
      const articles = await step.run(`search-hashnode-${monitor.id}`, async () => {
        return searchHashnode(monitor.keywords, 50);
      });

      console.log(`[Hashnode] Found ${articles.length} articles for monitor ${monitor.id}`);

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
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Hashnode, found ${totalResults} new matching articles`,
      totalResults,
      monitorResults,
    };
  }
);
