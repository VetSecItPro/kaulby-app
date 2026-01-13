import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, params.id), eq(monitors.userId, userId)),
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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check ownership
    const existing = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, params.id), eq(monitors.userId, userId)),
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
      const validPlatforms = ["reddit", "hackernews", "producthunt"];
      const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        return NextResponse.json({ error: `Invalid platforms: ${invalidPlatforms.join(", ")}` }, { status: 400 });
      }
    }

    // Update monitor
    const [updatedMonitor] = await db
      .update(monitors)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(keywords !== undefined && { keywords }),
        ...(platforms !== undefined && { platforms }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, params.id))
      .returning();

    return NextResponse.json({ monitor: updatedMonitor });
  } catch (error) {
    console.error("Error updating monitor:", error);
    return NextResponse.json({ error: "Failed to update monitor" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check ownership
    const existing = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, params.id), eq(monitors.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // Delete monitor (cascade will delete results and alerts)
    await db.delete(monitors).where(eq(monitors.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting monitor:", error);
    return NextResponse.json({ error: "Failed to delete monitor" }, { status: 500 });
  }
}
