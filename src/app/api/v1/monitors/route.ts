import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { Platform, ALL_PLATFORMS } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/monitors - List all monitors for the authenticated user
 *
 * Query params:
 *   - limit: number (default 50, max 100)
 *   - offset: number (default 0)
 *   - active: boolean (filter by active status)
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (userId) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
      const offset = parseInt(searchParams.get("offset") || "0");
      const activeFilter = searchParams.get("active");

      // Build query
      const monitorsList = await db
        .select({
          id: monitors.id,
          name: monitors.name,
          keywords: monitors.keywords,
          platforms: monitors.platforms,
          isActive: monitors.isActive,
          lastCheckedAt: monitors.lastCheckedAt,
          newMatchCount: monitors.newMatchCount,
          createdAt: monitors.createdAt,
          updatedAt: monitors.updatedAt,
        })
        .from(monitors)
        .where(eq(monitors.userId, userId))
        .orderBy(desc(monitors.createdAt))
        .limit(limit)
        .offset(offset);

      // Filter by active if specified
      const filteredMonitors = activeFilter !== null
        ? monitorsList.filter(m => m.isActive === (activeFilter === "true"))
        : monitorsList;

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(monitors)
        .where(eq(monitors.userId, userId));

      return NextResponse.json({
        monitors: filteredMonitors,
        pagination: {
          total: totalResult?.count || 0,
          limit,
          offset,
        },
      });
    } catch (error) {
      console.error("API v1 monitors error:", error);
      return NextResponse.json(
        { error: "Failed to fetch monitors" },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/v1/monitors - Create a new monitor
 *
 * Body:
 *   - name: string (required)
 *   - keywords: string[] (required)
 *   - platforms: string[] (required, valid platforms)
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (userId) => {
    try {
      const body = await request.json();
      const { name, keywords, platforms: platformsList } = body;

      // Validation
      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      if (!Array.isArray(keywords) || keywords.length === 0) {
        return NextResponse.json(
          { error: "At least one keyword is required" },
          { status: 400 }
        );
      }

      if (!Array.isArray(platformsList) || platformsList.length === 0) {
        return NextResponse.json(
          { error: "At least one platform is required" },
          { status: 400 }
        );
      }

      // Validate platforms against canonical list from plans.ts
      const invalidPlatforms = platformsList.filter(p => !ALL_PLATFORMS.includes(p as Platform));
      if (invalidPlatforms.length > 0) {
        return NextResponse.json(
          { error: `Invalid platforms: ${invalidPlatforms.join(", ")}` },
          { status: 400 }
        );
      }

      // Create monitor
      const [newMonitor] = await db
        .insert(monitors)
        .values({
          userId,
          name,
          keywords,
          platforms: platformsList,
          isActive: true,
        })
        .returning();

      return NextResponse.json({
        monitor: {
          id: newMonitor.id,
          name: newMonitor.name,
          keywords: newMonitor.keywords,
          platforms: newMonitor.platforms,
          isActive: newMonitor.isActive,
          createdAt: newMonitor.createdAt,
        },
      }, { status: 201 });
    } catch (error) {
      console.error("API v1 create monitor error:", error);
      return NextResponse.json(
        { error: "Failed to create monitor" },
        { status: 500 }
      );
    }
  });
}
