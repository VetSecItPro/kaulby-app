import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  canCreateMonitor,
  checkKeywordsLimit,
  getUserPlan,
  filterAllowedPlatforms,
  getUpgradePrompt,
} from "@/lib/limits";
import { Platform } from "@/lib/stripe";

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
  // Must be 1-100 chars, no empty after sanitization
  return sanitized.length >= 1 && sanitized.length <= 100;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, keywords, platforms } = body;

    // Validate input
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }

    // Sanitize and validate keywords
    const sanitizedKeywords = keywords
      .map((k: string) => (typeof k === "string" ? sanitizeInput(k) : ""))
      .filter((k) => isValidKeyword(k));

    if (sanitizedKeywords.length === 0) {
      return NextResponse.json({ error: "No valid keywords provided" }, { status: 400 });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: "At least one platform is required" }, { status: 400 });
    }

    // Validate platforms
    const validPlatforms = ["reddit", "hackernews", "producthunt", "devto", "googlereviews", "trustpilot", "appstore", "playstore", "quora"];
    const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p));
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

    // Check keywords limit
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

    // Filter platforms to only allowed ones for user's plan
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

    // Warn if some platforms were filtered out
    const filteredOut = platforms.filter((p: string) => !allowedPlatforms.includes(p as Platform));

    // Create monitor with allowed platforms only
    const [newMonitor] = await db
      .insert(monitors)
      .values({
        userId,
        name: sanitizeInput(name),
        keywords: sanitizedKeywords,
        platforms: allowedPlatforms,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      monitor: newMonitor,
      ...(filteredOut.length > 0 && {
        warning: `Some platforms (${filteredOut.join(", ")}) are not available on your plan and were not included.`,
      }),
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating monitor:", error);
    return NextResponse.json({ error: "Failed to create monitor" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      orderBy: (monitors, { desc }) => [desc(monitors.createdAt)],
    });

    return NextResponse.json({ monitors: userMonitors });
  } catch (error) {
    console.error("Error fetching monitors:", error);
    return NextResponse.json({ error: "Failed to fetch monitors" }, { status: 500 });
  }
}
