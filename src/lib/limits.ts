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
// UPGRADE PROMPTS
// ============================================================================

export interface UpgradePrompt {
  show: boolean;
  title: string;
  description: string;
  currentPlan: PlanKey;
  suggestedPlan: PlanKey;
  feature?: string;
}

/**
 * Get upgrade prompt for a specific limit hit
 */
export function getUpgradePrompt(
  currentPlan: PlanKey,
  limitType: "monitors" | "keywords" | "sources" | "platform" | "feature",
  featureName?: string
): UpgradePrompt {
  const suggestedPlan: PlanKey = currentPlan === "free" ? "pro" : "enterprise";

  const prompts: Record<string, { title: string; description: string }> = {
    monitors: {
      title: "Monitor Limit Reached",
      description: `Upgrade to ${PLANS[suggestedPlan].name} to create up to ${PLANS[suggestedPlan].limits.monitors === -1 ? "unlimited" : PLANS[suggestedPlan].limits.monitors} monitors.`,
    },
    keywords: {
      title: "Keyword Limit Reached",
      description: `Upgrade to ${PLANS[suggestedPlan].name} to use up to ${PLANS[suggestedPlan].limits.keywordsPerMonitor} keywords per monitor.`,
    },
    sources: {
      title: "Source Limit Reached",
      description: `Upgrade to ${PLANS[suggestedPlan].name} to track up to ${PLANS[suggestedPlan].limits.sourcesPerMonitor} sources per monitor.`,
    },
    platform: {
      title: "Platform Not Available",
      description: `Upgrade to ${PLANS[suggestedPlan].name} to monitor ${featureName || "this platform"}.`,
    },
    feature: {
      title: "Feature Not Available",
      description: `Upgrade to ${PLANS[suggestedPlan].name} to access ${featureName || "this feature"}.`,
    },
  };

  const prompt = prompts[limitType];

  return {
    show: true,
    title: prompt.title,
    description: prompt.description,
    currentPlan,
    suggestedPlan,
    feature: featureName,
  };
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
