/**
 * Shared Reports Management API
 *
 * GET  /api/reports/share/[id] - List user's shared reports (id param is "list")
 * DELETE /api/reports/share/[id] - Deactivate a shared report by ID
 */

import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, sharedReports } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const { id } = await params;

    if (id === "list") {
      // List all shared reports for this user
      const reports = await db.query.sharedReports.findMany({
        where: eq(sharedReports.userId, userId),
        orderBy: [desc(sharedReports.createdAt)],
        limit: 100,
        columns: {
          id: true,
          title: true,
          shareToken: true,
          periodStart: true,
          periodEnd: true,
          expiresAt: true,
          isActive: true,
          viewCount: true,
          createdAt: true,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com";
      const reportsWithUrls = reports.map((r) => ({
        ...r,
        shareUrl: `${appUrl}/report/${r.shareToken}`,
        isExpired: r.expiresAt ? new Date(r.expiresAt) < new Date() : false,
      }));

      return NextResponse.json({ reports: reportsWithUrls });
    }

    // Get a single shared report
    const report = await db.query.sharedReports.findFirst({
      where: and(eq(sharedReports.id, id), eq(sharedReports.userId, userId)),
    });

    if (!report) {
      return NextResponse.json({ error: "Shared report not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com";
    return NextResponse.json({
      ...report,
      shareUrl: `${appUrl}/report/${report.shareToken}`,
      isExpired: report.expiresAt ? new Date(report.expiresAt) < new Date() : false,
    });
  } catch (error) {
    logger.error("List shared reports error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to fetch shared reports" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const { id } = await params;

    // Verify ownership and deactivate
    const [updated] = await db
      .update(sharedReports)
      .set({ isActive: false })
      .where(and(eq(sharedReports.id, id), eq(sharedReports.userId, userId)))
      .returning({ id: sharedReports.id });

    if (!updated) {
      return NextResponse.json({ error: "Shared report not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: updated.id });
  } catch (error) {
    logger.error("Delete shared report error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to deactivate shared report" },
      { status: 500 }
    );
  }
}
