import { inngest } from "../client";
import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { incrementResultsCount, canAccessPlatform, shouldProcessMonitor } from "@/lib/limits";
import { isMonitorScheduleActive } from "@/lib/monitor-schedule";
import { AI_BATCH_CONFIG } from "@/lib/ai/sampling";

const PH_API_BASE = "https://api.producthunt.com/v2/api/graphql";
const PH_TOKEN_URL = "https://api.producthunt.com/v2/oauth/token";

// Cache for access token (in-memory, refreshed on each cron run)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

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

// Get OAuth access token using Client Credentials flow
async function getProductHuntAccessToken(): Promise<string | null> {
  const clientId = process.env.PRODUCTHUNT_API_KEY;
  const clientSecret = process.env.PRODUCTHUNT_API_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[ProductHunt] Missing API credentials (need both API_KEY and API_SECRET)");
    return null;
  }

  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedAccessToken;
  }

  try {
    const response = await fetch(PH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ProductHunt] OAuth token request failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    // Token typically expires in 2 weeks, but we'll refresh every run anyway
    tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 86400000);

    console.log("[ProductHunt] Successfully obtained access token");
    return cachedAccessToken;
  } catch (error) {
    console.error("[ProductHunt] Error getting access token:", error);
    return null;
  }
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
    // Get OAuth access token
    const accessToken = await step.run("get-access-token", async () => {
      return getProductHuntAccessToken();
    });

    if (!accessToken) {
      return { message: "Product Hunt API credentials not configured or invalid", skipped: true };
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
            Authorization: `Bearer ${accessToken}`,
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
    const monitorResults: Record<string, number> = {};

    for (const monitor of phMonitors) {
      // Check if user has access to Product Hunt platform
      const access = await canAccessPlatform(monitor.userId, "producthunt");
      if (!access.hasAccess) {
        continue; // Skip monitors for users without platform access
      }

      // Check refresh delay for free tier users
      const scheduleCheck = await shouldProcessMonitor(monitor.userId, monitor.lastCheckedAt);
      if (!scheduleCheck.shouldProcess) {
        continue; // Skip monitors that are within refresh delay period
      }

      // Check if monitor is within its active schedule
      if (!isMonitorScheduleActive(monitor)) {
        continue;
      }

      let monitorMatchCount = 0;
      const newResultIds: string[] = [];

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
              const [newResult] = await db.insert(results).values({
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
              }).returning();

              totalResults++;
              monitorMatchCount++;
              newResultIds.push(newResult.id);

              // Increment usage count for the user
              await incrementResultsCount(monitor.userId, 1);
            }
          }
        });
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
                platform: "producthunt",
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
      message: `Scanned Product Hunt, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
