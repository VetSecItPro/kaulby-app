/**
 * Kaulby AI Tool Definitions and Executors
 *
 * Provides 25 tools for the AI assistant to read data, perform actions,
 * and analyze the user's monitoring data via OpenAI-compatible function calling.
 */
import type OpenAI from "openai";
import { db, results, monitors, audiences, audienceMonitors, alerts } from "@/lib/db";
import { eq, and, desc, gte, inArray, count, sql, asc } from "drizzle-orm";
import { getUserPlan, canCreateMonitor, checkKeywordsLimit, filterAllowedPlatforms, canTriggerManualScan } from "@/lib/limits";
import { getPlanLimits, type Platform } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { inngest } from "@/lib/inngest/client";

// ---------------------------------------------------------------------------
// Tool metadata — controls UI labels and confirmation requirements
// ---------------------------------------------------------------------------

export interface ToolMeta {
  category: "read" | "safe_write" | "dangerous_write";
  label: string;
  confirmationMessage?: string;
}

export const TOOL_METADATA: Record<string, ToolMeta> = {
  // Read tools
  list_monitors:          { category: "read", label: "Loading your monitors…" },
  get_monitor:            { category: "read", label: "Fetching monitor details…" },
  search_results:         { category: "read", label: "Searching results…" },
  get_result_details:     { category: "read", label: "Loading result…" },
  get_insights_summary:   { category: "read", label: "Generating insights…" },
  get_saved_results:      { category: "read", label: "Loading bookmarks…" },
  list_audiences:         { category: "read", label: "Loading audiences…" },
  get_aggregations:       { category: "read", label: "Aggregating data…" },
  get_subscription_info:  { category: "read", label: "Checking your plan…" },
  get_alerts:             { category: "read", label: "Loading alert settings…" },
  get_recent_activity:    { category: "read", label: "Loading recent results…" },
  // Analysis tools (read-only)
  analyze_sentiment_trends: { category: "read", label: "Analyzing sentiment trends…" },
  find_leads:               { category: "read", label: "Finding high-intent leads…" },
  compare_monitors:         { category: "read", label: "Comparing monitors…" },
  // Safe writes
  save_result:     { category: "safe_write", label: "Bookmarking result…" },
  unsave_result:   { category: "safe_write", label: "Removing bookmark…" },
  hide_result:     { category: "safe_write", label: "Hiding result…" },
  unhide_result:   { category: "safe_write", label: "Unhiding result…" },
  mark_viewed:     { category: "safe_write", label: "Marking as viewed…" },
  // Action writes — user asked for it, just do it
  create_monitor:  { category: "safe_write", label: "Creating monitor…" },
  update_monitor:  { category: "safe_write", label: "Updating monitor…" },
  pause_monitor:   { category: "safe_write", label: "Pausing monitor…" },
  resume_monitor: {
    category: "safe_write",
    label: "Resuming monitor…",
  },
  trigger_scan: {
    category: "safe_write",
    label: "Triggering scan…",
  },
  delete_monitor: {
    category: "dangerous_write",
    label: "Deleting monitor…",
    confirmationMessage: "This will permanently delete the monitor and ALL its results. This cannot be undone. Are you sure?",
  },
};

// ---------------------------------------------------------------------------
// OpenAI-compatible tool definitions
// ---------------------------------------------------------------------------

const platformValues = [
  "reddit", "hackernews", "producthunt", "devto", "googlereviews",
  "trustpilot", "appstore", "playstore", "quora", "youtube",
  "g2", "yelp", "amazonreviews", "indiehackers", "github", "hashnode", "x",
] as const;

const sentimentValues = ["positive", "negative", "neutral"] as const;
const categoryValues = ["pain_point", "solution_request", "advice_request", "money_talk", "hot_discussion"] as const;

