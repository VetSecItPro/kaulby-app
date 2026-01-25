import { auth } from "@clerk/nextjs/server";
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
import { Platform } from "@/lib/plans";

export const dynamic = "force-dynamic";

// All valid platforms (12 total - must match POST route, devto deprecated)
const VALID_PLATFORMS = ["reddit", "hackernews", "producthunt", "googlereviews", "trustpilot", "appstore", "playstore", "quora", "youtube", "g2", "yelp", "amazonreviews"];

// Sanitize user input to prevent XSS and injection attacks
function sanitizeInput(input: string): string {
  return input
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove script injection attempts
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    // Remove null bytes
    .replace(/\0/g, "")
    // Limit length to 100 characters
    .slice(0, 100);
}

// Validate keyword format
function isValidKeyword(keyword: string): boolean {
  const sanitized = sanitizeInput(keyword);
  return sanitized.length >= 1 && sanitized.length <= 100;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    return NextResponse.json({ monitor });
  } catch (error) {
    console.error("Error fetching monitor:", error);
    return NextResponse.json({ error: "Failed to fetch monitor" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check ownership
    const existing = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, companyName, keywords, platforms, isActive,
      scheduleEnabled, scheduleStartHour, scheduleEndHour, scheduleDays, scheduleTimezone } = body;

    // Validate input
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    if (companyName !== undefined && (typeof companyName !== "string" || !companyName.trim())) {
      return NextResponse.json({ error: "Invalid company name" }, { status: 400 });
    }

    // Keywords are now optional
    if (keywords !== undefined && !Array.isArray(keywords)) {
      return NextResponse.json({ error: "Keywords must be an array" }, { status: 400 });
    }

    if (platforms !== undefined && (!Array.isArray(platforms) || platforms.length === 0)) {
      return NextResponse.json({ error: "At least one platform is required" }, { status: 400 });
    }

    // Validate platforms
    if (platforms) {
      const invalidPlatforms = platforms.filter((p: string) => !VALID_PLATFORMS.includes(p));
      if (invalidPlatforms.length > 0) {
        return NextResponse.json({ error: `Invalid platforms: ${invalidPlatforms.join(", ")}` }, { status: 400 });
      }
    }

    // Sanitize name if provided
    const sanitizedName = name !== undefined ? sanitizeInput(name) : undefined;
    if (name !== undefined && (!sanitizedName || sanitizedName.length === 0)) {
      return NextResponse.json({ error: "Invalid name after sanitization" }, { status: 400 });
    }

    // Sanitize company name if provided
    const sanitizedCompanyName = companyName !== undefined ? sanitizeInput(companyName) : undefined;
    if (companyName !== undefined && (!sanitizedCompanyName || sanitizedCompanyName.length === 0)) {
      return NextResponse.json({ error: "Invalid company name after sanitization" }, { status: 400 });
    }

    // Sanitize keywords if provided (keywords are now optional)
    const sanitizedKeywords: string[] | undefined = keywords
      ? keywords
          .map((k: string) => (typeof k === "string" ? sanitizeInput(k) : ""))
          .filter((k: string) => isValidKeyword(k))
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
        const prompt = getUpgradePrompt(plan, "platform", platforms[0]);
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
        // Schedule settings
        ...(scheduleEnabled !== undefined && { scheduleEnabled: scheduleEnabled === true }),
        ...(scheduleStartHour !== undefined && typeof scheduleStartHour === "number" && { scheduleStartHour }),
        ...(scheduleEndHour !== undefined && typeof scheduleEndHour === "number" && { scheduleEndHour }),
        ...(scheduleDays !== undefined && { scheduleDays: Array.isArray(scheduleDays) ? scheduleDays : null }),
        ...(scheduleTimezone !== undefined && typeof scheduleTimezone === "string" && { scheduleTimezone }),
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, id))
      .returning();

    // Revalidate cache
    revalidateTag("monitors");

    return NextResponse.json({
      monitor: updatedMonitor,
      ...(platformWarning && { warning: platformWarning }),
    });
  } catch (error) {
    console.error("Error updating monitor:", error);
    return NextResponse.json({ error: "Failed to update monitor" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check ownership
    const existing = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // Delete monitor (cascade will delete results and alerts)
    await db.delete(monitors).where(eq(monitors.id, id));

    // Revalidate cache
    revalidateTag("monitors");
    revalidateTag("results");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting monitor:", error);
    return NextResponse.json({ error: "Failed to delete monitor" }, { status: 500 });
  }
}
