import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { monitors, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  canCreateMonitor,
  checkKeywordsLimit,
  getUserPlan,
  filterAllowedPlatforms,
  getUpgradePrompt,
} from "@/lib/limits";
import { Platform, ALL_PLATFORMS } from "@/lib/plans";
import { sanitizeMonitorInput, isValidKeyword } from "@/lib/security";
import { captureEvent } from "@/lib/posthog";
import { logError } from "@/lib/error-logger";
import { getEffectiveUserId, isLocalDev as checkIsLocalDev } from "@/lib/dev-auth";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const validMonitorTypes = ["keyword", "ai_discovery"];

/** Validate and sanitize monitor creation input */
function validateMonitorInput(body: Record<string, unknown>) {
  const { name, companyName, keywords, monitorType, discoveryPrompt, platforms } = body;

  // Validate input
  if (!name || typeof name !== "string") {
    return { error: "Name is required", status: 400 };
  }

  if (!companyName || typeof companyName !== "string") {
    return { error: "Company/brand name is required", status: 400 };
  }

  // Validate monitor type (defaults to "keyword" for backwards compatibility)
  const sanitizedMonitorType = (typeof monitorType === "string" && validMonitorTypes.includes(monitorType)) ? (monitorType as "keyword" | "ai_discovery") : "keyword";

  // Validate AI Discovery mode requirements
  if (sanitizedMonitorType === "ai_discovery") {
    if (!discoveryPrompt || typeof discoveryPrompt !== "string" || !discoveryPrompt.trim()) {
      return {
        error: "Discovery prompt is required for AI Discovery mode",
        status: 400,
      };
    }
  }

  // Sanitize discovery prompt if provided (max 1000 chars for detailed prompts)
  const sanitizedDiscoveryPrompt = discoveryPrompt && typeof discoveryPrompt === "string"
    ? discoveryPrompt.trim().slice(0, 1000)
    : null;

  // Keywords are now optional - sanitize if provided
  const sanitizedKeywords = Array.isArray(keywords)
    ? keywords
        .map((k: string) => (typeof k === "string" ? sanitizeMonitorInput(k) : ""))
        .filter((k) => isValidKeyword(k))
    : [];

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return { error: "At least one platform is required", status: 400 };
  }

  // Validate platforms against canonical list from plans.ts
  const invalidPlatforms = platforms.filter((p: string) => !ALL_PLATFORMS.includes(p as Platform));
  if (invalidPlatforms.length > 0) {
    return { error: `Invalid platforms: ${invalidPlatforms.join(", ")}`, status: 400 };
  }

  return {
    sanitizedData: {
      sanitizedMonitorType,
      sanitizedDiscoveryPrompt,
      sanitizedKeywords,
    },
  };
}

/** Check plan limits for monitor creation */
async function checkMonitorLimits(
  userId: string,
  plan: "free" | "pro" | "enterprise",
  keywords: string[],
  platforms: string[]
) {
  // Check monitor limit
  const monitorCheck = await canCreateMonitor(userId);
  if (!monitorCheck.allowed) {
    const prompt = getUpgradePrompt(plan, "monitors");
    return {
      error: monitorCheck.message,
      upgradePrompt: prompt,
      status: 403 as const,
      current: monitorCheck.current,
      limit: monitorCheck.limit,
    };
  }

  // Check keywords limit (only if keywords provided)
  if (keywords.length > 0) {
    const keywordCheck = checkKeywordsLimit(keywords, plan);
    if (!keywordCheck.allowed) {
      const prompt = getUpgradePrompt(plan, "keywords");
      return {
        error: keywordCheck.message,
        upgradePrompt: prompt,
        status: 403 as const,
        current: keywordCheck.current,
        limit: keywordCheck.limit,
      };
    }
  }

  // Filter platforms to only allowed ones for user's plan
  const allowedPlatforms = await filterAllowedPlatforms(userId, platforms as Platform[]);

  if (allowedPlatforms.length === 0) {
    const prompt = getUpgradePrompt(plan, "platform", { platformName: platforms[0] });
    return {
      error: `Your plan doesn't have access to ${platforms.join(", ")}. ${prompt.description}`,
      upgradePrompt: prompt,
      status: 403 as const,
    };
  }

  // Warn if some platforms were filtered out
  const filteredOut = platforms.filter((p: string) => !allowedPlatforms.includes(p as Platform));

  return { allowedPlatforms, filteredOut };
}

/** Sanitize platform URLs */
function sanitizePlatformUrls(platformUrls: Record<string, unknown>): Record<string, string> {
  const sanitizedPlatformUrls: Record<string, string> = {};
  if (platformUrls && typeof platformUrls === "object") {
    for (const [platform, url] of Object.entries(platformUrls)) {
      if (typeof url === "string" && url.trim()) {
        // Basic URL validation - allow Google Maps URLs, Trustpilot, App Store, Play Store, and Place IDs
        const trimmedUrl = url.trim();
        if (
          trimmedUrl.startsWith("https://") ||
          trimmedUrl.startsWith("ChI") // Google Place ID
        ) {
          sanitizedPlatformUrls[platform] = trimmedUrl.slice(0, 500); // Max 500 chars
        }
      }
    }
  }
  return sanitizedPlatformUrls;
}

