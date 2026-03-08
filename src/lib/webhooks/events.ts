/**
 * Webhook Event Types and Payload Formatting
 *
 * Standardizes webhook payloads for Zapier/Make.com/n8n compatibility.
 * These formatting functions produce a consistent, flat-ish JSON structure
 * that automation platforms can easily parse and map to downstream actions.
 */

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | "mention.new"
  | "mention.analyzed"
  | "crisis.detected"
  | "digest.ready";

/** All valid event type strings for runtime validation */
export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  "mention.new",
  "mention.analyzed",
  "crisis.detected",
  "digest.ready",
];

// ---------------------------------------------------------------------------
// Payload envelope
// ---------------------------------------------------------------------------

export interface WebhookPayload<T = Record<string, unknown>> {
  event: WebhookEventType;
  timestamp: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Per-event data shapes
// ---------------------------------------------------------------------------

export interface MentionData {
  mentionId: string;
  monitorId: string;
  monitorName: string;
  platform: string;
  title: string;
  content: string | null;
  sourceUrl: string;
  author: string | null;
  postedAt: string | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  sentimentScore: number | null;
  painPointCategory: string | null;
  conversationCategory: string | null;
  aiSummary: string | null;
  engagement: number | null;
  commentCount: number | null;
}

export interface CrisisData {
  alertId: string;
  monitorId: string;
  monitorName: string;
  severity: "high" | "critical";
  message: string;
  mentionCount: number;
  topMentions: Array<{
    title: string;
    sourceUrl: string;
    platform: string;
    sentiment: string | null;
  }>;
}

export interface DigestData {
  digestId: string;
  monitorId: string;
  monitorName: string;
  period: "daily" | "weekly" | "monthly";
  mentionCount: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topMentions: Array<{
    title: string;
    sourceUrl: string;
    platform: string;
    sentiment: string | null;
  }>;
  summary: string | null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function envelope<T>(
  event: WebhookEventType,
  data: T,
): WebhookPayload<T> {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
}

/**
 * Format a new or analyzed mention into a webhook payload.
 * Use `mention.new` for raw results and `mention.analyzed` after AI analysis.
 */
export function formatMentionPayload(
  eventType: "mention.new" | "mention.analyzed",
  result: {
    id: string;
    monitorId: string;
    monitorName: string;
    platform: string;
    title: string;
    content?: string | null;
    sourceUrl: string;
    author?: string | null;
    postedAt?: Date | string | null;
    sentiment?: "positive" | "negative" | "neutral" | null;
    sentimentScore?: number | null;
    painPointCategory?: string | null;
    conversationCategory?: string | null;
    aiSummary?: string | null;
    engagement?: number | null;
    commentCount?: number | null;
  },
): WebhookPayload<MentionData> {
  return envelope(eventType, {
    mentionId: result.id,
    monitorId: result.monitorId,
    monitorName: result.monitorName,
    platform: result.platform,
    title: result.title,
    content: result.content ?? null,
    sourceUrl: result.sourceUrl,
    author: result.author ?? null,
    postedAt: result.postedAt
      ? new Date(result.postedAt).toISOString()
      : null,
    sentiment: result.sentiment ?? null,
    sentimentScore: result.sentimentScore ?? null,
    painPointCategory: result.painPointCategory ?? null,
    conversationCategory: result.conversationCategory ?? null,
    aiSummary: result.aiSummary ?? null,
    engagement: result.engagement ?? null,
    commentCount: result.commentCount ?? null,
  });
}

/**
 * Format a crisis alert into a webhook payload.
 */
export function formatCrisisPayload(alert: {
  id: string;
  monitorId: string;
  monitorName: string;
  severity: "high" | "critical";
  message: string;
  mentionCount: number;
  topMentions?: Array<{
    title: string;
    sourceUrl: string;
    platform: string;
    sentiment?: string | null;
  }>;
}): WebhookPayload<CrisisData> {
  return envelope("crisis.detected", {
    alertId: alert.id,
    monitorId: alert.monitorId,
    monitorName: alert.monitorName,
    severity: alert.severity,
    message: alert.message,
    mentionCount: alert.mentionCount,
    topMentions: (alert.topMentions ?? []).map((m) => ({
      title: m.title,
      sourceUrl: m.sourceUrl,
      platform: m.platform,
      sentiment: m.sentiment ?? null,
    })),
  });
}

/**
 * Format a digest summary into a webhook payload.
 */
export function formatDigestPayload(digest: {
  id: string;
  monitorId: string;
  monitorName: string;
  period: "daily" | "weekly" | "monthly";
  mentionCount: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topMentions?: Array<{
    title: string;
    sourceUrl: string;
    platform: string;
    sentiment?: string | null;
  }>;
  summary?: string | null;
}): WebhookPayload<DigestData> {
  return envelope("digest.ready", {
    digestId: digest.id,
    monitorId: digest.monitorId,
    monitorName: digest.monitorName,
    period: digest.period,
    mentionCount: digest.mentionCount,
    sentimentBreakdown: digest.sentimentBreakdown,
    topMentions: (digest.topMentions ?? []).map((m) => ({
      title: m.title,
      sourceUrl: m.sourceUrl,
      platform: m.platform,
      sentiment: m.sentiment ?? null,
    })),
    summary: digest.summary ?? null,
  });
}

// ---------------------------------------------------------------------------
// Test payload (used by the test endpoint)
// ---------------------------------------------------------------------------

/**
 * Generate a realistic test payload that Zapier/Make.com can use
 * to set up field mappings during webhook configuration.
 */
export function generateTestPayload(): WebhookPayload<MentionData> {
  const data: MentionData = {
    mentionId: "test_00000000-0000-0000-0000-000000000000",
    monitorId: "test_00000000-0000-0000-0000-000000000001",
    monitorName: "Test Monitor",
    platform: "reddit",
    title: "This is a test mention from Kaulby",
    content:
      "This test payload lets you map fields in your automation platform. " +
      "When real mentions are detected, they will arrive in this same format.",
    sourceUrl: "https://reddit.com/r/example/test-post",
    author: "test_user",
    postedAt: new Date().toISOString(),
    sentiment: "positive",
    sentimentScore: 0.92,
    painPointCategory: "feature_request",
    conversationCategory: "solution_request",
    aiSummary:
      "A user is looking for a solution that matches your product's capabilities.",
    engagement: 42,
    commentCount: 7,
  };
  return envelope("mention.new", data);
}
