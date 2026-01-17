import { db } from "@/lib/db";
import { users, monitors, communities, usage } from "@/lib/db/schema";
import { eq, and, count, gte } from "drizzle-orm";
import { PLANS, PlanKey, Platform, getPlanLimits } from "@/lib/stripe";

// ============================================================================
// TYPES
// ============================================================================

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  message: string;
}

export interface UsageStats {
  monitors: { current: number; limit: number; percentage: number };
  resultsThisPeriod: { current: number; limit: number; percentage: number };
}

export interface FeatureAccess {
  feature: string;
  hasAccess: boolean;
  requiredPlan: PlanKey;
}

// ============================================================================
// USER PLAN HELPERS
// ============================================================================

/**
 * Get the user's current subscription plan
 */
export async function getUserPlan(userId: string): Promise<PlanKey> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true },
  });

  if (!user) return "free";
  return (user.subscriptionStatus as PlanKey) || "free";
}

/**
 * Get the user record with subscription info
 */
export async function getUserWithSubscription(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      subscriptionStatus: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });
}

// ============================================================================
// MONITOR LIMITS
// ============================================================================

/**
 * Check if user can create a new monitor
 */
export async function canCreateMonitor(userId: string): Promise<LimitCheckResult> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  // Unlimited monitors
  if (limits.monitors === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      message: "Unlimited monitors available",
    };
  }

  // Count current monitors
  const [result] = await db
    .select({ count: count() })
    .from(monitors)
    .where(eq(monitors.userId, userId));

  const currentCount = result?.count || 0;

  if (currentCount >= limits.monitors) {
    return {
      allowed: false,
      current: currentCount,
      limit: limits.monitors,
      message: `You've reached your limit of ${limits.monitors} monitor${limits.monitors === 1 ? "" : "s"}. Upgrade to Pro for more.`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: limits.monitors,
    message: `${limits.monitors - currentCount} monitor${limits.monitors - currentCount === 1 ? "" : "s"} remaining`,
  };
}

/**
 * Check if keywords count is within limit for a monitor
 */
export function checkKeywordsLimit(
  keywords: string[],
  plan: PlanKey
): LimitCheckResult {
  const limits = getPlanLimits(plan);
  const keywordCount = keywords.length;

  if (keywordCount > limits.keywordsPerMonitor) {
    return {
      allowed: false,
      current: keywordCount,
      limit: limits.keywordsPerMonitor,
      message: `Maximum ${limits.keywordsPerMonitor} keywords allowed on ${PLANS[plan].name} plan`,
    };
  }

  return {
    allowed: true,
    current: keywordCount,
    limit: limits.keywordsPerMonitor,
    message: `${limits.keywordsPerMonitor - keywordCount} keywords remaining`,
  };
}

/**
 * Check if sources count is within limit for a monitor
 */
export async function checkSourcesLimit(
  audienceId: string,
  plan: PlanKey
): Promise<LimitCheckResult> {
  const limits = getPlanLimits(plan);

  const [result] = await db
    .select({ count: count() })
    .from(communities)
    .where(eq(communities.audienceId, audienceId));

  const currentCount = result?.count || 0;

  if (currentCount > limits.sourcesPerMonitor) {
    return {
      allowed: false,
      current: currentCount,
      limit: limits.sourcesPerMonitor,
      message: `Maximum ${limits.sourcesPerMonitor} sources allowed on ${PLANS[plan].name} plan`,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    limit: limits.sourcesPerMonitor,
    message: `${limits.sourcesPerMonitor - currentCount} sources remaining`,
  };
}

// ============================================================================
// RESULTS VISIBILITY (Conversion-focused)
// ============================================================================

/**
 * Get the number of results a user can see
 * Free users: Only see last 3 results (but we show them how many MORE exist)
 */
export async function getResultsVisibility(userId: string): Promise<{
  visibleLimit: number;
  isLimited: boolean;
}> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  return {
    visibleLimit: limits.resultsVisible,
    isLimited: limits.resultsVisible !== -1,
  };
}

/**
 * Check if a specific result should show AI analysis
 * Free users: Only the FIRST result (oldest) gets AI analysis
 * This creates a teaser effect - they see AI analysis works, want more
 */