export const AI_TOOLS: OpenAI.ChatCompletionTool[] = [
  // ── Read tools ──────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_monitors",
      description: "List all of the user's monitors with their stats (name, keywords, platforms, active status, result count, last checked).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monitor",
      description: "Get detailed information about a specific monitor by ID.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "The monitor UUID" },
        },
        required: ["monitor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_results",
      description: "Search the user's monitoring results with flexible filters. Use this to answer questions about what people are saying, find specific discussions, or filter by sentiment/platform/category.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search query to match against titles and summaries" },
          monitor_id: { type: "string", description: "Filter to a specific monitor" },
          platform: { type: "string", enum: [...platformValues], description: "Filter by platform" },
          sentiment: { type: "string", enum: [...sentimentValues], description: "Filter by sentiment" },
          category: { type: "string", enum: [...categoryValues], description: "Filter by conversation category" },
          date_range: { type: "string", enum: ["today", "7d", "30d", "90d"], description: "Time range filter" },
          lead_score_min: { type: "number", description: "Minimum lead score (0-100)" },
          limit: { type: "number", description: "Max results to return (default 15, max 30)" },
          sort: { type: "string", enum: ["recent", "engagement", "lead_score"], description: "Sort order (default: recent)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_result_details",
      description: "Get full details of a specific result including full content, AI analysis, and metadata.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID" },
        },
        required: ["result_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_insights_summary",
      description: "Get a statistical summary of the user's monitoring data: total results, sentiment breakdown, top platforms, top categories, and recent trends.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "Optionally scope to a specific monitor" },
          date_range: { type: "string", enum: ["7d", "30d", "90d"], description: "Time range (default: 30d)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_saved_results",
      description: "Get results that the user has bookmarked/saved.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_audiences",
      description: "List the user's audiences (groups of monitors organized by topic/project).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_aggregations",
      description: "Get aggregated counts: results by platform, by sentiment, by category, by day. Useful for charts and trend analysis.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "Optionally scope to a monitor" },
          date_range: { type: "string", enum: ["7d", "30d", "90d"], description: "Time range (default: 30d)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_subscription_info",
      description: "Get the user's current subscription plan, limits, and feature access.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_alerts",
      description: "Get all alert/notification settings for the user's monitors.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "Optionally filter to a specific monitor" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_activity",
      description: "Get the most recent results across all monitors, ordered by creation date.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
  },
  // ── Analysis tools ──────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "analyze_sentiment_trends",
      description: "Analyze how sentiment has changed over time. Returns daily sentiment counts for trend analysis.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "Optionally scope to a monitor" },
          date_range: { type: "string", enum: ["7d", "30d", "90d"], description: "Time range (default: 30d)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_leads",
      description: "Find high-intent leads — posts where people are actively looking for solutions, asking for recommendations, or expressing buying intent.",
      parameters: {
        type: "object",
        properties: {
          min_score: { type: "number", description: "Minimum lead score (default: 50)" },
          monitor_id: { type: "string", description: "Optionally scope to a monitor" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_monitors",
      description: "Compare metrics across two or more monitors: result counts, sentiment distribution, top platforms, and engagement.",
      parameters: {
        type: "object",
        properties: {
          monitor_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of monitor IDs to compare (2-5)",
          },
          date_range: { type: "string", enum: ["7d", "30d", "90d"], description: "Time range (default: 30d)" },
        },
        required: ["monitor_ids"],
      },
    },
  },
  // ── Safe write tools ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "save_result",
      description: "Bookmark/save a result for later reference.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID to bookmark" },
        },
        required: ["result_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unsave_result",
      description: "Remove a bookmark from a result.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID to un-bookmark" },
        },
        required: ["result_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hide_result",
      description: "Hide a result so it no longer appears in the dashboard.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID to hide" },
        },
        required: ["result_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unhide_result",
      description: "Unhide a previously hidden result.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID to unhide" },
        },
        required: ["result_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_viewed",
      description: "Mark a result as viewed/read.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID to mark viewed" },
        },
        required: ["result_id"],
      },
    },
  },
  // ── Dangerous write tools ───────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_monitor",
      description: "Create a new monitoring keyword tracker. You MUST generate smart keywords yourself based on your knowledge of the company/product — never ask the user what keywords to use. Generate 8-12 diverse keywords covering: brand name, '[brand] alternative', '[brand] vs', common complaints, key features, competitor comparisons, and migration discussions. Pick platforms intelligently based on company type (SaaS→Reddit/HN/G2/X, Consumer→Reddit/AppStore/X, etc.).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Display name for the monitor (e.g., 'Stripe Monitoring')" },
          company_name: { type: "string", description: "The brand/company/product name to track" },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "8-12 smart keywords YOU generate based on your knowledge of the company. Include: brand name, '[brand] alternative', '[brand] vs [competitor]', '[brand] pricing', common pain points, key product features, industry terms.",
          },
          platforms: {
            type: "array",
            items: { type: "string", enum: [...platformValues] },
            description: "Platforms to scan — pick intelligently based on company type. SaaS/Tech: reddit, hackernews, g2, producthunt, github, x, trustpilot. Consumer apps: reddit, appstore, playstore, x, youtube. Local business: googlereviews, yelp, reddit.",
          },
          search_query: { type: "string", description: "Optional advanced boolean search query" },
        },
        required: ["name", "company_name", "keywords", "platforms"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_monitor",
      description: "Update an existing monitor's settings. When adding keywords, be additive — merge new keywords with existing ones unless the user explicitly wants to replace them. When the user says 'add competitor tracking' — generate relevant competitor keywords yourself.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "The monitor UUID to update" },
          name: { type: "string", description: "New display name" },
          company_name: { type: "string", description: "New company name" },
          keywords: { type: "array", items: { type: "string" }, description: "New keywords list" },
          platforms: { type: "array", items: { type: "string", enum: [...platformValues] }, description: "New platforms list" },
          search_query: { type: "string", description: "New search query (null to clear)" },
        },
        required: ["monitor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pause_monitor",
      description: "Pause a monitor so it stops scanning temporarily.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "The monitor UUID to pause" },
        },
        required: ["monitor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resume_monitor",
      description: "Resume a paused monitor so it starts scanning again.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "The monitor UUID to resume" },
        },
        required: ["monitor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_scan",
      description: "Trigger an immediate on-demand scan for a monitor instead of waiting for the next scheduled scan.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "The monitor UUID to scan" },
        },
        required: ["monitor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_monitor",
      description: "Permanently delete a monitor and ALL its results. This action cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "The monitor UUID to delete" },
        },
        required: ["monitor_id"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool result type
// ---------------------------------------------------------------------------

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helper — resolve date range to Date
// ---------------------------------------------------------------------------

function dateFromRange(range?: string): Date {
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Helper — verify monitor ownership
// ---------------------------------------------------------------------------

async function verifyMonitorOwnership(userId: string, monitorId: string) {
  const monitor = await db.query.monitors.findFirst({
    where: and(eq(monitors.id, monitorId), eq(monitors.userId, userId)),
  });
  return monitor;
}

// ---------------------------------------------------------------------------
// Helper — get user's monitor IDs
// ---------------------------------------------------------------------------

async function getUserMonitorIds(userId: string): Promise<string[]> {
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true },
  });
  return userMonitors.map((m) => m.id);
}

