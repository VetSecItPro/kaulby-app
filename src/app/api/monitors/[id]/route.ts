import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  checkKeywordsLimit,
  getUserPlan,
  filterAllowedPlatforms,
  getUpgradePrompt,
} from "@/lib/limits";
import { Platform } from "@/lib/stripe";

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
    const { name, keywords, platforms, isActive } = body;

    // Validate input
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    if (keywords !== undefined && (!Array.isArray(keywords) || keywords.length === 0)) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }

    if (platforms !== undefined && (!Array.isArray(platforms) || platforms.length === 0)) {
      return NextResponse.json({ error: "At least one platform is required" }, { status: 400 });
    }

    // Validate platforms
    if (platforms) {
      const validPlatforms = ["reddit", "hackernews", "producthunt", "devto"];
      const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        return NextResponse.json({ error: `Invalid platforms: ${invalidPlatforms.join(", ")}` }, { status: 400 });
      }
    }

    // Get user's plan for limit checks
    const plan = await getUserPlan(userId);

    // Check keywords limit if updating keywords
    if (keywords) {
      const keywordCheck = checkKeywordsLimit(keywords, plan);
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

    // Update monitor
    const [updatedMonitor] = await db
      .update(monitors)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(keywords !== undefined && { keywords }),
        ...(platforms !== undefined && { platforms: finalPlatforms }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, id))
      .returning();

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting monitor:", error);
    return NextResponse.json({ error: "Failed to delete monitor" }, { status: 500 });
  }
}
