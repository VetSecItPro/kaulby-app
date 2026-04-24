import { getEffectiveUserId } from "@/lib/dev-auth";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  checkKeywordsLimit,
  getUserPlan,
  filterAllowedPlatforms,
  getUpgradePrompt,
} from "@/lib/limits";
import { Platform, ALL_PLATFORMS } from "@/lib/plans";
import { sanitizeMonitorInput, isValidKeyword } from "@/lib/security";
import { logError } from "@/lib/error-logger";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Accept "owner/repo" format, or null to clear. "/" embedded once is the only
// structural check — the real validation happens when GitHub sends a webhook
// (invalid repo = no matching payload, silent no-op).
const githubRepoRegex = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const updateMonitorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  companyName: z.string().min(1).max(200).optional(),
  keywords: z.array(z.string().max(200)).optional(),
  platforms: z.array(z.string()).min(1).optional(),
  platformUrls: z.record(z.string(), z.string().max(500)).optional(),
  isActive: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleStartHour: z.number().int().min(0).max(23).optional(),
  scheduleEndHour: z.number().int().min(0).max(23).optional(),
  scheduleDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  scheduleTimezone: z.string().max(100).optional(),
  // COA 4 W2.5: real-time GitHub webhook registration (repo only — the
  // secret is managed via POST /api/monitors/[id]/github-webhook/rotate
  // so callers can't accidentally set a weak/chosen value, and so we can
  // show the secret ONCE at generation time).
  githubRepoFullName: z
    .string()
    .regex(githubRepoRegex, "Expected format: owner/repo")
    .max(200)
    .nullable()
    .optional(),
});

