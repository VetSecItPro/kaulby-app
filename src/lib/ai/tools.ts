/**
 * Kaulby AI Tool Definitions and Executors
 *
 * Provides 47 tools for the AI assistant to read data, perform actions,
 * and analyze the user's monitoring data via OpenAI-compatible function calling.
 */
import type OpenAI from "openai";
import {
  db, results, monitors, audiences, audienceMonitors, alerts,
  bookmarks, bookmarkCollections, savedSearches, webhooks,
  notifications, sharedReports, users,
} from "@/lib/db";
import { eq, and, desc, gte, inArray, count, sql, asc, isNull } from "drizzle-orm";
import { getUserPlan, canCreateMonitor, checkKeywordsLimit, filterAllowedPlatforms, canTriggerManualScan } from "@/lib/limits";
import { getPlanLimits, type Platform } from "@/lib/plans";
import { logger } from "@/lib/logger";
import { inngest } from "@/lib/inngest/client";
import { getResultAnalysis } from "@/lib/result-analysis-reader";

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
  duplicate_monitor: { category: "safe_write", label: "Duplicating monitor…" },
  delete_monitor: {
    category: "dangerous_write",
    label: "Deleting monitor…",
    confirmationMessage: "This will permanently delete the monitor and ALL its results. This cannot be undone. Are you sure?",
  },
  // Audience tools
  create_audience:              { category: "safe_write", label: "Creating audience…" },
  update_audience:              { category: "safe_write", label: "Updating audience…" },
  delete_audience:              { category: "dangerous_write", label: "Deleting audience…", confirmationMessage: "This will permanently delete this audience group. Monitors within it will NOT be deleted. Continue?" },
  add_monitor_to_audience:      { category: "safe_write", label: "Adding monitor to audience…" },
  remove_monitor_from_audience: { category: "safe_write", label: "Removing monitor from audience…" },
  // Bookmark tools
  create_bookmark:              { category: "safe_write", label: "Bookmarking result…" },
  list_bookmark_collections:    { category: "read", label: "Loading collections…" },
  create_bookmark_collection:   { category: "safe_write", label: "Creating collection…" },
  // Saved search tools
  list_saved_searches:          { category: "read", label: "Loading saved searches…" },
  create_saved_search:          { category: "safe_write", label: "Saving search…" },
  delete_saved_search:          { category: "safe_write", label: "Deleting saved search…" },
  // Webhook tools (Team tier)
  list_webhooks:                { category: "read", label: "Loading webhooks…" },
  create_webhook:               { category: "safe_write", label: "Creating webhook…" },
  delete_webhook:               { category: "dangerous_write", label: "Deleting webhook…", confirmationMessage: "This will permanently delete this webhook. Continue?" },
  // Notification tools
  get_notifications:            { category: "read", label: "Loading notifications…" },
  mark_notifications_read:      { category: "safe_write", label: "Marking notifications as read…" },
  // Report tools
  create_share_link:            { category: "safe_write", label: "Creating share link…" },
  export_results_csv:           { category: "safe_write", label: "Exporting results…" },
  // Integration tools
  get_integrations_status:      { category: "read", label: "Checking integrations…" },
  // AI tools
  suggest_reply:                { category: "safe_write", label: "Generating reply suggestions…" },
};

// ---------------------------------------------------------------------------
// OpenAI-compatible tool definitions
// ---------------------------------------------------------------------------