// ---------------------------------------------------------------------------
// Helper — verify result ownership (via monitor)
// ---------------------------------------------------------------------------

async function verifyResultOwnership(userId: string, resultId: string) {
  const monitorIds = await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return null;
  const result = await db.query.results.findFirst({
    where: and(eq(results.id, resultId), inArray(results.monitorId, monitorIds)),
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "list_monitors":
        return await execListMonitors(userId);
      case "get_monitor":
        return await execGetMonitor(userId, params.monitor_id as string);
      case "search_results":
        return await execSearchResults(userId, params);
      case "get_result_details":
        return await execGetResultDetails(userId, params.result_id as string);
      case "get_insights_summary":
        return await execGetInsightsSummary(userId, params);
      case "get_saved_results":
        return await execGetSavedResults(userId, params);
      case "list_audiences":
        return await execListAudiences(userId);
      case "get_aggregations":
        return await execGetAggregations(userId, params);
      case "get_subscription_info":
        return await execGetSubscriptionInfo(userId);
      case "get_alerts":
        return await execGetAlerts(userId, params);
      case "get_recent_activity":
        return await execGetRecentActivity(userId, params);
      case "analyze_sentiment_trends":
        return await execAnalyzeSentimentTrends(userId, params);
      case "find_leads":
        return await execFindLeads(userId, params);
      case "compare_monitors":
        return await execCompareMonitors(userId, params);
      case "save_result":
        return await execToggleResult(userId, params.result_id as string, "isSaved", true);
      case "unsave_result":
        return await execToggleResult(userId, params.result_id as string, "isSaved", false);
      case "hide_result":
        return await execToggleResult(userId, params.result_id as string, "isHidden", true);
      case "unhide_result":
        return await execToggleResult(userId, params.result_id as string, "isHidden", false);
      case "mark_viewed":
        return await execMarkViewed(userId, params.result_id as string);
      case "create_monitor":
        return await execCreateMonitor(userId, params);
      case "update_monitor":
        return await execUpdateMonitor(userId, params);
      case "pause_monitor":
        return await execSetMonitorActive(userId, params.monitor_id as string, false);
      case "resume_monitor":
        return await execSetMonitorActive(userId, params.monitor_id as string, true);
      case "trigger_scan":
        return await execTriggerScan(userId, params.monitor_id as string);
      case "delete_monitor":
        return await execDeleteMonitor(userId, params.monitor_id as string);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    logger.error(`[AI Tool] ${toolName} failed`, { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: "Tool execution failed. Please try again." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// READ TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execListMonitors(userId: string): Promise<ToolResult> {
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    orderBy: [desc(monitors.createdAt)],
    columns: {
      id: true, name: true, companyName: true, keywords: true,
      platforms: true, isActive: true, newMatchCount: true,
      lastCheckedAt: true, monitorType: true, createdAt: true,
    },
  });

  return {
    success: true,
    data: userMonitors.map((m) => ({
      id: m.id,
      name: m.name,
      companyName: m.companyName,
      keywords: m.keywords,
      platforms: m.platforms,
      isActive: m.isActive,
      newMatchCount: m.newMatchCount,
      lastCheckedAt: m.lastCheckedAt?.toISOString() ?? null,
      type: m.monitorType,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

async function execGetMonitor(userId: string, monitorId: string): Promise<ToolResult> {
  const monitor = await verifyMonitorOwnership(userId, monitorId);
  if (!monitor) return { success: false, error: "Monitor not found or access denied." };

  return {
    success: true,
    data: {
      id: monitor.id,
      name: monitor.name,
      companyName: monitor.companyName,
      keywords: monitor.keywords,
      platforms: monitor.platforms,
      isActive: monitor.isActive,
      monitorType: monitor.monitorType,
      searchQuery: monitor.searchQuery,
      newMatchCount: monitor.newMatchCount,
      lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
      isScanning: monitor.isScanning,
      scheduleEnabled: monitor.scheduleEnabled,
      crisisThresholds: monitor.crisisThresholds,
      createdAt: monitor.createdAt.toISOString(),
    },
  };
}

async function execSearchResults(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: { results: [], total: 0 } };

  const limit = Math.min(Number(params.limit) || 15, 30);
  const since = dateFromRange(params.date_range as string | undefined);

  // Build conditions
  const conditions = [
    params.monitor_id
      ? eq(results.monitorId, params.monitor_id as string)
      : inArray(results.monitorId, monitorIds),
    gte(results.createdAt, since),
    eq(results.isHidden, false),
  ];

  if (params.platform) conditions.push(eq(results.platform, params.platform as typeof results.platform.enumValues[number]));
  if (params.sentiment) conditions.push(eq(results.sentiment, params.sentiment as typeof results.sentiment.enumValues[number]));
  if (params.category) conditions.push(eq(results.conversationCategory, params.category as typeof results.conversationCategory.enumValues[number]));
  if (params.lead_score_min) conditions.push(gte(results.leadScore, Number(params.lead_score_min)));

  // Sort
  const sortCol = params.sort === "engagement" ? desc(results.engagementScore)
    : params.sort === "lead_score" ? desc(results.leadScore)
    : desc(results.createdAt);

  const rows = await db.query.results.findMany({
    where: and(...conditions),
    orderBy: [sortCol],
    limit,
    columns: {
      id: true, title: true, platform: true, sourceUrl: true,
      sentiment: true, conversationCategory: true, aiSummary: true,
      engagementScore: true, leadScore: true, postedAt: true,
      monitorId: true, author: true, isSaved: true, createdAt: true,
    },
  });

  // Attach monitor names
  const monitorMap = new Map<string, string>();
  const monitorRows = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true, name: true, companyName: true },
  });
  monitorRows.forEach((m) => monitorMap.set(m.id, m.companyName || m.name));

  // If query param exists, filter by text match (simple)
  let filtered = rows;
  if (params.query && typeof params.query === "string") {
    const q = (params.query as string).toLowerCase();
    filtered = rows.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      (r.aiSummary && r.aiSummary.toLowerCase().includes(q))
    );
  }

  return {
    success: true,
    data: {
      results: filtered.map((r, i) => ({
        index: i + 1,
        id: r.id,
        title: r.title,
        platform: r.platform,
        sourceUrl: r.sourceUrl,
        sentiment: r.sentiment,
        category: r.conversationCategory,
        summary: r.aiSummary?.slice(0, 200) ?? null,
        engagementScore: r.engagementScore,
        leadScore: r.leadScore,
        author: r.author,
        isSaved: r.isSaved,
        monitorName: monitorMap.get(r.monitorId) ?? "Unknown",
        postedAt: r.postedAt?.toISOString() ?? null,
      })),
      total: filtered.length,
    },
  };
}

async function execGetResultDetails(userId: string, resultId: string): Promise<ToolResult> {
  const result = await verifyResultOwnership(userId, resultId);
  if (!result) return { success: false, error: "Result not found or access denied." };

  return {
    success: true,
    data: {
      id: result.id,
      title: result.title,
      content: result.content?.slice(0, 2000) ?? null,
      platform: result.platform,
      sourceUrl: result.sourceUrl,
      author: result.author,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      painPointCategory: result.painPointCategory,
      conversationCategory: result.conversationCategory,
      engagementScore: result.engagementScore,
      leadScore: result.leadScore,
      leadScoreFactors: result.leadScoreFactors,
      aiSummary: result.aiSummary,
      aiAnalysis: result.aiAnalysis,
      isSaved: result.isSaved,
      isViewed: result.isViewed,
      postedAt: result.postedAt?.toISOString() ?? null,
      createdAt: result.createdAt.toISOString(),
    },
  };
}

async function execGetInsightsSummary(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = params.monitor_id
    ? [params.monitor_id as string]
    : await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: { message: "No monitors found." } };

  const since = dateFromRange(params.date_range as string | undefined);

  const [totalCount] = await db
    .select({ count: count() })
    .from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, since), eq(results.isHidden, false)));

  const sentimentCounts = await db
    .select({ sentiment: results.sentiment, count: count() })
    .from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, since), eq(results.isHidden, false)))
    .groupBy(results.sentiment);

  const platformCounts = await db
    .select({ platform: results.platform, count: count() })
    .from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, since), eq(results.isHidden, false)))
    .groupBy(results.platform)
    .orderBy(desc(count()));

  const categoryCounts = await db
    .select({ category: results.conversationCategory, count: count() })
    .from(results)
    .where(and(
      inArray(results.monitorId, monitorIds),
      gte(results.createdAt, since),
      eq(results.isHidden, false),
      sql`${results.conversationCategory} IS NOT NULL`
    ))
    .groupBy(results.conversationCategory)
    .orderBy(desc(count()));

  return {
    success: true,
    data: {
      totalResults: totalCount.count,
      sentimentBreakdown: Object.fromEntries(sentimentCounts.map((s) => [s.sentiment ?? "unknown", s.count])),
      platformBreakdown: Object.fromEntries(platformCounts.map((p) => [p.platform, p.count])),
      categoryBreakdown: Object.fromEntries(categoryCounts.map((c) => [c.category ?? "uncategorized", c.count])),
      dateRange: params.date_range || "30d",
    },
  };
}

