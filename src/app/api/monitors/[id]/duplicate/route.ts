import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canCreateMonitor } from "@/lib/limits";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if user can create another monitor
    const canCreate = await canCreateMonitor(userId);
    if (!canCreate.allowed) {
      return NextResponse.json(
        { error: canCreate.message || "Monitor limit reached" },
        { status: 403 }
      );
    }

    // Get the original monitor
    const originalMonitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!originalMonitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // Create duplicate with "(Copy)" suffix
    const [newMonitor] = await db
      .insert(monitors)
      .values({
        userId,
        name: `${originalMonitor.name} (Copy)`,
        companyName: originalMonitor.companyName,
        keywords: originalMonitor.keywords,
        platforms: originalMonitor.platforms,
        searchQuery: originalMonitor.searchQuery,
        platformUrls: originalMonitor.platformUrls,
        isActive: false, // Start paused
        monitorType: originalMonitor.monitorType,
        discoveryPrompt: originalMonitor.discoveryPrompt,
      })
      .returning();

    revalidateTag("monitors");

    return NextResponse.json({
      id: newMonitor.id,
      message: "Monitor duplicated successfully",
    });
  } catch (error) {
    console.error("Error duplicating monitor:", error);
    return NextResponse.json(
      { error: "Failed to duplicate monitor" },
      { status: 500 }
    );
  }
}
