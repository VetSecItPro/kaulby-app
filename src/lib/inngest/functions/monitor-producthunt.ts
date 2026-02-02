import { inngest } from "../client";
import {
  getActiveMonitors,
  prefetchPlans,
  shouldSkipMonitor,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  type MonitorStep,
} from "../utils/monitor-helpers";

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
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "0 */2 * * *" }, // Every 2 hours (PH has less frequent posts)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Get OAuth access token
    const accessToken = await step.run("get-access-token", async () => {
      return getProductHuntAccessToken();
    });

    if (!accessToken) {
      return { message: "Product Hunt API credentials not configured or invalid", skipped: true };
    }

    const phMonitors = await getActiveMonitors("producthunt", step);
    if (phMonitors.length === 0) {
      return { message: "No active Product Hunt monitors" };
    }

    const planMap = await prefetchPlans(phMonitors, step);

    // Fetch recent posts from Product Hunt (ONCE before the monitor loop)
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

    // No stagger for ProductHunt - simple for...of loop
    for (const monitor of phMonitors) {
      if (shouldSkipMonitor(monitor, planMap, "producthunt")) continue;

      // Check each post for keyword matches
      const matchingPosts = posts.filter((post) => {
        const text = `${post.name} ${post.tagline} ${post.description || ""}`.toLowerCase();
        return monitor.keywords.some((keyword) =>
          text.includes(keyword.toLowerCase())
        );
      });

      // Save matching posts as results (batch operation)
      const { count, ids: newResultIds } = await saveNewResults<PHPost>({
        items: matchingPosts,
        monitorId: monitor.id,
        userId: monitor.userId,
        getSourceUrl: (post) => post.url,
        mapToResult: (post) => ({
          monitorId: monitor.id,
          platform: "producthunt" as const,
          sourceUrl: post.url,
          title: `${post.name} - ${post.tagline}`,
          content: post.description || null,
          author: post.user?.name || null,
          postedAt: new Date(post.createdAt),
          metadata: {
            phId: post.id,
            votesCount: post.votesCount,
          },
        }),
        step,
      });

      totalResults += count;
      await triggerAiAnalysis(newResultIds, monitor.id, monitor.userId, "producthunt", step);

      monitorResults[monitor.id] = count;
      await updateMonitorStats(monitor.id, count, step);
    }

    return {
      message: `Scanned Product Hunt, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
