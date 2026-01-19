import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db, audiences, audienceMonitors, monitors } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const addMonitorSchema = z.object({
  monitorId: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/audiences/[id]/monitors
 * Add a monitor to an audience
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: audienceId } = await params;
    const body = await request.json();
    const parsed = addMonitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { monitorId } = parsed.data;

    // Verify audience ownership
    const audience = await db.query.audiences.findFirst({
      where: and(eq(audiences.id, audienceId), eq(audiences.userId, userId)),
    });

    if (!audience) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 });
    }

    // Verify monitor ownership
    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, monitorId), eq(monitors.userId, userId)),
    });

    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // Check if already added
    const existing = await db.query.audienceMonitors.findFirst({
      where: and(
        eq(audienceMonitors.audienceId, audienceId),
        eq(audienceMonitors.monitorId, monitorId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: "Monitor already in audience" },
        { status: 409 }
      );
    }

    // Add monitor to audience
    await db.insert(audienceMonitors).values({
      audienceId,
      monitorId,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to add monitor to audience:", error);
    return NextResponse.json(
      { error: "Failed to add monitor to audience" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/audiences/[id]/monitors
 * Remove a monitor from an audience
 * Body: { monitorId: string }
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: audienceId } = await params;
    const body = await request.json();
    const parsed = addMonitorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { monitorId } = parsed.data;

    // Verify audience ownership
    const audience = await db.query.audiences.findFirst({
      where: and(eq(audiences.id, audienceId), eq(audiences.userId, userId)),
    });

    if (!audience) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 });
    }

    // Remove monitor from audience
    await db
      .delete(audienceMonitors)
      .where(
        and(
          eq(audienceMonitors.audienceId, audienceId),
          eq(audienceMonitors.monitorId, monitorId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove monitor from audience:", error);
    return NextResponse.json(
      { error: "Failed to remove monitor from audience" },
      { status: 500 }
    );
  }
}