async function execGetSavedResults(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: [] };

  const limit = Math.min(Number(params.limit) || 20, 50);

  const rows = await db.query.results.findMany({
    where: and(inArray(results.monitorId, monitorIds), eq(results.isSaved, true)),
    orderBy: [desc(results.createdAt)],
    limit,
    columns: {
      id: true, title: true, platform: true, sourceUrl: true,
      sentiment: true, aiSummary: true, leadScore: true, postedAt: true,
    },
  });

  return { success: true, data: rows.map((r) => ({ ...r, postedAt: r.postedAt?.toISOString() ?? null })) };
}

async function execListAudiences(userId: string): Promise<ToolResult> {
  const userAudiences = await db.query.audiences.findMany({
    where: eq(audiences.userId, userId),
    columns: { id: true, name: true, description: true, color: true, icon: true, createdAt: true },
  });

  // Get monitor count per audience
  const result = await Promise.all(
    userAudiences.map(async (a) => {
      const [monitorCount] = await db
        .select({ count: count() })
        .from(audienceMonitors)
        .where(eq(audienceMonitors.audienceId, a.id));
      return { ...a, monitorCount: monitorCount.count, createdAt: a.createdAt.toISOString() };
    })
  );

  return { success: true, data: result };
}

async function execGetAggregations(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = params.monitor_id
    ? [params.monitor_id as string]
    : await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: { message: "No monitors found." } };

  const since = dateFromRange(params.date_range as string | undefined);

  // Results per day
  const dailyCounts = await db
    .select({
      day: sql<string>`DATE(${results.createdAt})`,
      count: count(),
    })
    .from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, since), eq(results.isHidden, false)))
    .groupBy(sql`DATE(${results.createdAt})`)
    .orderBy(asc(sql`DATE(${results.createdAt})`));

  // Avg engagement & lead score
  const [avgScores] = await db
    .select({
      avgEngagement: sql<number>`COALESCE(AVG(${results.engagementScore}), 0)`,
      avgLeadScore: sql<number>`COALESCE(AVG(${results.leadScore}), 0)`,
    })
    .from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, since), eq(results.isHidden, false)));

  return {
    success: true,
    data: {
      dailyVolume: dailyCounts.map((d) => ({ date: d.day, count: d.count })),
      averageEngagementScore: Math.round(avgScores.avgEngagement),
      averageLeadScore: Math.round(avgScores.avgLeadScore),
    },
  };
}

