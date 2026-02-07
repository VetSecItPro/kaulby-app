import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canTriggerManualScan, getManualScanCooldown } from "@/lib/limits";
import { inngest } from "@/lib/inngest";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/monitors/[id]/scan
 * Trigger an on-demand scan for a specific monitor
 *
 * Rate limiting:
 * - Free: 1 scan/day with 24hr cooldown
 * - Pro: 3 scans/day with 4hr cooldown
 * - Enterprise: 12 scans/day with 1hr cooldown
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Get the monitor and verify ownership
    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // Check if monitor is active
    if (!monitor.isActive) {
      return NextResponse.json(
        { error: "Cannot scan inactive monitor" },
        { status: 400 }
      );
    }

    // Check if already scanning
    if (monitor.isScanning) {
      return NextResponse.json(
        { error: "Scan already in progress", isScanning: true },
        { status: 409 }
      );
    }

    // Check rate limiting
    const cooldownCheck = await canTriggerManualScan(userId, monitor.lastManualScanAt);

    if (!cooldownCheck.canScan) {
      const cooldownHours = await getManualScanCooldown(userId);
      return NextResponse.json(
        {
          error: cooldownCheck.reason,
          cooldownRemaining: cooldownCheck.cooldownRemaining,
          nextScanAt: cooldownCheck.nextScanAt?.toISOString(),
          cooldownHours,
        },
        { status: 429 }
      );
    }

    // Trigger the on-demand scan via Inngest
    await inngest.send({
      name: "monitor/scan-now",
      data: {
        monitorId: id,
        userId,
      },
    });

    // Optimistically mark as scanning (Inngest will also do this, but this gives faster UI feedback)
    await db
      .update(monitors)
      .set({ isScanning: true })
      .where(eq(monitors.id, id));

    revalidateTag("monitors");

    return NextResponse.json({
      success: true,
      message: "Scan started",
      monitorId: id,
    });
  } catch (error) {
    console.error("Error starting scan:", error);
    return NextResponse.json(
      { error: "Failed to start scan" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/monitors/[id]/scan
 * Get the current scan status for a monitor
 */
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

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'read');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Get the monitor and verify ownership
    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
      columns: {
        id: true,
        isScanning: true,
        lastManualScanAt: true,
        lastCheckedAt: true,
        newMatchCount: true,
      },
    });

    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    // Check if user can trigger another scan
    const cooldownCheck = await canTriggerManualScan(userId, monitor.lastManualScanAt);
    const cooldownHours = await getManualScanCooldown(userId);

    return NextResponse.json({
      isScanning: monitor.isScanning,
      lastManualScanAt: monitor.lastManualScanAt?.toISOString() || null,
      lastCheckedAt: monitor.lastCheckedAt?.toISOString() || null,
      newMatchCount: monitor.newMatchCount,
      canScan: cooldownCheck.canScan,
      cooldownRemaining: cooldownCheck.cooldownRemaining,
      nextScanAt: cooldownCheck.nextScanAt?.toISOString() || null,
      cooldownHours,
    });
  } catch (error) {
    console.error("Error getting scan status:", error);
    return NextResponse.json(
      { error: "Failed to get scan status" },
      { status: 500 }
    );
  }
}
