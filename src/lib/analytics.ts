import type { PlanKey } from "@/lib/plans";
import { captureEvent } from "@/lib/posthog";

// Tier 1 Task 1.4: typed event taxonomy.
// Extending: add a key to AnalyticsEvents, then instrument a track() call at the call site.
// The typed map prevents event-name drift and schema drift across call sites.
//
// Every event payload MUST include `userId` — track() extracts it as PostHog's
// `distinctId` and sends the remaining keys as event properties. This keeps
// per-user analytics consistent regardless of which call site fires the event.
export type AnalyticsEvents = {
  "monitor.created": {
    userId: string;
    monitorId: string;
    platform: string;
    plan: PlanKey;
  };
  "scan.completed": {
    userId: string;
    monitorId: string;
    platform: string;
    resultsFound: number;
    durationMs: number;
  };
  "scan.failed": {
    userId: string;
    monitorId: string;
    platform: string;
    errorType: string;
  };
  "monitor.scan_skipped": {
    userId: string;
    monitorId: string;
    platform: string;
    reason: "platform_not_in_plan" | "refresh_delay_not_elapsed" | "cadence_not_elapsed" | "schedule_not_active";
    tier: PlanKey;
  };
  "ai_analysis.completed": {
    userId: string;
    resultId: string;
    sentiment: "positive" | "negative" | "neutral" | null;
    tier: "solo" | "growth";
    costUsd: number;
  };
  "ai_analysis.failed": {
    userId: string;
    resultId: string;
    errorType: string;
  };
  "payment.succeeded": {
    userId: string;
    tier: "solo" | "growth";
    interval: "monthly" | "annual" | "day_pass";
  };
  "result.action_taken": {
    userId: string;
    resultId: string;
    action: "hide" | "mark_read" | "save" | "unsave";
  };
};

/**
 * Typed wrapper around posthog capture. Use this instead of calling
 * captureEvent directly so the event name + properties are type-checked
 * against the AnalyticsEvents map above.
 *
 * `userId` is extracted and mapped to PostHog's `distinctId` — the remaining
 * keys are forwarded as event properties. Adding a new event = extend the map.
 */
export function track<K extends keyof AnalyticsEvents>(
  event: K,
  props: AnalyticsEvents[K]
): void {
  const { userId, ...rest } = props as { userId: string } & Record<string, unknown>;
  captureEvent({
    distinctId: userId,
    event,
    properties: rest,
  });
}
