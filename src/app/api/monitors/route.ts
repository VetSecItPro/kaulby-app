import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { monitors, users } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import {
  canCreateMonitor,
  checkKeywordsLimit,
  getUserPlan,
  filterAllowedPlatforms,
  getUpgradePrompt,
} from "@/lib/limits";
import { Platform, ALL_PLATFORMS, getPlanLimits } from "@/lib/plans";
import { sanitizeMonitorInput, isValidKeyword } from "@/lib/security";
import { captureEvent } from "@/lib/posthog";
import { logError } from "@/lib/error-logger";
import { getEffectiveUserId, verifyUserInDb, isLocalDev as checkIsLocalDev } from "@/lib/dev-auth";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
    });

    return NextResponse.json(
      { monitors: userMonitors },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    logError({ source: "api", message: "Failed to list monitors", error, endpoint: "GET /api/monitors" });
    return NextResponse.json({ error: "Failed to list monitors" }, { status: 500 });
  }
}


const createMonitorSchema = z.object({
  name: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  keywords: z.array(z.string().max(200)).optional().default([]),
  monitorType: z.enum(["keyword", "ai_discovery"]).optional().default("keyword"),
  discoveryPrompt: z.string().max(1000).optional(),
  platforms: z.array(z.string()).min(1, "At least one platform is required"),
  platformUrls: z.record(z.string(), z.string().max(500)).optional().default({}),
  searchQuery: z.string().max(500).optional(),
  scheduleEnabled: z.boolean().optional().default(false),
  scheduleStartHour: z.number().int().min(0).max(23).optional().default(9),
  scheduleEndHour: z.number().int().min(0).max(23).optional().default(17),
  scheduleDays: z.array(z.number().int().min(0).max(6)).optional(),
  scheduleTimezone: z.string().max(100).optional().default("America/New_York"),
});

/** Validate Zod-parsed monitor input and apply sanitization */
function sanitizeMonitorFields(data: z.infer<typeof createMonitorSchema>) {
  // Validate AI Discovery mode requirements
  if (data.monitorType === "ai_discovery") {
    if (!data.discoveryPrompt?.trim()) {
      return {
        error: "Discovery prompt is required for AI Discovery mode",
        status: 400,
      };
    }
  }

  // Sanitize discovery prompt if provided
  const sanitizedDiscoveryPrompt = data.discoveryPrompt?.trim() || null;

  // Sanitize keywords
  const sanitizedKeywords = data.keywords
    .map((k) => sanitizeMonitorInput(k))
    .filter((k) => isValidKeyword(k));

  // Validate platforms against canonical list from plans.ts
  const invalidPlatforms = data.platforms.filter((p) => !ALL_PLATFORMS.includes(p as Platform));
  if (invalidPlatforms.length > 0) {
    return { error: `Invalid platforms: ${invalidPlatforms.join(", ")}`, status: 400 };
  }

  return {
    sanitizedData: {
      sanitizedMonitorType: data.monitorType,
      sanitizedDiscoveryPrompt,
      sanitizedKeywords,
    },
  };
}