async function execGetSubscriptionInfo(userId: string): Promise<ToolResult> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  const [monitorCount] = await db
    .select({ count: count() })
    .from(monitors)
    .where(eq(monitors.userId, userId));

  return {
    success: true,
    data: {
      plan,
      monitorsUsed: monitorCount.count,
      monitorsLimit: limits.monitors,
      keywordsPerMonitor: limits.keywordsPerMonitor,
      platforms: limits.platforms,
      refreshDelayHours: limits.refreshDelayHours,
      aiFeatures: limits.aiFeatures,
      alerts: limits.alerts,
      exports: limits.exports,
    },
  };
}

async function execGetAlerts(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = params.monitor_id
    ? [params.monitor_id as string]
    : await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: [] };

  const rows = await db.query.alerts.findMany({
    where: inArray(alerts.monitorId, monitorIds),
    columns: { id: true, monitorId: true, channel: true, frequency: true, destination: true, isActive: true },
  });

  return { success: true, data: rows };
}

async function execGetRecentActivity(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: [] };

  const limit = Math.min(Number(params.limit) || 10, 30);

  const monitorMap = new Map<string, string>();
  const monitorRows = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true, name: true, companyName: true },
  });
  monitorRows.forEach((m) => monitorMap.set(m.id, m.companyName || m.name));

  const rows = await db.query.results.findMany({
    where: and(inArray(results.monitorId, monitorIds), eq(results.isHidden, false)),
    orderBy: [desc(results.createdAt)],
    limit,
    columns: {
      id: true, title: true, platform: true, sourceUrl: true,
      sentiment: true, aiSummary: true, leadScore: true,
      monitorId: true, createdAt: true,
    },
  });

  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      platform: r.platform,
      sourceUrl: r.sourceUrl,
      sentiment: r.sentiment,
      summary: r.aiSummary?.slice(0, 150) ?? null,
      leadScore: r.leadScore,
      monitorName: monitorMap.get(r.monitorId) ?? "Unknown",
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execAnalyzeSentimentTrends(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = params.monitor_id
    ? [params.monitor_id as string]
    : await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: { message: "No monitors found." } };

  const since = dateFromRange(params.date_range as string | undefined);

  const dailySentiment = await db
    .select({
      day: sql<string>`DATE(${results.createdAt})`,
      sentiment: results.sentiment,
      count: count(),
    })
    .from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, since), eq(results.isHidden, false)))
    .groupBy(sql`DATE(${results.createdAt})`, results.sentiment)
    .orderBy(asc(sql`DATE(${results.createdAt})`));

  // Pivot into { date, positive, negative, neutral }
  const dayMap = new Map<string, { date: string; positive: number; negative: number; neutral: number }>();
  for (const row of dailySentiment) {
    const entry = dayMap.get(row.day) ?? { date: row.day, positive: 0, negative: 0, neutral: 0 };
    if (row.sentiment === "positive") entry.positive = row.count;
    else if (row.sentiment === "negative") entry.negative = row.count;
    else entry.neutral = row.count;
    dayMap.set(row.day, entry);
  }

  return { success: true, data: { trends: Array.from(dayMap.values()) } };
}