const platformValues = [
  "reddit", "hackernews", "producthunt", "devto", "googlereviews",
  "trustpilot", "appstore", "playstore", "youtube",
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
          platform_urls: {
            type: "object",
            description: "URLs for platforms that require them. Keys are platform IDs, values are URLs. Required for: googlereviews (Google Maps URL or Place ID), youtube (video URL), trustpilot (trustpilot.com/review/... URL), appstore (apps.apple.com URL), playstore (play.google.com URL), g2 (g2.com/products/... URL), yelp (yelp.com/biz/... URL), amazonreviews (amazon.com product URL or ASIN).",
            additionalProperties: { type: "string" },
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
          platform_urls: { type: "object", description: "Platform-specific URLs (same format as create_monitor)", additionalProperties: { type: "string" } },
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
      name: "duplicate_monitor",
      description: "Duplicate an existing monitor with all its settings (keywords, platforms, etc). The new monitor starts fresh with no results.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "The monitor UUID to duplicate" },
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
  // ── Audience tools ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_audience",
      description: "Create an audience — a group/folder for organizing monitors by topic, project, or client.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Audience name (e.g., 'Competitor Tracking', 'Client: Acme Corp')" },
          description: { type: "string", description: "Optional description" },
          color: { type: "string", description: "Hex color (e.g., '#3B82F6')" },
          icon: { type: "string", description: "Lucide icon name (e.g., 'target', 'users', 'zap')" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_audience",
      description: "Update an audience's name, description, color, or icon.",
      parameters: {
        type: "object",
        properties: {
          audience_id: { type: "string", description: "The audience UUID" },
          name: { type: "string", description: "New name" },
          description: { type: "string", description: "New description (null to clear)" },
          color: { type: "string", description: "New hex color" },
          icon: { type: "string", description: "New Lucide icon name" },
        },
        required: ["audience_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_audience",
      description: "Delete an audience group. Monitors in the audience will NOT be deleted.",
      parameters: {
        type: "object",
        properties: {
          audience_id: { type: "string", description: "The audience UUID to delete" },
        },
        required: ["audience_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_monitor_to_audience",
      description: "Add a monitor to an audience group.",
      parameters: {
        type: "object",
        properties: {
          audience_id: { type: "string", description: "The audience UUID" },
          monitor_id: { type: "string", description: "The monitor UUID to add" },
        },
        required: ["audience_id", "monitor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_monitor_from_audience",
      description: "Remove a monitor from an audience group.",
      parameters: {
        type: "object",
        properties: {
          audience_id: { type: "string", description: "The audience UUID" },
          monitor_id: { type: "string", description: "The monitor UUID to remove" },
        },
        required: ["audience_id", "monitor_id"],
      },
    },
  },
  // ── Bookmark tools ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_bookmark",
      description: "Bookmark a result with an optional note and collection assignment.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID to bookmark" },
          note: { type: "string", description: "Optional note about the bookmark" },
          collection_id: { type: "string", description: "Optional collection UUID to file it under" },
        },
        required: ["result_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_bookmark_collections",
      description: "List the user's bookmark collections with counts.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_bookmark_collection",
      description: "Create a new bookmark collection for organizing saved results.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Collection name" },
          color: { type: "string", description: "Hex color (e.g., '#10B981')" },
        },
        required: ["name"],
      },
    },
  },
  // ── Saved search tools ────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_saved_searches",
      description: "List the user's saved search queries.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_saved_search",
      description: "Save a search query with filters for quick re-use.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name for the saved search" },
          query: { type: "string", description: "The search query string" },
          filters: {
            type: "object",
            description: "Optional filters: { platforms?, sentiments?, categories?, dateRange? }",
          },
        },
        required: ["name", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_saved_search",
      description: "Delete a saved search.",
      parameters: {
        type: "object",
        properties: {
          search_id: { type: "string", description: "The saved search UUID" },
        },
        required: ["search_id"],
      },
    },
  },
  // ── Webhook tools (Team tier) ─────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_webhooks",
      description: "List the user's webhook configurations. Requires Team plan.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_webhook",
      description: "Create a webhook to receive real-time notifications when new results are found. Requires Team plan. URL must be public HTTPS.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Webhook name" },
          url: { type: "string", description: "HTTPS webhook URL" },
          events: {
            type: "array",
            items: { type: "string" },
            description: "Events to subscribe to (default: ['new_result']). Options: new_result, crisis_alert, daily_digest",
          },
        },
        required: ["name", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_webhook",
      description: "Delete a webhook configuration. Requires Team plan.",
      parameters: {
        type: "object",
        properties: {
          webhook_id: { type: "string", description: "The webhook UUID" },
        },
        required: ["webhook_id"],
      },
    },
  },
  // ── Notification tools ────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_notifications",
      description: "Get the user's unread notifications (alerts, crisis events, system messages).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max notifications (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_notifications_read",
      description: "Mark specific notifications as read.",
      parameters: {
        type: "object",
        properties: {
          notification_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of notification UUIDs to mark as read",
          },
        },
        required: ["notification_ids"],
      },
    },
  },
  // ── Report & export tools ─────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_share_link",
      description: "Create a shareable public link for a monitoring report. Anyone with the link can view the report data.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Report title" },
          monitor_id: { type: "string", description: "Optional: scope report to a specific monitor" },
          period_days: { type: "number", description: "Report period in days (7, 30, or 90). Default: 30" },
          expires_in_days: { type: "number", description: "Optional: link expiry in days (1-365)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_results_csv",
      description: "Export monitoring results as a CSV file. Requires Pro+ plan. Returns a download URL.",
      parameters: {
        type: "object",
        properties: {
          monitor_id: { type: "string", description: "Optional: export results for a specific monitor only" },
        },
        required: [],
      },
    },
  },
  // ── Integration tools ─────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_integrations_status",
      description: "Check which third-party integrations (Slack, Discord, HubSpot, Microsoft Teams) are connected.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  // ── AI tools ──────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "suggest_reply",
      description: "Generate AI-powered reply suggestions for a specific result/post. Useful when the user wants help responding to a discussion. Requires Pro+ plan.",
      parameters: {
        type: "object",
        properties: {
          result_id: { type: "string", description: "The result UUID to generate replies for" },
          product_context: { type: "string", description: "Optional context about the user's product to make the reply more relevant" },
        },
        required: ["result_id"],
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
      case "duplicate_monitor":
        return await execDuplicateMonitor(userId, params.monitor_id as string);
      case "delete_monitor":
        return await execDeleteMonitor(userId, params.monitor_id as string);
      // Audience tools
      case "create_audience":
        return await execCreateAudience(userId, params);
      case "update_audience":
        return await execUpdateAudience(userId, params);
      case "delete_audience":
        return await execDeleteAudience(userId, params.audience_id as string);
      case "add_monitor_to_audience":
        return await execAddMonitorToAudience(userId, params);
      case "remove_monitor_from_audience":
        return await execRemoveMonitorFromAudience(userId, params);
      // Bookmark tools
      case "create_bookmark":
        return await execCreateBookmark(userId, params);
      case "list_bookmark_collections":
        return await execListBookmarkCollections(userId);
      case "create_bookmark_collection":
        return await execCreateBookmarkCollection(userId, params);
      // Saved search tools
      case "list_saved_searches":
        return await execListSavedSearches(userId);
      case "create_saved_search":
        return await execCreateSavedSearch(userId, params);
      case "delete_saved_search":
        return await execDeleteSavedSearch(userId, params.search_id as string);
      // Webhook tools
      case "list_webhooks":
        return await execListWebhooks(userId);
      case "create_webhook":
        return await execCreateWebhook(userId, params);
      case "delete_webhook":
        return await execDeleteWebhook(userId, params.webhook_id as string);
      // Notification tools
      case "get_notifications":
        return await execGetNotifications(userId, params);
      case "mark_notifications_read":
        return await execMarkNotificationsRead(userId, params);
      // Report tools
      case "create_share_link":
        return await execCreateShareLink(userId, params);
      case "export_results_csv":
        return await execExportResultsCsv(userId, params);
      // Integration tools
      case "get_integrations_status":
        return await execGetIntegrationsStatus(userId);
      // AI tools
      case "suggest_reply":
        return await execSuggestReply(userId, params);
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

  // Task DL.2 Phase 1 — route aiAnalysis read through helper so we prefer
  // the extracted `result_analyses` table, falling back to legacy column.
  const aiAnalysis = await getResultAnalysis(result.id);

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
      aiAnalysis,
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

  const whereClause = and(inArray(results.monitorId, monitorIds), gte(results.createdAt, since), eq(results.isHidden, false));

  const [[totalCount], sentimentCounts, platformCounts, categoryCounts] = await Promise.all([
    db
      .select({ count: count() })
      .from(results)
      .where(whereClause),

    db
      .select({ sentiment: results.sentiment, count: count() })
      .from(results)
      .where(whereClause)
      .groupBy(results.sentiment),

    db
      .select({ platform: results.platform, count: count() })
      .from(results)
      .where(whereClause)
      .groupBy(results.platform)
      .orderBy(desc(count())),

    db
      .select({ category: results.conversationCategory, count: count() })
      .from(results)
      .where(and(
        inArray(results.monitorId, monitorIds),
        gte(results.createdAt, since),
        eq(results.isHidden, false),
        sql`${results.conversationCategory} IS NOT NULL`
      ))
      .groupBy(results.conversationCategory)
      .orderBy(desc(count())),
  ]);

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

  // Get monitor count per audience — single GROUP BY query instead of N+1
  const audienceIds = userAudiences.map((a) => a.id);
  const countRows = audienceIds.length > 0
    ? await db
        .select({ audienceId: audienceMonitors.audienceId, count: count() })
        .from(audienceMonitors)
        .where(inArray(audienceMonitors.audienceId, audienceIds))
        .groupBy(audienceMonitors.audienceId)
    : [];
  const countMap = new Map(countRows.map((r) => [r.audienceId, r.count]));
  const result = userAudiences.map((a) => ({
    ...a,
    monitorCount: countMap.get(a.id) ?? 0,
    createdAt: a.createdAt.toISOString(),
  }));

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

  // Sanitize platform URLs if provided
  let sanitizedPlatformUrls: Record<string, string> | null = null;
  if (params.platform_urls && typeof params.platform_urls === "object") {
    const urls = params.platform_urls as Record<string, string>;
    const cleaned: Record<string, string> = {};
    for (const [platform, url] of Object.entries(urls)) {
      const trimmed = String(url).trim();
      if (trimmed && (trimmed.startsWith("https://") || trimmed.startsWith("ChI"))) {
        cleaned[platform] = trimmed.slice(0, 500);
      }
    }
    if (Object.keys(cleaned).length > 0) sanitizedPlatformUrls = cleaned;
  }

  const [newMonitor] = await db.insert(monitors).values({
    userId,
    name: (params.name as string).slice(0, 100),
    companyName: (params.company_name as string).slice(0, 100),
    keywords: keywords.slice(0, 20).map((k) => String(k).slice(0, 100)),
    platforms: allowedPlatforms as [Platform, ...Platform[]],
    platformUrls: sanitizedPlatformUrls,
    searchQuery: params.search_query ? String(params.search_query).slice(0, 500) : null,
    isActive: true,
    isScanning: true,
  }).returning({ id: monitors.id, name: monitors.name });

  // Trigger immediate first scan so the user gets results right away
  await inngest.send({
    name: "monitor/scan-now",
    data: { monitorId: newMonitor.id, userId },
  });

  return {
    success: true,
    data: {
      id: newMonitor.id,
      name: newMonitor.name,
      message: `Monitor "${newMonitor.name}" created and scanning now! Initial results will appear in a few minutes.`,
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
  if (params.platform_urls && typeof params.platform_urls === "object") {
    const urls = params.platform_urls as Record<string, string>;
    const cleaned: Record<string, string> = {};
    for (const [platform, url] of Object.entries(urls)) {
      const trimmed = String(url).trim();
      if (trimmed && (trimmed.startsWith("https://") || trimmed.startsWith("ChI"))) {
        cleaned[platform] = trimmed.slice(0, 500);
      }
    }
    updates.platformUrls = Object.keys(cleaned).length > 0 ? cleaned : null;
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

async function execDuplicateMonitor(userId: string, monitorId: string): Promise<ToolResult> {
  const monitor = await verifyMonitorOwnership(userId, monitorId);
  if (!monitor) return { success: false, error: "Monitor not found or access denied." };

  const canCreate = await canCreateMonitor(userId);
  if (!canCreate.allowed) return { success: false, error: canCreate.message };

  const [newMonitor] = await db.insert(monitors).values({
    userId,
    name: `${monitor.name} (Copy)`,
    companyName: monitor.companyName,
    keywords: monitor.keywords,
    platforms: monitor.platforms,
    searchQuery: monitor.searchQuery,
    monitorType: monitor.monitorType,
    isActive: true,
    isScanning: true,
  }).returning({ id: monitors.id, name: monitors.name });

  // Trigger immediate first scan
  await inngest.send({
    name: "monitor/scan-now",
    data: { monitorId: newMonitor.id, userId },
  });

  return {
    success: true,
    data: { id: newMonitor.id, name: newMonitor.name, message: `Duplicated "${monitor.name}" as "${newMonitor.name}". Scanning now!` },
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

// ═══════════════════════════════════════════════════════════════════════════
// AUDIENCE TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function verifyAudienceOwnership(userId: string, audienceId: string) {
  return db.query.audiences.findFirst({
    where: and(eq(audiences.id, audienceId), eq(audiences.userId, userId)),
  });
}

async function execCreateAudience(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const name = String(params.name || "").slice(0, 100);
  if (!name) return { success: false, error: "Audience name is required." };

  const [audience] = await db.insert(audiences).values({
    userId,
    name,
    description: params.description ? String(params.description).slice(0, 500) : null,
    color: params.color ? String(params.color).slice(0, 7) : null,
    icon: params.icon ? String(params.icon).slice(0, 50) : null,
  }).returning({ id: audiences.id, name: audiences.name });

  return { success: true, data: { id: audience.id, name: audience.name, message: `Audience "${audience.name}" created.` } };
}

async function execUpdateAudience(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const audienceId = params.audience_id as string;
  const audience = await verifyAudienceOwnership(userId, audienceId);
  if (!audience) return { success: false, error: "Audience not found or access denied." };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (params.name) updates.name = String(params.name).slice(0, 100);
  if (params.description !== undefined) updates.description = params.description ? String(params.description).slice(0, 500) : null;
  if (params.color !== undefined) updates.color = params.color ? String(params.color).slice(0, 7) : null;
  if (params.icon !== undefined) updates.icon = params.icon ? String(params.icon).slice(0, 50) : null;

  await db.update(audiences).set(updates).where(eq(audiences.id, audienceId));
  return { success: true, data: { audienceId, updated: Object.keys(updates).filter((k) => k !== "updatedAt") } };
}

async function execDeleteAudience(userId: string, audienceId: string): Promise<ToolResult> {
  const audience = await verifyAudienceOwnership(userId, audienceId);
  if (!audience) return { success: false, error: "Audience not found or access denied." };

  await db.delete(audiences).where(eq(audiences.id, audienceId));
  return { success: true, data: { audienceId, name: audience.name, message: `Audience "${audience.name}" deleted. Monitors were preserved.` } };
}

async function execAddMonitorToAudience(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const audienceId = params.audience_id as string;
  const monitorId = params.monitor_id as string;

  const audience = await verifyAudienceOwnership(userId, audienceId);
  if (!audience) return { success: false, error: "Audience not found or access denied." };

  const monitor = await verifyMonitorOwnership(userId, monitorId);
  if (!monitor) return { success: false, error: "Monitor not found or access denied." };

  // Check if already added
  const existing = await db.query.audienceMonitors.findFirst({
    where: and(eq(audienceMonitors.audienceId, audienceId), eq(audienceMonitors.monitorId, monitorId)),
  });
  if (existing) return { success: true, data: { message: `"${monitor.name}" is already in "${audience.name}".` } };

  await db.insert(audienceMonitors).values({ audienceId, monitorId });
  return { success: true, data: { message: `Added "${monitor.name}" to audience "${audience.name}".` } };
}

async function execRemoveMonitorFromAudience(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const audienceId = params.audience_id as string;
  const monitorId = params.monitor_id as string;

  const audience = await verifyAudienceOwnership(userId, audienceId);
  if (!audience) return { success: false, error: "Audience not found or access denied." };

  await db.delete(audienceMonitors).where(
    and(eq(audienceMonitors.audienceId, audienceId), eq(audienceMonitors.monitorId, monitorId))
  );
  return { success: true, data: { message: `Removed monitor from audience "${audience.name}".` } };
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOKMARK TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execCreateBookmark(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const resultId = params.result_id as string;
  const result = await verifyResultOwnership(userId, resultId);
  if (!result) return { success: false, error: "Result not found or access denied." };

  // Check for existing bookmark
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.resultId, resultId)),
  });

  if (existing) {
    // Update existing bookmark
    const updates: Record<string, unknown> = {};
    if (params.note !== undefined) updates.note = params.note ? String(params.note).slice(0, 1000) : null;
    if (params.collection_id !== undefined) updates.collectionId = params.collection_id || null;
    if (Object.keys(updates).length > 0) {
      await db.update(bookmarks).set(updates).where(eq(bookmarks.id, existing.id));
    }
    return { success: true, data: { bookmarkId: existing.id, message: "Bookmark updated." } };
  }

  const [bookmark] = await db.insert(bookmarks).values({
    userId,
    resultId,
    note: params.note ? String(params.note).slice(0, 1000) : null,
    collectionId: params.collection_id ? String(params.collection_id) : null,
  }).returning({ id: bookmarks.id });

  // Also mark the result as saved
  await db.update(results).set({ isSaved: true }).where(eq(results.id, resultId));

  return { success: true, data: { bookmarkId: bookmark.id, message: `Bookmarked "${result.title.slice(0, 60)}".` } };
}

async function execListBookmarkCollections(userId: string): Promise<ToolResult> {
  const collections = await db.query.bookmarkCollections.findMany({
    where: eq(bookmarkCollections.userId, userId),
    orderBy: [desc(bookmarkCollections.createdAt)],
  });

  const data = await Promise.all(
    collections.map(async (c) => {
      const [bookmarkCount] = await db.select({ count: count() }).from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.collectionId, c.id)));
      return { id: c.id, name: c.name, color: c.color, bookmarkCount: bookmarkCount.count };
    })
  );

  // Get uncategorized count
  const [uncategorized] = await db.select({ count: count() }).from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.collectionId)));

  return { success: true, data: { collections: data, uncategorizedCount: uncategorized.count } };
}