/** Check plan limits for monitor creation */
async function checkMonitorLimits(
  userId: string,
  plan: "free" | "pro" | "team",
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
function sanitizePlatformUrls(platformUrls: Record<string, string>): Record<string, string> {
  const sanitizedPlatformUrls: Record<string, string> = {};
  for (const [platform, url] of Object.entries(platformUrls)) {
    if (url.trim()) {
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
    subscriptionStatus: "team", // Give full access in dev mode
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

    // Verify user exists in DB (handles Clerk ID mismatches)
    const dbUserId = await verifyUserInDb(userId);
    if (!dbUserId) {
      return NextResponse.json({ error: "User not found. Please sign out and sign back in." }, { status: 404 });
    }

    const body = await parseJsonBody(request, 51200); // 50KB limit for monitor creation

    const parsed = createMonitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, companyName, searchQuery, platforms, platformUrls,
      scheduleEnabled, scheduleStartHour, scheduleEndHour, scheduleDays, scheduleTimezone } = parsed.data;

    // Apply security sanitization on validated input
    const validationResult = sanitizeMonitorFields(parsed.data);
    if ("error" in validationResult) {
      return NextResponse.json({ error: validationResult.error }, { status: validationResult.status });
    }
    const { sanitizedMonitorType, sanitizedDiscoveryPrompt, sanitizedKeywords } = validationResult.sanitizedData;

    // Get user's plan (use dbUserId for DB lookups)
    const plan = await getUserPlan(dbUserId);

    // Check non-monitor limits first (keywords, platforms) — these don't need transaction protection
    // Check keywords limit (only if keywords provided)
    if (sanitizedKeywords.length > 0) {
      const keywordCheck = checkKeywordsLimit(sanitizedKeywords, plan);
      if (!keywordCheck.allowed) {
        const prompt = getUpgradePrompt(plan, "keywords");
        return NextResponse.json(
          {
            error: keywordCheck.message,
            upgradePrompt: prompt,
            ...(keywordCheck.current !== undefined && { current: keywordCheck.current }),
            ...(keywordCheck.limit !== undefined && { limit: keywordCheck.limit }),
          },
          { status: 403 }
        );
      }
    }

    // Filter platforms to only allowed ones for user's plan
    const allowedPlatforms = await filterAllowedPlatforms(dbUserId, platforms as Platform[]);
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
    const filteredOut = platforms.filter((p: string) => !allowedPlatforms.includes(p as Platform));

    // Sanitize search query if provided (Pro feature)
    const sanitizedSearchQuery = searchQuery && typeof searchQuery === "string"
      ? searchQuery.trim().slice(0, 500) // Max 500 chars for search query
      : undefined;

    // Sanitize platform URLs if provided
    const sanitizedPlatformUrls = sanitizePlatformUrls(platformUrls);

    // SEC-BIZ-04: Wrap monitor count check + INSERT in a transaction to prevent
    // race conditions where concurrent requests bypass the monitor limit.
    const planLimits = getPlanLimits(plan);
    const newMonitor = await db.transaction(async (tx) => {
      // Re-check monitor count inside transaction for atomicity
      if (planLimits.monitors !== -1) {
        const [result] = await tx
          .select({ count: count() })
          .from(monitors)
          .where(eq(monitors.userId, dbUserId));

        const currentCount = result?.count || 0;
        if (currentCount >= planLimits.monitors) {
          throw new Error(
            `MONITOR_LIMIT:You've reached your limit of ${planLimits.monitors} monitor${planLimits.monitors === 1 ? "" : "s"}. Upgrade to Pro for more.`
          );
        }
      }

      // Insert inside same transaction
      const [created] = await tx
        .insert(monitors)
        .values({
          userId: dbUserId,
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

      return created;
    });

    // Trigger instant lightweight scan so the user sees first results fast,
    // then queue the full scan for comprehensive coverage
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send([
      {
        name: "monitor/scan.requested",
        data: { monitorId: newMonitor.id, userId: dbUserId },
      },
      {
        name: "monitor/scan-now",
        data: { monitorId: newMonitor.id, userId: dbUserId },
      },
    ]);
    await db.update(monitors).set({ isScanning: true }).where(eq(monitors.id, newMonitor.id));

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
    // Handle monitor limit exceeded from transaction
    if (error instanceof Error && error.message.startsWith("MONITOR_LIMIT:")) {
      const message = error.message.replace("MONITOR_LIMIT:", "");
      return NextResponse.json({ error: message }, { status: 403 });
    }
    const { logger } = await import("@/lib/logger");
    logger.error("Error creating monitor", { error: error instanceof Error ? error.message : String(error) });
    logError({ source: "api", message: "Failed to create monitor", error, endpoint: "POST /api/monitors" });
    return NextResponse.json({ error: "Failed to create monitor" }, { status: 500 });
  }
}