export async function canViewAiAnalysis(
  userId: string,
  resultIndex: number, // 0-based index, 0 = oldest/first result
  totalResults: number
): Promise<{
  canView: boolean;
  isBlurred: boolean;
  message: string;
}> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  // Pro and Enterprise get unlimited AI analysis
  if (limits.aiFeatures.unlimitedAiAnalysis) {
    return {
      canView: true,
      isBlurred: false,
      message: "",
    };
  }

  // Free tier: Only first result (index 0 when sorted oldest-first, or last when sorted newest-first)
  // We show AI analysis on the FIRST result they ever got, to demonstrate value
  const isFirstResult = resultIndex === totalResults - 1; // Assuming sorted newest-first

  if (isFirstResult) {
    return {
      canView: true,
      isBlurred: false,
      message: "",
    };
  }

  return {
    canView: false,
    isBlurred: true,
    message: "Upgrade to Pro to unlock AI analysis on all results",
  };
}

/**
 * Get refresh delay for user's plan
 * Free: 24 hours delay, Pro/Enterprise: real-time
 */
export async function getRefreshDelay(userId: string): Promise<{
  delayHours: number;
  isDelayed: boolean;
  nextRefreshAt: Date | null;
  message: string;
}> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  if (limits.refreshDelayHours === 0) {
    return {
      delayHours: 0,
      isDelayed: false,
      nextRefreshAt: null,
      message: "Real-time monitoring active",
    };
  }

  // Calculate next refresh time based on last check
  const now = new Date();
  const nextRefreshAt = new Date(now.getTime() + limits.refreshDelayHours * 60 * 60 * 1000);

  return {
    delayHours: limits.refreshDelayHours,
    isDelayed: true,
    nextRefreshAt,
    message: `Results refresh every ${limits.refreshDelayHours} hours. Upgrade to Pro for real-time monitoring.`,
  };
}

/**
 * Filter and annotate results for display based on user's plan
 * Returns results with visibility metadata for UI rendering
 */
export interface ResultWithVisibility<T> {
  result: T;
  isVisible: boolean;
  isAiBlurred: boolean;
  position: number; // 1-based position
}

export async function filterResultsForDisplay<T extends { id: string }>(
  userId: string,
  results: T[],
  totalCount: number
): Promise<{
  visibleResults: ResultWithVisibility<T>[];
  hiddenCount: number;
  showUpgradePrompt: boolean;
  upgradeMessage: string;
}> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  const visibleLimit = limits.resultsVisible;
  const isLimited = visibleLimit !== -1;
  const hiddenCount = isLimited ? Math.max(0, totalCount - visibleLimit) : 0;

  const visibleResults: ResultWithVisibility<T>[] = results.map((result, index) => {
    const position = index + 1;
    const isVisible = !isLimited || position <= visibleLimit;
    const isAiBlurred = !limits.aiFeatures.unlimitedAiAnalysis && position > 1;

    return {
      result,
      isVisible,
      isAiBlurred,
      position,
    };
  });

  return {
    visibleResults,
    hiddenCount,
    showUpgradePrompt: hiddenCount > 0,
    upgradeMessage: hiddenCount > 0
      ? `${hiddenCount} more results waiting. Upgrade to Pro to see all.`
      : "",
  };
}

// ============================================================================
// PLATFORM ACCESS
// ============================================================================

/**
 * Check if user has access to a specific platform
 */
export async function canAccessPlatform(
  userId: string,
  platform: Platform
): Promise<FeatureAccess> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const hasAccess = limits.platforms.includes(platform);

  // Find the minimum plan that includes this platform
  let requiredPlan: PlanKey = "enterprise";
  for (const planKey of ["free", "pro", "enterprise"] as PlanKey[]) {
    if (PLANS[planKey].limits.platforms.includes(platform)) {
      requiredPlan = planKey;
      break;
    }
  }

  return {
    feature: `${platform} monitoring`,
    hasAccess,
    requiredPlan,
  };
}

/**
 * Filter platforms to only those the user has access to
 */
export async function filterAllowedPlatforms(
  userId: string,
  platforms: Platform[]
): Promise<Platform[]> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  return platforms.filter((p) => limits.platforms.includes(p));
}

// ============================================================================
// FEATURE ACCESS
// ============================================================================

/**
 * Check if user has access to a specific feature
 */
export async function canAccessFeature(
  userId: string,
  feature: "sentiment" | "painPointCategories" | "askFeature" | "slack" | "webhooks" | "csv" | "api" | "emailAlerts"
): Promise<FeatureAccess> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  let hasAccess = false;
  let requiredPlan: PlanKey = "enterprise";

  switch (feature) {
    case "sentiment":
      hasAccess = limits.aiFeatures.sentiment;
      requiredPlan = "free"; // Available on all plans
      break;
    case "painPointCategories":
      hasAccess = limits.aiFeatures.painPointCategories;
      requiredPlan = "pro";
      break;
    case "askFeature":
      hasAccess = limits.aiFeatures.askFeature;
      requiredPlan = "enterprise";
      break;
    case "emailAlerts":
      hasAccess = limits.alerts.email;
      requiredPlan = "pro";
      break;
    case "slack":
      hasAccess = limits.alerts.slack;
      requiredPlan = "pro";
      break;
    case "webhooks":
      hasAccess = limits.alerts.webhooks;
      requiredPlan = "enterprise";
      break;
    case "csv":
      hasAccess = limits.exports.csv;
      requiredPlan = "pro";
      break;
    case "api":
      hasAccess = limits.exports.api;
      requiredPlan = "enterprise";
      break;
  }

  return {
    feature,
    hasAccess,
    requiredPlan,
  };
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Get or create usage record for current billing period
 */