async function execFindLeads(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorIds = params.monitor_id
    ? [params.monitor_id as string]
    : await getUserMonitorIds(userId);
  if (monitorIds.length === 0) return { success: true, data: [] };

  const minScore = Number(params.min_score) || 50;
  const limit = Math.min(Number(params.limit) || 10, 30);

  const monitorMap = new Map<string, string>();
  const monitorRows = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true, name: true, companyName: true },
  });
  monitorRows.forEach((m) => monitorMap.set(m.id, m.companyName || m.name));

  const rows = await db.query.results.findMany({
    where: and(
      inArray(results.monitorId, monitorIds),
      gte(results.leadScore, minScore),
      eq(results.isHidden, false),
    ),
    orderBy: [desc(results.leadScore), desc(results.createdAt)],
    limit,
    columns: {
      id: true, title: true, platform: true, sourceUrl: true,
      sentiment: true, conversationCategory: true, aiSummary: true,
      leadScore: true, leadScoreFactors: true, author: true,
      monitorId: true, postedAt: true,
    },
  });

  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      platform: r.platform,
      sourceUrl: r.sourceUrl,
      leadScore: r.leadScore,
      leadScoreFactors: r.leadScoreFactors,
      category: r.conversationCategory,
      summary: r.aiSummary?.slice(0, 200) ?? null,
      author: r.author,
      monitorName: monitorMap.get(r.monitorId) ?? "Unknown",
      postedAt: r.postedAt?.toISOString() ?? null,
    })),
  };
}

