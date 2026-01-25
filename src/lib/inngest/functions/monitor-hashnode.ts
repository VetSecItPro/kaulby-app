import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { calculateStaggerDelay, formatStaggerDuration, addJitter, getStaggerWindow } from "../utils/stagger";
import { isMonitorScheduleActive } from "@/lib/monitor-schedule";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";

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
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step }) => {
    // Get all active monitors that include Hashnode
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const hashnodeMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("hashnode")
    );

    if (hashnodeMonitors.length === 0) {
      return { message: "No active Hashnode monitors" };
    }

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    const staggerWindow = getStaggerWindow("hashnode");

    for (let i = 0; i < hashnodeMonitors.length; i++) {
      const monitor = hashnodeMonitors[i];

      // Stagger execution
      if (i > 0 && hashnodeMonitors.length > 3) {
        const baseDelay = calculateStaggerDelay(i, hashnodeMonitors.length, staggerWindow);
        const delayWithJitter = addJitter(baseDelay, 10);
        const delayStr = formatStaggerDuration(delayWithJitter);
        await step.sleep(`stagger-${monitor.id}`, delayStr);
      }

      // Check platform access
      const access = await canAccessPlatform(monitor.userId, "hashnode");
      if (!access.hasAccess) {
        continue;
      }

      // Check refresh delay
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue;
      }

      // Check if monitor is within its active schedule
      if (!isMonitorScheduleActive(monitor)) {
        continue;
      }

      let monitorMatchCount = 0;
      const newResultIds: string[] = [];

      // Search Hashnode
      const articles = await step.run(`search-hashnode-${monitor.id}`, async () => {
        return searchHashnode(monitor.keywords, 50);
      });

      console.log(`[Hashnode] Found ${articles.length} articles for monitor ${monitor.id}`);

      // Check each article for matches
      for (const article of articles) {
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

        if (matchResult.matches) {
          // Check if already exists
          const existing = await db.query.results.findFirst({
            where: eq(results.sourceUrl, article.url),
          });

          if (!existing) {
            const [newResult] = await db.insert(results).values({
              monitorId: monitor.id,
              platform: "hashnode",
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
            }).returning();

            totalResults++;
            monitorMatchCount++;
            newResultIds.push(newResult.id);
            await incrementResultsCount(monitor.userId, 1);
          }
        }
      }

      // Trigger AI analysis - batch mode for large volumes, individual for small
      if (newResultIds.length > 0) {
        await step.run(`trigger-analysis-${monitor.id}`, async () => {
          if (newResultIds.length > AI_BATCH_CONFIG.BATCH_THRESHOLD) {
            // Batch mode for cost efficiency (>50 results)
            await inngest.send({
              name: "content/analyze-batch",
              data: {
                monitorId: monitor.id,
                userId: monitor.userId,
                platform: "hashnode",
                resultIds: newResultIds,
                totalCount: newResultIds.length,
              },
            });
          } else {
            // Individual analysis for small volumes
            for (const resultId of newResultIds) {
              await inngest.send({
                name: "content/analyze",
                data: {
                  resultId,
                  userId: monitor.userId,
                },
              });
            }
          }
        });
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
      message: `Scanned Hashnode, found ${totalResults} new matching articles`,
      totalResults,
      monitorResults,
    };
  }
);
