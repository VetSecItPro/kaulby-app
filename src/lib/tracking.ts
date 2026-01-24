/**
 * Client-side event tracking for PostHog
 * Tracks key conversion events for funnel analysis
 */
import posthog from "posthog-js";

// Type-safe event definitions
export type TrackingEvent =
  // Conversion events
  | { event: "upgrade_clicked"; properties: { from: string; plan: "pro" | "enterprise"; trigger?: string } }
  | { event: "upgrade_completed"; properties: { plan: "pro" | "enterprise"; isFoundingMember?: boolean } }
  | { event: "day_pass_purchased"; properties: { trigger?: string } }
  // Feature usage
  | { event: "monitor_created"; properties: { platforms: string[]; keywordCount: number; monitorType: "keyword" | "ai_discovery" } }
  | { event: "monitor_scanned"; properties: { monitorId: string; isManual: boolean } }
  | { event: "monitor_duplicated"; properties: { monitorId: string } }
  | { event: "monitor_deleted"; properties: { monitorId: string } }
  | { event: "result_clicked"; properties: { platform: string; monitorId: string } }
  | { event: "result_saved"; properties: { platform: string; monitorId: string } }
  | { event: "ai_analysis_viewed"; properties: { monitorId: string; resultId: string } }
  | { event: "export_triggered"; properties: { format: "csv" | "json"; resultCount: number } }
  // Limit events
  | { event: "limit_reached"; properties: { limit: "monitors" | "keywords" | "results" | "platforms"; currentPlan: string } }
  | { event: "upgrade_prompt_shown"; properties: { context: string; currentPlan: string } }
  // Engagement
  | { event: "onboarding_started"; properties?: Record<string, unknown> }
  | { event: "onboarding_completed"; properties: { monitorCreated: boolean } }
  | { event: "help_article_viewed"; properties: { articleId: string } }
  | { event: "feedback_submitted"; properties: { type: string } };

/**
 * Track a conversion or feature event
 * Safe to call even if PostHog is not initialized
 */
export function track<T extends TrackingEvent>(event: T["event"], properties?: T["properties"]) {
  try {
    if (typeof window === "undefined") return;
    if (!posthog.__loaded) return;

    posthog.capture(event, properties);
  } catch {
    // Silently fail - analytics should never break the app
  }
}

/**
 * Pre-defined tracking functions for common events
 */
export const tracking = {
  // Conversion
  upgradeClicked: (from: string, plan: "pro" | "enterprise", trigger?: string) =>
    track("upgrade_clicked", { from, plan, trigger }),

  upgradeCompleted: (plan: "pro" | "enterprise", isFoundingMember?: boolean) =>
    track("upgrade_completed", { plan, isFoundingMember }),

  dayPassPurchased: (trigger?: string) =>
    track("day_pass_purchased", { trigger }),

  // Feature usage
  monitorCreated: (platforms: string[], keywordCount: number, monitorType: "keyword" | "ai_discovery" = "keyword") =>
    track("monitor_created", { platforms, keywordCount, monitorType }),

  monitorScanned: (monitorId: string, isManual = true) =>
    track("monitor_scanned", { monitorId, isManual }),

  monitorDuplicated: (monitorId: string) =>
    track("monitor_duplicated", { monitorId }),

  monitorDeleted: (monitorId: string) =>
    track("monitor_deleted", { monitorId }),

  resultClicked: (platform: string, monitorId: string) =>
    track("result_clicked", { platform, monitorId }),

  resultSaved: (platform: string, monitorId: string) =>
    track("result_saved", { platform, monitorId }),

  aiAnalysisViewed: (monitorId: string, resultId: string) =>
    track("ai_analysis_viewed", { monitorId, resultId }),

  exportTriggered: (format: "csv" | "json", resultCount: number) =>
    track("export_triggered", { format, resultCount }),

  // Limits
  limitReached: (limit: "monitors" | "keywords" | "results" | "platforms", currentPlan: string) =>
    track("limit_reached", { limit, currentPlan }),

  upgradePromptShown: (context: string, currentPlan: string) =>
    track("upgrade_prompt_shown", { context, currentPlan }),

  // Engagement
  onboardingStarted: () =>
    track("onboarding_started", {}),

  onboardingCompleted: (monitorCreated: boolean) =>
    track("onboarding_completed", { monitorCreated }),
};
