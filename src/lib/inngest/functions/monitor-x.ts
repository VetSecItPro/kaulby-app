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

export interface XPost {
  id: string;
  text: string;
  author: string;
  authorUsername: string;
  url: string;
  createdAt: string;
  likes: number;
  retweets: number;
  replies: number;
}

/**
 * Search X/Twitter via xAI's Responses API with x_search tool.
 *
 * Uses the /v1/responses endpoint with the x_search server-side tool
 * and structured outputs to get consistent JSON results.
 *
 * Model: grok-4-1-fast (recommended for agentic tool calling)
 * Pricing: token usage + server-side tool invocations
 */
export async function searchX(
  keywords: string[],
  limit: number = 50
): Promise<{ posts: XPost[]; error?: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { posts: [], error: "XAI_API_KEY not configured" };
  }

  try {
    const searchQuery = keywords.join(" OR ");

    // Calculate date range: search last 7 days
    const toDate = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-3-fast",
        input: [
          {
            role: "system",
            content: `You are a research assistant that searches X/Twitter for recent posts. Return results as a JSON array with these fields for each post: id (string), text (full post text), author (display name), authorUsername (handle without @), url (full post URL like https://x.com/username/status/id), createdAt (ISO date string), likes (number), retweets (number), replies (number). Return ONLY the JSON array, no markdown, no code fences, no explanation. If no results found, return an empty array []. Limit to ${limit} most recent and relevant results.`,
          },
          {
            role: "user",
            content: `Search X/Twitter for recent posts about: ${searchQuery}`,
          },
        ],
        tools: [
          {
            type: "x_search",
            from_date: fromDate,
            to_date: toDate,
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // The Responses API returns output items - find the assistant message content
    let content = "";
    if (data.output) {
      // Responses API format: output is an array of items
      for (const item of data.output) {
        if (item.type === "message" && item.role === "assistant") {
          // Content can be a string or array of content parts
          if (typeof item.content === "string") {
            content = item.content;
          } else if (Array.isArray(item.content)) {
            content = item.content
              .filter(
                (part: { type: string; text?: string }) =>
                  part.type === "output_text" || part.type === "text"
              )
              .map((part: { text: string }) => part.text)
              .join("");
          }
        }
      }
    } else if (data.choices) {
      // Fallback: Chat Completions format (in case the API returns this format)
      content = data.choices?.[0]?.message?.content || "[]";
    }

    if (!content) {
      return { posts: [], error: "No content in xAI response" };
    }

    // Parse the JSON response from Grok
    let posts: XPost[] = [];
    try {
      // Strip markdown code fences if present
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      // Try to extract JSON array from the response
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        posts = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.warn("[X] Failed to parse Grok response as JSON");
      posts = [];
    }

    // Validate and clean posts
    posts = posts
      .filter(
        (p): p is XPost =>
          typeof p === "object" &&
          p !== null &&
          typeof p.text === "string" &&
          p.text.length > 0 &&
          typeof p.authorUsername === "string" &&
          p.authorUsername.length > 0
      )
      .map((p) => ({
        id: p.id || `x-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: p.text,
        author: p.author || p.authorUsername,
        authorUsername: p.authorUsername.replace(/^@/, ""),
        url:
          p.url ||
          `https://x.com/${p.authorUsername.replace(/^@/, "")}/status/${p.id || "unknown"}`,
        createdAt: p.createdAt || new Date().toISOString(),
        likes: typeof p.likes === "number" ? p.likes : 0,
        retweets: typeof p.retweets === "number" ? p.retweets : 0,
        replies: typeof p.replies === "number" ? p.replies : 0,
      }))
      .slice(0, limit);

    return { posts };
  } catch (error) {
    console.error("[X] Search failed:", error);
    return {
      posts: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Scan X/Twitter for new posts matching monitor keywords
export const monitorX = inngest.createFunction(
  {
    id: "monitor-x",
    name: "Monitor X (Twitter)",
    retries: 3,
    timeouts: { finish: "14m" },
    concurrency: { limit: 5 },
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    const xMonitors = await getActiveMonitors("x", step);
    if (xMonitors.length === 0) {
      return { message: "No active X monitors" };
    }

    const planMap = await prefetchPlans(xMonitors, step);

    let totalResults = 0;
    const monitorResults: Record<string, number> = {};

    for (let i = 0; i < xMonitors.length; i++) {
      const monitor = xMonitors[i];

      await applyStagger(i, xMonitors.length, "x", monitor.id, step);
      if (shouldSkipMonitor(monitor, planMap, "x")) continue;

      const newResultIds: string[] = [];

      // Search X/Twitter for keywords
      const searchResult = await step.run(
        `search-x-${monitor.id}`,
        async () => {
          return searchX(monitor.keywords, 50);
        }
      );

      if (searchResult.error) {
        console.warn(
          `[X] Search warning for monitor ${monitor.id}: ${searchResult.error}`
        );
        if (searchResult.posts.length === 0) continue;
      }

      // Filter posts using content matcher
      const matchingPosts = searchResult.posts.filter((post) => {
        const matchResult = contentMatchesMonitor(
          {
            title: post.text.slice(0, 100),
            body: post.text,
            author: post.authorUsername,
          },
          {
            companyName: monitor.companyName,
            keywords: monitor.keywords,
            searchQuery: monitor.searchQuery,
          }
        );
        return matchResult.matches;
      });

      // Save matching posts as results
      if (matchingPosts.length > 0) {
        const { count, ids } = await saveNewResults({
          items: matchingPosts,
          monitorId: monitor.id,
          userId: monitor.userId,
          getSourceUrl: (post) =>
            post.url || `https://x.com/${post.authorUsername}`,
          mapToResult: (post) => ({
            monitorId: monitor.id,
            platform: "x" as const,
            sourceUrl:
              post.url || `https://x.com/${post.authorUsername}`,
            title: post.text.slice(0, 200),
            content: post.text,
            author: post.authorUsername,
            postedAt: post.createdAt
              ? new Date(post.createdAt)
              : new Date(),
            metadata: {
              authorDisplayName: post.author,
              likes: post.likes,
              retweets: post.retweets,
              replies: post.replies,
            },
          }),
          step,
          stepSuffix: "x",
        });

        totalResults += count;
        monitorResults[monitor.id] =
          (monitorResults[monitor.id] || 0) + count;
        newResultIds.push(...ids);
      }

      // Trigger AI analysis
      await triggerAiAnalysis(
        newResultIds,
        monitor.id,
        monitor.userId,
        "x",
        step
      );

      monitorResults[monitor.id] = monitorResults[monitor.id] || 0;
      await updateMonitorStats(
        monitor.id,
        monitorResults[monitor.id],
        step
      );
    }

    return {
      message: `Scanned X/Twitter, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