// In development, ensure user exists in database
async function ensureDevUserExists(userId: string): Promise<void> {
  if (!checkIsLocalDev()) return;

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });

  if (existingUser) return;

  // Create dev user with defaults
  await db.insert(users).values({
    id: userId,
    email: `dev-${userId}@localhost`,
    name: "Dev User",
    subscriptionStatus: "enterprise", // Give full access in dev mode
  }).onConflictDoNothing();
}

export async function POST(request: Request) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // In dev mode, auto-create user if not exists
    await ensureDevUserExists(userId);

    const body = await parseJsonBody(request, 51200); // 50KB limit for monitor creation
    const { name, companyName, searchQuery, platforms, platformUrls,
      scheduleEnabled, scheduleStartHour, scheduleEndHour, scheduleDays, scheduleTimezone } = body;

    // Validate input
    const validationResult = validateMonitorInput(body);
    if ("error" in validationResult) {
      return NextResponse.json({ error: validationResult.error }, { status: validationResult.status });
    }
    const { sanitizedMonitorType, sanitizedDiscoveryPrompt, sanitizedKeywords } = validationResult.sanitizedData;

    // Get user's plan
    const plan = await getUserPlan(userId);

    // Check monitor limits
    const limitsCheck = await checkMonitorLimits(userId, plan, sanitizedKeywords, platforms);
    if ("error" in limitsCheck) {
      const { error, upgradePrompt, status, current, limit } = limitsCheck;
      return NextResponse.json(
        {
          error,
          upgradePrompt,
          ...(current !== undefined && { current }),
          ...(limit !== undefined && { limit }),
        },
        { status }
      );
    }
    const { allowedPlatforms, filteredOut } = limitsCheck;

    // Sanitize search query if provided (Pro feature)
    const sanitizedSearchQuery = searchQuery && typeof searchQuery === "string"
      ? searchQuery.trim().slice(0, 500) // Max 500 chars for search query
      : undefined;

    // Sanitize platform URLs if provided
    const sanitizedPlatformUrls = sanitizePlatformUrls(platformUrls);

    // Create monitor with allowed platforms only
    const [newMonitor] = await db
      .insert(monitors)
      .values({
        userId,
        name: sanitizeMonitorInput(name),
        companyName: sanitizeMonitorInput(companyName),
        monitorType: sanitizedMonitorType,
        keywords: sanitizedMonitorType === "keyword" ? sanitizedKeywords : [],
        searchQuery: sanitizedMonitorType === "keyword" ? sanitizedSearchQuery : null,
        discoveryPrompt: sanitizedMonitorType === "ai_discovery" ? sanitizedDiscoveryPrompt : null,
        platformUrls: Object.keys(sanitizedPlatformUrls).length > 0 ? sanitizedPlatformUrls : null,
        platforms: allowedPlatforms,
        isActive: true,
        // Schedule settings
        scheduleEnabled: scheduleEnabled === true,
        scheduleStartHour: typeof scheduleStartHour === "number" ? scheduleStartHour : 9,
        scheduleEndHour: typeof scheduleEndHour === "number" ? scheduleEndHour : 17,
        scheduleDays: Array.isArray(scheduleDays) ? scheduleDays : null,
        scheduleTimezone: typeof scheduleTimezone === "string" ? scheduleTimezone : "America/New_York",
      })
      .returning();

    // Track monitor creation with platform analytics
    captureEvent({
      distinctId: userId,
      event: "monitor_created",
      properties: {
        monitorId: newMonitor.id,
        plan,
        monitorType: sanitizedMonitorType,
        platformCount: allowedPlatforms.length,
        platforms: allowedPlatforms,
        keywordCount: sanitizedKeywords.length,
        hasSearchQuery: !!sanitizedSearchQuery,
        hasDiscoveryPrompt: !!sanitizedDiscoveryPrompt,
        isAiDiscovery: sanitizedMonitorType === "ai_discovery",
        // Track new platforms specifically
        hasIndieHackers: allowedPlatforms.includes("indiehackers"),
        hasGitHub: allowedPlatforms.includes("github"),
        hasDevTo: allowedPlatforms.includes("devto"),
        hasHashnode: allowedPlatforms.includes("hashnode"),
      },
    });

    // Revalidate cache
    revalidateTag("monitors");

    return NextResponse.json({
      monitor: newMonitor,
      ...(filteredOut.length > 0 && {
        warning: `Some platforms (${filteredOut.join(", ")}) are not available on your plan and were not included.`,
      }),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    const { logger } = await import("@/lib/logger");
    logger.error("Error creating monitor", { error: error instanceof Error ? error.message : String(error) });
    logError({ source: "api", message: "Failed to create monitor", error, endpoint: "POST /api/monitors" });
    return NextResponse.json({ error: "Failed to create monitor" }, { status: 500 });
  }
}