async function execCompareMonitors(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const requestedIds = (params.monitor_ids as string[]) || [];
  if (requestedIds.length < 2) return { success: false, error: "Need at least 2 monitor IDs to compare." };

  const since = dateFromRange(params.date_range as string | undefined);

  const comparison = await Promise.all(
    requestedIds.slice(0, 5).map(async (monitorId) => {
      const monitor = await verifyMonitorOwnership(userId, monitorId);
      if (!monitor) return { monitorId, error: "Not found or access denied" };

      const [total] = await db.select({ count: count() }).from(results)
        .where(and(eq(results.monitorId, monitorId), gte(results.createdAt, since), eq(results.isHidden, false)));

      const sentiments = await db
        .select({ sentiment: results.sentiment, count: count() })
        .from(results)
        .where(and(eq(results.monitorId, monitorId), gte(results.createdAt, since), eq(results.isHidden, false)))
        .groupBy(results.sentiment);

      const [avgScores] = await db
        .select({
          avgEngagement: sql<number>`COALESCE(AVG(${results.engagementScore}), 0)`,
          avgLeadScore: sql<number>`COALESCE(AVG(${results.leadScore}), 0)`,
        })
        .from(results)
        .where(and(eq(results.monitorId, monitorId), gte(results.createdAt, since), eq(results.isHidden, false)));

      return {
        monitorId,
        name: monitor.companyName || monitor.name,
        totalResults: total.count,
        sentimentBreakdown: Object.fromEntries(sentiments.map((s) => [s.sentiment ?? "unknown", s.count])),
        avgEngagement: Math.round(avgScores.avgEngagement),
        avgLeadScore: Math.round(avgScores.avgLeadScore),
      };
    })
  );

  return { success: true, data: comparison };
}

// ═══════════════════════════════════════════════════════════════════════════
// WRITE TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execToggleResult(
  userId: string,
  resultId: string,
  field: "isSaved" | "isHidden",
  value: boolean
): Promise<ToolResult> {
  const result = await verifyResultOwnership(userId, resultId);
  if (!result) return { success: false, error: "Result not found or access denied." };

  await db.update(results).set({ [field]: value }).where(eq(results.id, resultId));
  return { success: true, data: { resultId, [field]: value } };
}

async function execMarkViewed(userId: string, resultId: string): Promise<ToolResult> {
  const result = await verifyResultOwnership(userId, resultId);
  if (!result) return { success: false, error: "Result not found or access denied." };

  await db.update(results).set({ isViewed: true, viewedAt: new Date() }).where(eq(results.id, resultId));
  return { success: true, data: { resultId, isViewed: true } };
}