/** Sanitize platform URLs — allow https:// URLs and Google Place IDs */
function sanitizePlatformUrls(platformUrls: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [platform, url] of Object.entries(platformUrls)) {
    const trimmed = url.trim();
    if (trimmed && (trimmed.startsWith("https://") || trimmed.startsWith("ChI"))) {
      sanitized[platform] = trimmed.slice(0, 500);
    }
  }
  return sanitized;
}

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getEffectiveUserId();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check for read
    const rateLimit = await checkApiRateLimit(userId, 'read');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // COA 4 W2.5: never return the raw GitHub webhook secret in the monitor
    // payload — it's shown ONCE at generation via the rotate endpoint and
    // never again. The UI uses the boolean to decide whether to render
    // "generate" vs "rotate" controls.
    const { githubWebhookSecret, ...monitorSafe } = monitor;
    const sanitized = {
      ...monitorSafe,
      githubWebhookSecretConfigured: Boolean(githubWebhookSecret),
    };

    // SECURITY: No-cache on sensitive data — FIX-006
    return NextResponse.json({ monitor: sanitized }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (error) {
    logger.error("Error fetching monitor:", { error: error instanceof Error ? error.message : String(error) });
    logError({ source: "api", message: "Failed to fetch monitor", error, endpoint: "GET /api/monitors/[id]" });
    return NextResponse.json({ error: "Failed to fetch monitor" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getEffectiveUserId();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check for write
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Check ownership
    const existing = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    const body = await parseJsonBody(request);

    const parsed = updateMonitorSchema.safeParse(body);
    if (!parsed.success) {
      // SEC-API-002: Don't leak schema details in response; log server-side instead
      logger.warn("[PATCH /api/monitors/[id]] Invalid input", { error: parsed.error.flatten() });
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }
    const { name, companyName, keywords, platforms, platformUrls, isActive,
      scheduleEnabled, scheduleStartHour, scheduleEndHour, scheduleDays, scheduleTimezone,
      githubRepoFullName } = parsed.data;

    // Validate platforms against canonical list
    if (platforms) {
      const invalidPlatforms = platforms.filter((p: string) => !ALL_PLATFORMS.includes(p as Platform));
      if (invalidPlatforms.length > 0) {
        return NextResponse.json({ error: `Invalid platforms: ${invalidPlatforms.join(", ")}` }, { status: 400 });
      }
    }

    // Sanitize name if provided
    const sanitizedName = name !== undefined ? sanitizeMonitorInput(name) : undefined;
    if (name !== undefined && (!sanitizedName || sanitizedName.length === 0)) {
      return NextResponse.json({ error: "Invalid name after sanitization" }, { status: 400 });
    }

    // Sanitize company name if provided
    const sanitizedCompanyName = companyName !== undefined ? sanitizeMonitorInput(companyName) : undefined;
    if (companyName !== undefined && (!sanitizedCompanyName || sanitizedCompanyName.length === 0)) {
      return NextResponse.json({ error: "Invalid company name after sanitization" }, { status: 400 });
    }

    // Sanitize keywords if provided (keywords are now optional)
    const sanitizedKeywords: string[] | undefined = keywords
      ? keywords
          .map((k) => sanitizeMonitorInput(k))
          .filter((k) => isValidKeyword(k))
      : undefined;

    // Get user's plan for limit checks
    const plan = await getUserPlan(userId);

    // Check keywords limit if updating keywords (and keywords are not empty)
    if (sanitizedKeywords && sanitizedKeywords.length > 0) {
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

    // Filter platforms if updating
    let finalPlatforms = existing.platforms;
    let platformWarning: string | undefined;

    if (platforms) {
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

      const filteredOut = platforms.filter((p: string) => !allowedPlatforms.includes(p as Platform));
      if (filteredOut.length > 0) {
        platformWarning = `Some platforms (${filteredOut.join(", ")}) are not available on your plan and were not included.`;
      }

      finalPlatforms = allowedPlatforms;
    }

    // Update monitor with sanitized values
    const [updatedMonitor] = await db
      .update(monitors)
      .set({
        ...(sanitizedName !== undefined && { name: sanitizedName }),
        ...(sanitizedCompanyName !== undefined && { companyName: sanitizedCompanyName }),
        ...(sanitizedKeywords !== undefined && { keywords: sanitizedKeywords }),
        ...(platforms !== undefined && { platforms: finalPlatforms }),
        ...(isActive !== undefined && { isActive }),
        // Schedule settings (types guaranteed by Zod)
        ...(scheduleEnabled !== undefined && { scheduleEnabled }),
        ...(scheduleStartHour !== undefined && { scheduleStartHour }),
        ...(scheduleEndHour !== undefined && { scheduleEndHour }),
        ...(scheduleDays !== undefined && { scheduleDays }),
        ...(scheduleTimezone !== undefined && { scheduleTimezone }),
        ...(platformUrls !== undefined && {
          platformUrls: Object.keys(sanitizePlatformUrls(platformUrls)).length > 0
            ? sanitizePlatformUrls(platformUrls)
            : null,
        }),
        // COA 4 W2.5: GitHub repo binding. Changing the repo DOES NOT clear
        // the secret — user rotates explicitly via the rotate endpoint if
        // they want to invalidate the old secret.
        ...(githubRepoFullName !== undefined && { githubRepoFullName }),
        updatedAt: new Date(),
      })
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)))
      .returning();

    // Revalidate cache
    revalidateTag("monitors");

    return NextResponse.json({
      monitor: updatedMonitor,
      ...(platformWarning && { warning: platformWarning }),
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    logger.error("Error updating monitor:", { error: error instanceof Error ? error.message : String(error) });
    logError({ source: "api", message: "Failed to update monitor", error, endpoint: "PATCH /api/monitors/[id]" });
    return NextResponse.json({ error: "Failed to update monitor" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getEffectiveUserId();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check for write
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Check ownership
    const existing = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // Delete monitor (cascade will delete results and alerts)
    await db.delete(monitors).where(and(eq(monitors.id, id), eq(monitors.userId, userId)));

    // Revalidate cache
    revalidateTag("monitors");
    revalidateTag("results");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting monitor:", { error: error instanceof Error ? error.message : String(error) });
    logError({ source: "api", message: "Failed to delete monitor", error, endpoint: "DELETE /api/monitors/[id]" });
    return NextResponse.json({ error: "Failed to delete monitor" }, { status: 500 });
  }
}