export async function getOrCreateUsageRecord(userId: string) {
  const user = await getUserWithSubscription(userId);
  if (!user) throw new Error("User not found");

  // Determine billing period
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  if (user.currentPeriodStart && user.currentPeriodEnd) {
    periodStart = user.currentPeriodStart;
    periodEnd = user.currentPeriodEnd;
  } else {
    // For free users, use calendar month
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  // Find existing usage record
  const existingUsage = await db.query.usage.findFirst({
    where: and(
      eq(usage.userId, userId),
      gte(usage.periodStart, periodStart)
    ),
  });

  if (existingUsage) {
    return existingUsage;
  }

  // Create new usage record
  const [newUsage] = await db
    .insert(usage)
    .values({
      userId,
      periodStart,
      periodEnd,
      resultsCount: 0,
      aiCallsCount: 0,
    })
    .returning();

  return newUsage;
}

/**
 * Increment results count for current period
 */
export async function incrementResultsCount(
  userId: string,
  count: number = 1
): Promise<void> {
  const usageRecord = await getOrCreateUsageRecord(userId);

  await db
    .update(usage)
    .set({
      resultsCount: usageRecord.resultsCount + count,
    })
    .where(eq(usage.id, usageRecord.id));
}

/**
 * Increment AI calls count for current period
 */
export async function incrementAiCallsCount(
  userId: string,
  count: number = 1
): Promise<void> {
  const usageRecord = await getOrCreateUsageRecord(userId);

  await db
    .update(usage)
    .set({
      aiCallsCount: usageRecord.aiCallsCount + count,
    })
    .where(eq(usage.id, usageRecord.id));
}

// ============================================================================
// USAGE STATS
// ============================================================================

/**
 * Get comprehensive usage stats for a user
 */
export async function getUserUsageStats(userId: string): Promise<UsageStats> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  // Get monitor count
  const [monitorResult] = await db
    .select({ count: count() })
    .from(monitors)
    .where(eq(monitors.userId, userId));

  const monitorCount = monitorResult?.count || 0;
  const monitorLimit = limits.monitors;

  // Get results count for current period
  const usageRecord = await getOrCreateUsageRecord(userId);
  const resultsCount = usageRecord.resultsCount;

  // Calculate results limit based on history days (rough estimate)
  // This is a simplified approach - in production you might want a dedicated results limit
  const resultsLimit = limits.resultsHistoryDays === 365 ? -1 : limits.resultsHistoryDays * 100;

  return {
    monitors: {
      current: monitorCount,
      limit: monitorLimit,
      percentage: monitorLimit === -1 ? 0 : Math.round((monitorCount / monitorLimit) * 100),
    },
    resultsThisPeriod: {
      current: resultsCount,
      limit: resultsLimit,
      percentage: resultsLimit === -1 ? 0 : Math.round((resultsCount / resultsLimit) * 100),
    },
  };
}

// ============================================================================
// UPGRADE PROMPTS (Conversion-focused)
// ============================================================================

export interface UpgradePrompt {
  show: boolean;
  title: string;
  description: string;
  benefit: string; // What they'll gain
  urgency?: string; // Optional urgency message
  currentPlan: PlanKey;
  suggestedPlan: PlanKey;
  feature?: string;
  ctaText: string;
}

export type UpgradeTrigger =
  | "monitors"
  | "keywords"
  | "sources"
  | "platform"
  | "feature"
  | "results_hidden"
  | "ai_blurred"
  | "refresh_delay"
  | "export"
  | "alerts";

/**
 * Get conversion-focused upgrade prompt for a specific limit hit
 */