async function execCreateMonitor(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const plan = await getUserPlan(userId);

  // Check limits
  const canCreate = await canCreateMonitor(userId);
  if (!canCreate.allowed) return { success: false, error: canCreate.message };

  const keywords = (params.keywords as string[]) || [];
  const keywordCheck = checkKeywordsLimit(keywords, plan);
  if (!keywordCheck.allowed) return { success: false, error: keywordCheck.message };

  // Filter platforms to allowed ones
  const requestedPlatforms = (params.platforms as string[]) || ["reddit"];
  const allowedPlatforms = await filterAllowedPlatforms(userId, requestedPlatforms as Platform[]);

  const [newMonitor] = await db.insert(monitors).values({
    userId,
    name: (params.name as string).slice(0, 100),
    companyName: (params.company_name as string).slice(0, 100),
    keywords: keywords.slice(0, 20).map((k) => String(k).slice(0, 100)),
    platforms: allowedPlatforms as [Platform, ...Platform[]],
    searchQuery: params.search_query ? String(params.search_query).slice(0, 500) : null,
    isActive: true,
  }).returning({ id: monitors.id, name: monitors.name });

  return {
    success: true,
    data: {
      id: newMonitor.id,
      name: newMonitor.name,
      message: `Monitor "${newMonitor.name}" created. It will start scanning on the next cycle.`,
    },
  };
}

async function execUpdateMonitor(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const monitorId = params.monitor_id as string;
  const monitor = await verifyMonitorOwnership(userId, monitorId);
  if (!monitor) return { success: false, error: "Monitor not found or access denied." };

  const plan = await getUserPlan(userId);

  // Build update object
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (params.name) updates.name = String(params.name).slice(0, 100);
  if (params.company_name) updates.companyName = String(params.company_name).slice(0, 100);
  if (params.keywords) {
    const keywords = params.keywords as string[];
    const keywordCheck = checkKeywordsLimit(keywords, plan);
    if (!keywordCheck.allowed) return { success: false, error: keywordCheck.message };
    updates.keywords = keywords.slice(0, 20).map((k) => String(k).slice(0, 100));
  }
  if (params.platforms) {
    const allowedPlatforms = await filterAllowedPlatforms(userId, params.platforms as Platform[]);
    updates.platforms = allowedPlatforms;
  }
  if (params.search_query !== undefined) {
    updates.searchQuery = params.search_query ? String(params.search_query).slice(0, 500) : null;
  }

  await db.update(monitors).set(updates).where(eq(monitors.id, monitorId));
  return { success: true, data: { monitorId, updated: Object.keys(updates).filter((k) => k !== "updatedAt") } };
}

async function execSetMonitorActive(userId: string, monitorId: string, isActive: boolean): Promise<ToolResult> {
  const monitor = await verifyMonitorOwnership(userId, monitorId);
  if (!monitor) return { success: false, error: "Monitor not found or access denied." };

  await db.update(monitors).set({ isActive, updatedAt: new Date() }).where(eq(monitors.id, monitorId));
  return {
    success: true,
    data: { monitorId, isActive, message: isActive ? "Monitor resumed." : "Monitor paused." },
  };
}

async function execTriggerScan(userId: string, monitorId: string): Promise<ToolResult> {
  const monitor = await verifyMonitorOwnership(userId, monitorId);
  if (!monitor) return { success: false, error: "Monitor not found or access denied." };

  const canScan = await canTriggerManualScan(userId, monitor.lastManualScanAt);
  if (!canScan.canScan) return { success: false, error: canScan.reason };

  // Mark as scanning
  await db.update(monitors).set({
    isScanning: true,
    lastManualScanAt: new Date(),
  }).where(eq(monitors.id, monitorId));

  // Send Inngest event to trigger scan
  await inngest.send({
    name: "monitor/scan-now",
    data: { monitorId, userId },
  });

  return {
    success: true,
    data: { monitorId, message: "Scan triggered. Results will appear in a few minutes." },
  };
}

async function execDeleteMonitor(userId: string, monitorId: string): Promise<ToolResult> {
  const monitor = await verifyMonitorOwnership(userId, monitorId);
  if (!monitor) return { success: false, error: "Monitor not found or access denied." };

  await db.delete(monitors).where(eq(monitors.id, monitorId));
  return {
    success: true,
    data: { monitorId, name: monitor.name, message: `Monitor "${monitor.name}" and all its results have been permanently deleted.` },
  };
}
