import { inngest } from "../client";
import { db, monitors, results } from "@/lib/db";
import { eq } from "drizzle-orm";

const PH_API_BASE = "https://api.producthunt.com/v2/api/graphql";

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  votesCount: number;
  createdAt: string;
  user: {
    name: string;
  };
}

interface PHResponse {
  data: {
    posts: {
      edges: Array<{
        node: PHPost;
      }>;
    };
  };
}

// Scan Product Hunt for new posts matching monitor keywords
export const monitorProductHunt = inngest.createFunction(
  {
    id: "monitor-producthunt",
    name: "Monitor Product Hunt",
    retries: 3,
  },
  { cron: "0 */2 * * *" }, // Every 2 hours (PH has less frequent posts)
  async ({ step }) => {
    // Check if API key is configured
    const apiKey = process.env.PRODUCTHUNT_API_KEY;
    if (!apiKey) {
      return { message: "Product Hunt API key not configured", skipped: true };
    }

    // Get all active monitors that include Product Hunt
    const activeMonitors = await step.run("get-monitors", async () => {
      return db.query.monitors.findMany({
        where: eq(monitors.isActive, true),
      });
    });

    const phMonitors = activeMonitors.filter((m) =>
      m.platforms.includes("producthunt")
    );

    if (phMonitors.length === 0) {
      return { message: "No active Product Hunt monitors" };
    }

    // Fetch recent posts from Product Hunt
    const posts = await step.run("fetch-posts", async () => {
      try {
        const query = `
          query {
            posts(first: 50, order: NEWEST) {
              edges {
                node {
                  id
                  name
                  tagline
                  description
                  url
                  votesCount
                  createdAt
                  user {
                    name
                  }
                }
              }
            }
          }
        `;

        const response = await fetch(PH_API_BASE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          console.error(`Failed to fetch Product Hunt: ${response.status}`);
          return [];
        }

        const data: PHResponse = await response.json();
        return data.data?.posts?.edges?.map((e) => e.node) || [];
      } catch (error) {
        console.error("Error fetching Product Hunt:", error);
        return [];
      }
    });

    if (posts.length === 0) {
      return { message: "No posts fetched from Product Hunt" };
    }

    let totalResults = 0;

    for (const monitor of phMonitors) {
      // Check each post for keyword matches
      const matchingPosts = posts.filter((post) => {
        const text = `${post.name} ${post.tagline} ${post.description || ""}`.toLowerCase();
        return monitor.keywords.some((keyword) =>
          text.includes(keyword.toLowerCase())
        );
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
              await db.insert(results).values({
                monitorId: monitor.id,
                platform: "producthunt",
                sourceUrl: post.url,
                title: `${post.name} - ${post.tagline}`,
                content: post.description || null,
                author: post.user?.name || null,
                postedAt: new Date(post.createdAt),
                metadata: {
                  phId: post.id,
                  votesCount: post.votesCount,
                },
              });

              totalResults++;

              // Trigger content analysis
              await inngest.send({
                name: "content/analyze",
                data: {
                  resultId: post.id,
                  userId: monitor.userId,
                },
              });
            }
          }
        });
      }
    }

    return {
      message: `Scanned Product Hunt, found ${totalResults} new matching posts`,
      totalResults,
    };
  }
);