export function getUpgradePrompt(
  currentPlan: PlanKey,
  trigger: UpgradeTrigger,
  context?: {
    featureName?: string;
    hiddenCount?: number;
    platformName?: string;
  }
): UpgradePrompt {
  const suggestedPlan: PlanKey = currentPlan === "free" ? "pro" : "enterprise";
  const planName = PLANS[suggestedPlan].name;

  const prompts: Record<UpgradeTrigger, {
    title: string;
    description: string;
    benefit: string;
    urgency?: string;
    ctaText: string;
  }> = {
    monitors: {
      title: "Track More Conversations",
      description: "You've reached your monitor limit.",
      benefit: `${planName} lets you create ${PLANS[suggestedPlan].limits.monitors === -1 ? "unlimited" : PLANS[suggestedPlan].limits.monitors} monitors to track everything important.`,
      ctaText: `Unlock ${PLANS[suggestedPlan].limits.monitors === -1 ? "unlimited" : PLANS[suggestedPlan].limits.monitors} monitors`,
    },
    keywords: {
      title: "Add More Keywords",
      description: "Track more variations and catch every mention.",
      benefit: `${planName} supports up to ${PLANS[suggestedPlan].limits.keywordsPerMonitor} keywords per monitor.`,
      ctaText: `Get ${PLANS[suggestedPlan].limits.keywordsPerMonitor} keywords`,
    },
    sources: {
      title: "Monitor More Communities",
      description: "Expand your reach across more subreddits and communities.",
      benefit: `${planName} lets you track ${PLANS[suggestedPlan].limits.sourcesPerMonitor} sources per monitor.`,
      ctaText: "Expand your reach",
    },
    platform: {
      title: `Unlock ${context?.platformName || "More Platforms"}`,
      description: `${context?.platformName || "This platform"} is where your audience is talking.`,
      benefit: `${planName} includes ${PLANS[suggestedPlan].limits.platforms.length} platforms: ${PLANS[suggestedPlan].limits.platforms.join(", ")}.`,
      ctaText: `Monitor ${context?.platformName || "all platforms"}`,
    },
    feature: {
      title: `Unlock ${context?.featureName || "This Feature"}`,
      description: "Take your monitoring to the next level.",
      benefit: `${planName} includes ${context?.featureName} and much more.`,
      ctaText: `Get ${context?.featureName}`,
    },
    results_hidden: {
      title: `${context?.hiddenCount || "More"} Results Waiting`,
      description: "You're only seeing part of the conversation.",
      benefit: `${planName} shows all results so you never miss an opportunity.`,
      urgency: `${context?.hiddenCount} mentions you're not seeing could be leads or customer feedback.`,
      ctaText: "See all results",
    },
    ai_blurred: {
      title: "AI Analysis Ready",
      description: "We've analyzed this mention for you.",
      benefit: `${planName} unlocks AI-powered sentiment analysis, pain point detection, and summaries on every result.`,
      ctaText: "Unlock AI insights",
    },
    refresh_delay: {
      title: "Get Real-Time Monitoring",
      description: "Your results are 24 hours delayed.",
      benefit: `${planName} monitors in real-time so you can respond while conversations are hot.`,
      urgency: "Fresh mentions get 10x more engagement than day-old ones.",
      ctaText: "Go real-time",
    },
    export: {
      title: "Export Your Data",
      description: "Download your results for reporting and analysis.",
      benefit: `${planName} includes CSV export${suggestedPlan === "enterprise" ? " and API access" : ""}.`,
      ctaText: "Unlock exports",
    },
    alerts: {
      title: "Never Miss a Mention",
      description: "Get notified when new results come in.",
      benefit: `${planName} includes ${suggestedPlan === "enterprise" ? "email, Slack, and webhook" : "email and Slack"} alerts.`,
      ctaText: "Enable alerts",
    },
  };

  const prompt = prompts[trigger];

  return {
    show: true,
    title: prompt.title,
    description: prompt.description,
    benefit: prompt.benefit,
    urgency: prompt.urgency,
    currentPlan,
    suggestedPlan,
    feature: context?.featureName,
    ctaText: prompt.ctaText,
  };
}

/**
 * Get social proof message for upgrade prompts
 * This should be populated with real data from your analytics
 */
export async function getUpgradeSocialProof(): Promise<{
  proUsersCount: number;
  mentionsTrackedThisWeek: number;
  message: string;
}> {
  // TODO: Replace with real data from database
  // For now, return placeholder data
  const proUsersCount = 847;
  const mentionsTrackedThisWeek = 12000;

  return {
    proUsersCount,
    mentionsTrackedThisWeek,
    message: `Join ${proUsersCount.toLocaleString()} Pro users who tracked ${mentionsTrackedThisWeek.toLocaleString()} mentions this week`,
  };
}

/**
 * Check if user should see an upgrade prompt based on their activity
 * Returns the most relevant trigger if multiple apply
 */