async function execCreateBookmarkCollection(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const name = String(params.name || "").slice(0, 100);
  if (!name) return { success: false, error: "Collection name is required." };

  // Check limit (max 20)
  const [existing] = await db.select({ count: count() }).from(bookmarkCollections)
    .where(eq(bookmarkCollections.userId, userId));
  if (existing.count >= 20) return { success: false, error: "Maximum 20 collections allowed." };

  const [collection] = await db.insert(bookmarkCollections).values({
    userId,
    name,
    color: params.color ? String(params.color).slice(0, 7) : null,
  }).returning({ id: bookmarkCollections.id, name: bookmarkCollections.name });

  return { success: true, data: { id: collection.id, name: collection.name, message: `Collection "${collection.name}" created.` } };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVED SEARCH TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execListSavedSearches(userId: string): Promise<ToolResult> {
  const searches = await db.query.savedSearches.findMany({
    where: eq(savedSearches.userId, userId),
    orderBy: [desc(savedSearches.lastUsedAt), desc(savedSearches.createdAt)],
    columns: { id: true, name: true, query: true, filters: true, useCount: true, lastUsedAt: true },
  });

  return { success: true, data: searches.map((s) => ({ ...s, lastUsedAt: s.lastUsedAt?.toISOString() ?? null })) };
}

async function execCreateSavedSearch(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const plan = await getUserPlan(userId);
  const limits: Record<string, number> = { free: 3, pro: 20, team: 100 };
  const maxSearches = limits[plan] || 3;

  const [existing] = await db.select({ count: count() }).from(savedSearches)
    .where(eq(savedSearches.userId, userId));
  if (existing.count >= maxSearches) {
    return { success: false, error: `Saved search limit reached (${maxSearches} on ${plan} plan).` };
  }

  const name = String(params.name || "").slice(0, 100);
  const query = String(params.query || "").slice(0, 500);
  if (!name || !query) return { success: false, error: "Name and query are required." };

  const [search] = await db.insert(savedSearches).values({
    userId,
    name,
    query,
    filters: params.filters ? params.filters : null,
  }).returning({ id: savedSearches.id, name: savedSearches.name });

  return { success: true, data: { id: search.id, name: search.name, message: `Saved search "${search.name}" created.` } };
}

async function execDeleteSavedSearch(userId: string, searchId: string): Promise<ToolResult> {
  const search = await db.query.savedSearches.findFirst({
    where: and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId)),
  });
  if (!search) return { success: false, error: "Saved search not found or access denied." };

  await db.delete(savedSearches).where(eq(savedSearches.id, searchId));
  return { success: true, data: { message: `Deleted saved search "${search.name}".` } };
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK TOOL EXECUTORS (Team tier only)
// ═══════════════════════════════════════════════════════════════════════════

