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

export const dynamic = "force-dynamic";

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

    // In dev mode, auto-create user if not exists
    await ensureDevUserExists(userId);

    const body = await request.json();
    const { name, companyName, keywords, searchQuery, platforms, platformUrls,
      scheduleEnabled, scheduleStartHour, scheduleEndHour, scheduleDays, scheduleTimezone,
      monitorType, discoveryPrompt } = body;

    // Validate input
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!companyName || typeof companyName !== "string") {
      return NextResponse.json({ error: "Company/brand name is required" }, { status: 400 });
    }

    // Validate monitor type (defaults to "keyword" for backwards compatibility)
    const validMonitorTypes = ["keyword", "ai_discovery"];
    const sanitizedMonitorType = validMonitorTypes.includes(monitorType) ? monitorType : "keyword";

    // Validate AI Discovery mode requirements
    if (sanitizedMonitorType === "ai_discovery") {
      if (!discoveryPrompt || typeof discoveryPrompt !== "string" || !discoveryPrompt.trim()) {
        return NextResponse.json(
          { error: "Discovery prompt is required for AI Discovery mode" },
          { status: 400 }
        );
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
      return NextResponse.json({ error: "At least one platform is required" }, { status: 400 });
    }

    // Validate platforms against canonical list from plans.ts
    const invalidPlatforms = platforms.filter((p: string) => !ALL_PLATFORMS.includes(p as Platform));
    if (invalidPlatforms.length > 0) {
      return NextResponse.json({ error: `Invalid platforms: ${invalidPlatforms.join(", ")}` }, { status: 400 });
    }

    // Get user's plan
    const plan = await getUserPlan(userId);

    // Check monitor limit
    const monitorCheck = await canCreateMonitor(userId);
    if (!monitorCheck.allowed) {
      const prompt = getUpgradePrompt(plan, "monitors");
      return NextResponse.json(
        {
          error: monitorCheck.message,
          upgradePrompt: prompt,
          current: monitorCheck.current,
          limit: monitorCheck.limit,
        },
        { status: 403 }
      );
    }

    // Check keywords limit (only if keywords provided)
    if (sanitizedKeywords.length > 0) {
      const keywordCheck = checkKeywordsLimit(sanitizedKeywords, plan);
      if (!keywordCheck.allowed) {
        const prompt = getUpgradePrompt(plan, "keywords");
        return NextResponse.json(
          {
            error: keywordCheck.message,
            upgradePrompt: prompt,
            current: keywordCheck.current,
            limit: keywordCheck.limit,
          },
          { status: 403 }
        );
      }
    }

    // Filter platforms to only allowed ones for user's plan
    const allowedPlatforms = await filterAllowedPlatforms(userId, platforms as Platform[]);

    if (allowedPlatforms.length === 0) {
      const prompt = getUpgradePrompt(plan, "platform", { platformName: platforms[0] });
      return NextResponse.json(
        {
          error: `Your plan doesn't have access to ${platforms.join(", ")}. ${prompt.description}`,
          upgradePrompt: prompt,
        },
        { status: 403 }
      );
    }

    // Warn if some platforms were filtered out
    const filteredOut = platforms.filter((p: string) => !allowedPlatforms.includes(p as Platform));

    // Sanitize search query if provided (Pro feature)
    const sanitizedSearchQuery = searchQuery && typeof searchQuery === "string"
      ? searchQuery.trim().slice(0, 500) // Max 500 chars for search query
      : undefined;

    // Sanitize platform URLs if provided
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
    console.error("Error creating monitor:", error);
    logError({ source: "api", message: "Failed to create monitor", error, endpoint: "POST /api/monitors" });
    return NextResponse.json({ error: "Failed to create monitor" }, { status: 500 });
  }
}

