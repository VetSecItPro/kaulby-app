import { getEffectiveUserId } from "@/lib/dev-auth";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canTriggerManualScan, getManualScanCooldown } from "@/lib/limits";
import { inngest } from "@/lib/inngest";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

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
    const userId = await getEffectiveUserId();
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

    // Fast-path rejection when obviously already scanning. The atomic claim
    // below is the real race guard; this just saves a useless cooldown lookup.
    if (monitor.isScanning) {
      return NextResponse.json(
        { error: "Scan already in progress", isScanning: true },
        { status: 409 }
      );
    }

    // Check rate limiting (uses lastManualScanAt from pre-claim read — safe
    // because manual-scan cooldown is not affected by in-flight scans).
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

    // SEC-BIZ-01: atomic claim prevents concurrent-scan double-bill.
    // Replaces the previous read-check-update pattern where two rapid POSTs
    // could both pass the isScanning check and both dispatch to Inngest.
    const claim = await db
      .update(monitors)
      .set({ isScanning: true })
      .where(
        and(
          eq(monitors.id, id),
          eq(monitors.userId, userId),
          eq(monitors.isScanning, false)
        )
      )
      .returning({ id: monitors.id });

    if (claim.length === 0) {
      // Monitor exists + belongs to user (verified above), so the only
      // remaining reason the claim failed is isScanning was already true.
      return NextResponse.json(
        { error: "Scan already in progress", isScanning: true },
        { status: 409 }
      );
    }

    // Trigger the on-demand scan via Inngest only AFTER successfully
    // claiming the scan slot — guarantees 1 dispatch per claim.
    await inngest.send({
      name: "monitor/scan-now",
      data: {
        monitorId: id,
        userId,
      },
    });

    revalidateTag("monitors");

    return NextResponse.json({
      success: true,
      message: "Scan started",
      monitorId: id,
    });
  } catch (error) {
    logger.error("Error starting scan:", { error: error instanceof Error ? error.message : String(error) });
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
    const userId = await getEffectiveUserId();
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
        scanProgress: true,
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
      scanProgress: monitor.scanProgress || null,
      lastManualScanAt: monitor.lastManualScanAt?.toISOString() || null,
      lastCheckedAt: monitor.lastCheckedAt?.toISOString() || null,
      newMatchCount: monitor.newMatchCount,
      canScan: cooldownCheck.canScan,
      cooldownRemaining: cooldownCheck.cooldownRemaining,
      nextScanAt: cooldownCheck.nextScanAt?.toISOString() || null,
      cooldownHours,
    });
  } catch (error) {
    logger.error("Error getting scan status:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to get scan status" },
      { status: 500 }
    );
  }
}