async function execListWebhooks(userId: string): Promise<ToolResult> {
  const plan = await getUserPlan(userId);
  if (plan !== "growth") return { success: false, error: "Webhooks require a Team plan." };

  const rows = await db.query.webhooks.findMany({
    where: eq(webhooks.userId, userId),
    columns: { id: true, name: true, url: true, events: true, isActive: true, createdAt: true },
  });

  return { success: true, data: rows.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() })) };
}

async function execCreateWebhook(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const plan = await getUserPlan(userId);
  if (plan !== "growth") return { success: false, error: "Webhooks require a Team plan." };

  const name = String(params.name || "").slice(0, 100);
  const url = String(params.url || "");
  if (!name || !url) return { success: false, error: "Name and URL are required." };

  // Basic URL validation
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return { success: false, error: "Webhook URL must use HTTPS." };
    // Block private IPs
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.")) {
      return { success: false, error: "Webhook URL cannot point to private/local addresses." };
    }
  } catch {
    return { success: false, error: "Invalid URL format." };
  }

  // Generate webhook secret
  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const secret = Array.from(secretBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const events = (params.events as string[]) || ["new_result"];

  const [webhook] = await db.insert(webhooks).values({
    userId,
    name,
    url,
    secret,
    events,
    isActive: true,
  }).returning({ id: webhooks.id, name: webhooks.name });

  return { success: true, data: { id: webhook.id, name: webhook.name, message: `Webhook "${webhook.name}" created. Secret provided for HMAC verification.` } };
}

