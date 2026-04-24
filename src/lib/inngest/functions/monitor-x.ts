import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { logAiCall } from "@/lib/ai/log";
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
  trackScanFailed,
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

    // Calculate date range: search last 14 days for better coverage
    const toDate = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const xaiStartTime = Date.now();
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // grok-4 family required when using server-side tools like x_search
        // (xAI deprecated grok-3-fast for this flow 2026-04-23). grok-4-latest
        // tracks their newest grok-4 release; pin here to a specific version
        // if/when we need stability guarantees.
        model: "grok-4-latest",
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

    const xaiLatencyMs = Date.now() - xaiStartTime;

    // Extract usage data if present (xAI Responses API includes it)
    const xaiUsage = data.usage as {
      input_tokens?: number;
      output_tokens?: number;
      cost_in_usd_ticks?: number;
    } | undefined;

    // xAI reports cost via cost_in_usd_ticks. Empirical calibration 2026-04-23:
    // one grok-4-latest call with x_search tool reported ticks=406,887,500 for
    // a 6028+1682 token call that should have cost ~$0.04 based on grok-4
    // public token pricing ($3/1M input, $15/1M output). That matches a
    // conversion of 1 tick = $1e-7 (10M ticks per dollar). Using this rate
    // explicitly rather than inferring every call.
    const XAI_USD_PER_TICK = 1e-7;
    const costUsd = xaiUsage?.cost_in_usd_ticks
      ? xaiUsage.cost_in_usd_ticks * XAI_USD_PER_TICK
      : 0;

    await logAiCall({
      model: "grok-4-latest",
      promptTokens: xaiUsage?.input_tokens ?? 0,
      completionTokens: xaiUsage?.output_tokens ?? 0,
      costUsd,
      latencyMs: xaiLatencyMs,
      analysisType: "x-search",
      platform: "x",
    });

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
      logger.warn("[X] Failed to parse Grok response as JSON");
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
    logger.error("[X] Search failed", { error: error instanceof Error ? error.message : String(error) });
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
  { cron: "56 */2 * * *" }, // :56 on even hours (staggered)
  async ({ step: _step }) => {
    const step = _step as unknown as MonitorStep;

    // Skip entirely if no monitors exist in the system
    const hasWork = await hasAnyActiveMonitors(step);
    if (!hasWork) return { skipped: true, reason: "no active monitors in system" };

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
      if (shouldSkipMonitor(monitor, planMap, "x")) {
        await updateSkippedMonitor(monitor.id, step);
        continue;
      }

      const newResultIds: string[] = [];

      // Search X/Twitter for keywords
      const searchResult = await step.run(
        `search-x-${monitor.id}`,
        async () => {
          return searchX(monitor.keywords, 50);
        }
      );

      if (searchResult.error) {
        logger.warn("[X] Search warning", { monitorId: monitor.id, error: searchResult.error });
        if (searchResult.posts.length === 0) {
          // Surface the failure so ops can see it in lastCheckFailedReason.
          // Known error: "Your newly created team doesn't have any credits
          // or licenses yet" — means the xAI team needs credits added at
          // https://console.x.ai/. Silently continuing (old behavior) made
          // this class of account-level failure invisible.
          trackScanFailed({
            userId: monitor.userId,
            monitorId: monitor.id,
            platform: "x",
            error: new Error(`xAI: ${searchResult.error}`),
          });
          continue;
        }
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
        step,
        { userId: monitor.userId, platform: "x" }
      );
    }

    return {
      message: `Scanned X/Twitter, found ${totalResults} new matching posts`,
      totalResults,
      monitorResults,
    };
  }
);