export async function getActiveUpgradeTrigger(
  userId: string
): Promise<UpgradeTrigger | null> {
  const plan = await getUserPlan(userId);

  // Only show upgrade prompts to free users
  if (plan !== "free") return null;

  const limits = getPlanLimits(plan);

  // Check monitor limit
  const monitorCheck = await canCreateMonitor(userId);
  if (!monitorCheck.allowed) return "monitors";

  // Check if they have hidden results (most compelling trigger)
  const usageRecord = await getOrCreateUsageRecord(userId);
  if (usageRecord.resultsCount > limits.resultsVisible) {
    return "results_hidden";
  }

  // Check refresh delay (if they've been waiting)
  if (limits.refreshDelayHours > 0) {
    return "refresh_delay";
  }

  return null;
}

// ============================================================================
// MONITOR SCHEDULING
// ============================================================================

/**
 * Check if a monitor should be processed based on refresh delay
 * Free users have 24-hour delay, paid users get real-time processing
 */
export async function shouldProcessMonitor(
  userId: string,
  lastCheckedAt: Date | string | null
): Promise<{
  shouldProcess: boolean;
  reason: string;
  nextCheckAt?: Date;
}> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  // Real-time processing for paid users
  if (limits.refreshDelayHours === 0) {
    return {
      shouldProcess: true,
      reason: "Real-time monitoring",
    };
  }

  // Check if enough time has passed since last check
  if (lastCheckedAt) {
    const lastCheckDate = typeof lastCheckedAt === "string" ? new Date(lastCheckedAt) : lastCheckedAt;
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - lastCheckDate.getTime();
    const delayMs = limits.refreshDelayHours * 60 * 60 * 1000;

    if (timeSinceLastCheck < delayMs) {
      const nextCheckAt = new Date(lastCheckDate.getTime() + delayMs);
      return {
        shouldProcess: false,
        reason: `Refresh delay: next check at ${nextCheckAt.toISOString()}`,
        nextCheckAt,
      };
    }
  }

  return {
    shouldProcess: true,
    reason: "Ready for check",
  };
}

// ============================================================================
// MANUAL SCAN RATE LIMITING
// ============================================================================

/**
 * Manual scan limits by tier
 * Free: 1 scan/day with 24hr cooldown
 * Pro: 3 scans/day with 4hr cooldown
 * Enterprise: 12 scans/day with 1hr cooldown
 */
const MANUAL_SCAN_LIMITS: Record<PlanKey, { cooldownHours: number; dailyLimit: number }> = {
  free: { cooldownHours: 24, dailyLimit: 1 },
  pro: { cooldownHours: 4, dailyLimit: 3 },
  enterprise: { cooldownHours: 1, dailyLimit: 12 },
};

export interface ManualScanCheckResult {
  canScan: boolean;
  cooldownRemaining: number | null; // milliseconds until next scan allowed
  reason: string;
  nextScanAt: Date | null;
}

/**
 * Check if user can trigger a manual scan for a monitor
 */
export async function canTriggerManualScan(
  userId: string,
  lastManualScanAt: Date | string | null
): Promise<ManualScanCheckResult> {
  const plan = await getUserPlan(userId);
  const limits = MANUAL_SCAN_LIMITS[plan];

  // Check cooldown period
  if (lastManualScanAt) {
    const lastScanDate = typeof lastManualScanAt === "string" ? new Date(lastManualScanAt) : lastManualScanAt;
    const now = new Date();
    const timeSinceLastScan = now.getTime() - lastScanDate.getTime();
    const cooldownMs = limits.cooldownHours * 60 * 60 * 1000;

    if (timeSinceLastScan < cooldownMs) {
      const cooldownRemaining = cooldownMs - timeSinceLastScan;
      const nextScanAt = new Date(lastScanDate.getTime() + cooldownMs);

      return {
        canScan: false,
        cooldownRemaining,
        reason: `Please wait ${formatCooldown(cooldownRemaining)} before scanning again`,
        nextScanAt,
      };
    }
  }

  return {
    canScan: true,
    cooldownRemaining: null,
    reason: "Ready to scan",
    nextScanAt: null,
  };
}

/**
 * Format cooldown time for display
 */
function formatCooldown(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get manual scan cooldown hours for a user's plan
 */
export async function getManualScanCooldown(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  return MANUAL_SCAN_LIMITS[plan].cooldownHours;
}

// ============================================================================
// ADMIN HELPERS
// ============================================================================

/**
 * Check if user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true },
  });

  return user?.isAdmin ?? false;
}

/**
 * Require admin access - throws if not admin
 */
export async function requireAdmin(userId: string): Promise<void> {
  const admin = await isAdmin(userId);
  if (!admin) {
    throw new Error("Admin access required");
  }
}