async function execDeleteWebhook(userId: string, webhookId: string): Promise<ToolResult> {
  const plan = await getUserPlan(userId);
  if (plan !== "growth") return { success: false, error: "Webhooks require a Team plan." };

  const webhook = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)),
  });
  if (!webhook) return { success: false, error: "Webhook not found or access denied." };

  await db.delete(webhooks).where(eq(webhooks.id, webhookId));
  return { success: true, data: { message: `Webhook "${webhook.name}" deleted.` } };
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execGetNotifications(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Number(params.limit) || 20, 50);

  const rows = await db.query.notifications.findMany({
    where: and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    orderBy: [desc(notifications.createdAt)],
    limit,
    columns: { id: true, title: true, message: true, type: true, monitorId: true, isRead: true, createdAt: true },
  });

  return {
    success: true,
    data: {
      notifications: rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      unreadCount: rows.length,
    },
  };
}

async function execMarkNotificationsRead(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const ids = (params.notification_ids as string[]) || [];
  if (ids.length === 0) return { success: false, error: "No notification IDs provided." };
  if (ids.length > 100) return { success: false, error: "Maximum 100 notifications per batch." };

  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)));

  return { success: true, data: { updated: ids.length, message: `Marked ${ids.length} notification(s) as read.` } };
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT & EXPORT TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execCreateShareLink(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const title = String(params.title || "").slice(0, 200);
  if (!title) return { success: false, error: "Report title is required." };

  const periodDays = Number(params.period_days) || 30;
  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Verify monitor ownership if scoped
  if (params.monitor_id) {
    const monitor = await verifyMonitorOwnership(userId, params.monitor_id as string);
    if (!monitor) return { success: false, error: "Monitor not found or access denied." };
  }

  // Build report data snapshot
  const monitorIds = params.monitor_id
    ? [params.monitor_id as string]
    : await getUserMonitorIds(userId);

  const [totalCount] = await db.select({ count: count() }).from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, periodStart), eq(results.isHidden, false)));

  const sentimentCounts = await db
    .select({ sentiment: results.sentiment, count: count() })
    .from(results)
    .where(and(inArray(results.monitorId, monitorIds), gte(results.createdAt, periodStart), eq(results.isHidden, false)))
    .groupBy(results.sentiment);

  // Generate share token
  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  const shareToken = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const expiresAt = params.expires_in_days
    ? new Date(Date.now() + Number(params.expires_in_days) * 24 * 60 * 60 * 1000)
    : null;

  const [report] = await db.insert(sharedReports).values({
    userId,
    monitorId: params.monitor_id ? String(params.monitor_id) : null,
    shareToken,
    title,
    periodStart,
    periodEnd,
    reportData: {
      totalResults: totalCount.count,
      sentimentBreakdown: Object.fromEntries(sentimentCounts.map((s) => [s.sentiment ?? "unknown", s.count])),
      generatedAt: new Date().toISOString(),
    },
    expiresAt,
    isActive: true,
  }).returning({ id: sharedReports.id });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com";
  const shareUrl = `${appUrl}/reports/shared/${shareToken}`;

  return {
    success: true,
    data: {
      id: report.id,
      shareUrl,
      expiresAt: expiresAt?.toISOString() ?? "Never",
      message: `Share link created: ${shareUrl}`,
    },
  };
}

