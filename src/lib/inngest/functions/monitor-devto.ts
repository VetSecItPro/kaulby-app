import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";

const DEVTO_API_BASE = "https://dev.to/api";

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  body_markdown?: string;
  url: string;
  published_at: string;
  user: {
    name: string;
    username: string;
  };
  tags: string[];
  positive_reactions_count: number;
  comments_count: number;
}

interface DevToComment {
  id_code: string;
  body_html: string;
  user: {
    name: string;
    username: string;
  };
  created_at: string;
}

/**
 * Monitor Dev.to for articles AND comments matching keywords
 *
 * Dev.to is Enterprise-only platform, providing access to developer discussions
 * and technical content that's valuable for B2B SaaS companies.
 *
 * Runs every 2 hours - Dev.to has moderate content velocity
 */
export const monitorDevTo = inngest.createFunction(
  {
    id: "monitor-devto",
    name: "Monitor Dev.to",
    retries: 3,
  },
  { cron: "0 */2 * * *" }, // Every 2 hours
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

    // Fetch latest articles from Dev.to
    const articles = await step.run("fetch-articles", async () => {
      const response = await fetch(`${DEVTO_API_BASE}/articles?per_page=100&top=1`);
      if (!response.ok) {
        console.error("Failed to fetch Dev.to articles:", response.status);
        return [] as DevToArticle[];
      }
      return response.json() as Promise<DevToArticle[]>;
    });

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (const monitor of devtoMonitors) {
      // Check if user has access to Dev.to platform (Enterprise only)
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

      // Find articles matching keywords
      const matchingArticles = articles.filter((article) => {
        if (!article || !article.title) return false;
        const text = `${article.title} ${article.description || ""} ${article.tags?.join(" ") || ""}`.toLowerCase();
        return monitor.keywords.some((keyword) =>
          text.includes(keyword.toLowerCase())
        );
      });

      // Save matching articles
      if (matchingArticles.length > 0) {
        await step.run(`save-articles-${monitor.id}`, async () => {
          for (const article of matchingArticles) {
            // Check if we already have this article
            const existing = await db.query.results.findFirst({
              where: eq(results.sourceUrl, article.url),
            });

            if (!existing) {
              const [newResult] = await db.insert(results).values({
                monitorId: monitor.id,
                platform: "devto",
                sourceUrl: article.url,
                title: article.title,
                content: article.description || null,
                author: article.user.username,
                postedAt: new Date(article.published_at),
                metadata: {
                  devtoId: article.id,
                  reactions: article.positive_reactions_count,
                  commentsCount: article.comments_count,
                  tags: article.tags,
                  type: "article",
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
        });
      }

      // Fetch and check comments on popular articles for keyword matches
      // This catches discussions that mention keywords even if the article title doesn't
      const articlesToCheckComments = articles
        .filter((a) => a.comments_count > 0)
        .slice(0, 20); // Check comments on top 20 articles with comments

      for (const article of articlesToCheckComments) {
        const comments = await step.run(`fetch-comments-${article.id}`, async () => {
          try {
            const response = await fetch(`${DEVTO_API_BASE}/comments?a_id=${article.id}`);
            if (!response.ok) return [] as DevToComment[];
            return response.json() as Promise<DevToComment[]>;
          } catch {
            return [] as DevToComment[];
          }
        });

        // Filter comments matching keywords
        const matchingComments = comments.filter((comment) => {
          if (!comment || !comment.body_html) return false;
          const text = comment.body_html.toLowerCase();
          return monitor.keywords.some((keyword) =>
            text.includes(keyword.toLowerCase())
          );
        });

        if (matchingComments.length > 0) {
          await step.run(`save-comments-${monitor.id}-${article.id}`, async () => {
            for (const comment of matchingComments) {
              const commentUrl = `${article.url}#comment-${comment.id_code}`;

              // Check if we already have this comment
              const existing = await db.query.results.findFirst({
                where: eq(results.sourceUrl, commentUrl),
              });

              if (!existing) {
                // Strip HTML tags for clean content
                const cleanContent = comment.body_html
                  .replace(/<[^>]*>/g, "")
                  .trim();

                const [newResult] = await db.insert(results).values({
                  monitorId: monitor.id,
                  platform: "devto",
                  sourceUrl: commentUrl,
                  title: `Comment on: ${article.title}`,
                  content: cleanContent,
                  author: comment.user.username,
                  postedAt: new Date(comment.created_at),
                  metadata: {
                    devtoCommentId: comment.id_code,
                    parentArticleId: article.id,
                    parentArticleTitle: article.title,
                    type: "comment",
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
          });
        }
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
      message: `Scanned Dev.to, found ${totalResults} new articles and comments`,
      totalResults,
      monitorResults,
    };
  }
);
