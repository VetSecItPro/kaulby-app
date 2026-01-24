import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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
import { Platform } from "@/lib/plans";
import { captureEvent } from "@/lib/posthog";

export const dynamic = "force-dynamic";

// In development, ensure user exists in database
async function ensureDevUserExists(userId: string): Promise<void> {
  const isLocalDev = process.env.NODE_ENV === "development" &&
                     !process.env.VERCEL &&
                     !process.env.VERCEL_ENV;

  if (!isLocalDev) return;

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });

  if (existingUser) return;

  // Get user info from Clerk
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress || `dev-${userId}@localhost`;
  const name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || "Dev User";

  // Create dev user
  await db.insert(users).values({
    id: userId,
    email,
    name,
    subscriptionStatus: "enterprise", // Give full access in dev mode
  }).onConflictDoNothing();
}

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

    // In dev mode, auto-create user if not exists
    await ensureDevUserExists(userId);

    const body = await request.json();
    const { name, companyName, keywords, searchQuery, platforms, platformUrls } = body;

    // Validate input
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!companyName || typeof companyName !== "string") {
      return NextResponse.json({ error: "Company/brand name is required" }, { status: 400 });
    }

    // Keywords are now optional - sanitize if provided
    const sanitizedKeywords = Array.isArray(keywords)
      ? keywords
          .map((k: string) => (typeof k === "string" ? sanitizeInput(k) : ""))
          .filter((k) => isValidKeyword(k))
      : [];

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: "At least one platform is required" }, { status: 400 });
    }

    // Validate platforms (16 total platforms)
    const validPlatforms = [
      "reddit", "hackernews", "producthunt", "devto",
      "googlereviews", "trustpilot", "appstore", "playstore",
      "quora", "youtube", "g2", "yelp", "amazonreviews",
      "indiehackers", "github", "hashnode"
    ];
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
            trimmedUrl.startsWith("http://") ||
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
        name: sanitizeInput(name),
        companyName: sanitizeInput(companyName),
        keywords: sanitizedKeywords,
        searchQuery: sanitizedSearchQuery,
        platformUrls: Object.keys(sanitizedPlatformUrls).length > 0 ? sanitizedPlatformUrls : null,
        platforms: allowedPlatforms,
        isActive: true,
      })
      .returning();

    // Track monitor creation with platform analytics
    captureEvent({
      distinctId: userId,
      event: "monitor_created",
      properties: {
        monitorId: newMonitor.id,
        plan,
        platformCount: allowedPlatforms.length,
        platforms: allowedPlatforms,
        keywordCount: sanitizedKeywords.length,
        hasSearchQuery: !!sanitizedSearchQuery,
        // Track new platforms specifically
        hasIndieHackers: allowedPlatforms.includes("indiehackers"),
        hasGitHub: allowedPlatforms.includes("github"),
        hasDevTo: allowedPlatforms.includes("devto"),
        hasHashnode: allowedPlatforms.includes("hashnode"),
      },
    });

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
