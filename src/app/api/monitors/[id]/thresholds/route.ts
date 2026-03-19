import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const thresholdsSchema = z.object({
  negativeSpikePct: z
    .number()
    .positive("Must be a positive number")
    .max(1000, "Must be 1000 or less")
    .optional(),
  viralEngagement: z
    .number()
    .positive("Must be a positive number")
    .int("Must be a whole number")
    .max(100000, "Must be 100,000 or less")
    .optional(),
  minNegativeCount: z
    .number()
    .positive("Must be a positive number")
    .int("Must be a whole number")
    .max(1000, "Must be 1,000 or less")
    .optional(),
  volumeSpikeMultiplier: z
    .number()
    .gt(1, "Must be greater than 1")
    .max(100, "Must be 100 or less")
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getEffectiveUserId();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify monitor exists and belongs to user
    const monitor = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
      columns: { id: true, crisisThresholds: true },
    });

    if (!monitor) {
      return NextResponse.json(
        { error: "Monitor not found" },
        { status: 404 },
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = thresholdsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid threshold values",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Merge with existing thresholds (partial updates allowed)
    const defaults = {
      negativeSpikePct: 50,
      viralEngagement: 100,
      minNegativeCount: 5,
      volumeSpikeMultiplier: 2,
    };
    const existing = monitor.crisisThresholds ?? defaults;
    const updatedThresholds = {
      negativeSpikePct: parsed.data.negativeSpikePct ?? existing.negativeSpikePct,
      viralEngagement: parsed.data.viralEngagement ?? existing.viralEngagement,
      minNegativeCount: parsed.data.minNegativeCount ?? existing.minNegativeCount,
      volumeSpikeMultiplier: parsed.data.volumeSpikeMultiplier ?? existing.volumeSpikeMultiplier,
    };

    await db
      .update(monitors)
      .set({
        crisisThresholds: updatedThresholds,
        updatedAt: new Date(),
      })
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)));

    return NextResponse.json({
      success: true,
      crisisThresholds: updatedThresholds,
    });
  } catch (error) {
    logger.error("Failed to update crisis thresholds:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