async function execExportResultsCsv(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const plan = await getUserPlan(userId);
  if (plan === "free") return { success: false, error: "CSV export requires a Pro or Team plan." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com";
  const exportUrl = params.monitor_id
    ? `${appUrl}/api/results/export?monitorId=${params.monitor_id}`
    : `${appUrl}/api/results/export`;

  return {
    success: true,
    data: {
      message: "CSV export is available. Use the export link in your dashboard, or download directly from the URL below.",
      exportUrl,
      note: "The export includes up to 10,000 results with all metadata (title, platform, sentiment, lead score, etc.).",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execGetIntegrationsStatus(userId: string): Promise<ToolResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { integrations: true },
  });

  if (!user) return { success: false, error: "User not found." };

  const integrations = (user.integrations as Record<string, unknown>) || {};

  // Build status without exposing tokens
  const status: Record<string, { connected: boolean; connectedAt?: string }> = {};
  for (const key of ["slack", "discord", "hubspot", "teams"]) {
    const integration = integrations[key] as Record<string, unknown> | undefined;
    status[key] = {
      connected: !!integration?.accessToken || !!integration?.webhookUrl,
      connectedAt: integration?.connectedAt ? String(integration.connectedAt) : undefined,
    };
  }

  return { success: true, data: { integrations: status } };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI TOOL EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execSuggestReply(userId: string, params: Record<string, unknown>): Promise<ToolResult> {
  const plan = await getUserPlan(userId);
  if (plan === "free") return { success: false, error: "Reply suggestions require a Pro or Team plan." };

  const resultId = params.result_id as string;
  const result = await verifyResultOwnership(userId, resultId);
  if (!result) return { success: false, error: "Result not found or access denied." };

  // Import completion lazily to avoid circular dependency
  const { completion } = await import("@/lib/ai/openrouter");

  const productContext = params.product_context ? String(params.product_context).slice(0, 200) : "";

  const response = await completion({
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that generates reply suggestions for social media posts and forum discussions. Generate 3 reply suggestions with different tones: helpful, professional, and casual. Each reply should be concise (under 280 characters), authentic, and add value to the conversation. Never be spammy or overly promotional.${productContext ? ` The user's product context: ${productContext}` : ""}`,
      },
      {
        role: "user",
        content: `Generate 3 reply suggestions for this ${result.platform} post:\n\nTitle: ${result.title}\n${result.content ? `Content: ${result.content.slice(0, 500)}` : ""}\n${result.conversationCategory ? `Category: ${result.conversationCategory}` : ""}`,
      },
    ],
    maxTokens: 512,
    temperature: 0.7,
  });

  // Parse the response into structured suggestions
  const lines = response.content.split("\n").filter((l) => l.trim());
  const suggestions = lines
    .filter((l) => l.match(/^[0-9*\-•]/) || l.match(/^(helpful|professional|casual)/i))
    .slice(0, 3)
    .map((text, i) => ({
      text: text.replace(/^[0-9*\-•.\s]+/, "").replace(/^\*\*(helpful|professional|casual)\*\*:?\s*/i, "").trim(),
      tone: (["helpful", "professional", "casual"] as const)[i] || "helpful",
    }));

  return {
    success: true,
    data: {
      suggestions: suggestions.length > 0 ? suggestions : [
        { text: response.content.slice(0, 280), tone: "helpful" },
      ],
      resultTitle: result.title.slice(0, 80),
      platform: result.platform,
    },
  };
}
