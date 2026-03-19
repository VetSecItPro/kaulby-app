/**
 * Shared Reports API
 *
 * POST - Create a shareable public report link
 */

import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, monitors, results, sharedReports } from "@/lib/db";
import { eq, and, gte, inArray, desc, sql } from "drizzle-orm";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
import crypto from "crypto";
import { logger } from "@/lib/logger";

interface ShareReportRequest {
  monitorId?: string; // Optional - if omitted, aggregates all monitors
  title: string;
  periodDays: 7 | 30 | 90;
  expiresInDays?: number; // Optional expiry (e.g., 7, 30, 90)
}

export async function POST(req: Request) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const body: ShareReportRequest = await parseJsonBody(req, 65536); // 64KB
    const { monitorId, title, periodDays, expiresInDays } = body;

    if (!title || typeof title !== "string" || title.length > 200) {
      return NextResponse.json(
        { error: "Title is required and must be under 200 characters" },
        { status: 400 }
      );
    }

    if (!periodDays || ![7, 30, 90].includes(periodDays)) {
      return NextResponse.json(
        { error: "periodDays must be 7, 30, or 90" },
        { status: 400 }
      );
    }

    if (expiresInDays !== undefined && (typeof expiresInDays !== "number" || expiresInDays < 1 || expiresInDays > 365)) {
      return NextResponse.json(
        { error: "expiresInDays must be between 1 and 365" },
        { status: 400 }
      );
    }

    // Calculate date range
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Build monitor ID list
    let monitorIds: string[];

    if (monitorId) {
      // Verify monitor belongs to this user
      const monitor = await db.query.monitors.findFirst({
        where: and(eq(monitors.id, monitorId), eq(monitors.userId, userId)),
        columns: { id: true, name: true },
      });
      if (!monitor) {
        return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
      }
      monitorIds = [monitorId];
    } else {
      // Aggregate all user's monitors
      const userMonitors = await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
        columns: { id: true },
      });
      if (userMonitors.length === 0) {
        return NextResponse.json(
          { error: "No monitors found. Create monitors before sharing reports." },
          { status: 400 }
        );
      }
      monitorIds = userMonitors.map((m) => m.id);
    }

    // Gather report data in parallel
    const [mentionData, platformData, topPostsData] = await Promise.all([
      // Total mentions with sentiment breakdown
      db
        .select({
          total: sql<number>`count(*)`,
          positive: sql<number>`count(*) filter (where ${results.sentiment} = 'positive')`,
          neutral: sql<number>`count(*) filter (where ${results.sentiment} = 'neutral')`,
          negative: sql<number>`count(*) filter (where ${results.sentiment} = 'negative')`,
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, periodStart)
          )
        ),

      // Platform breakdown
      db
        .select({
          platform: results.platform,
          mentions: sql<number>`count(*)`,
          engagement: sql<number>`coalesce(sum(${results.engagementScore}), 0)`,
        })
        .from(results)
        .where(
          and(
            inArray(results.monitorId, monitorIds),
            gte(results.createdAt, periodStart)
          )
        )
        .groupBy(results.platform)
        .orderBy(sql`count(*) desc`),

      // Top posts by engagement
      db.query.results.findMany({
        where: and(
          inArray(results.monitorId, monitorIds),
          gte(results.createdAt, periodStart)
        ),
        orderBy: [desc(results.engagementScore)],
        limit: 15,
        columns: {
          title: true,
          platform: true,
          sentiment: true,
          engagementScore: true,
          sourceUrl: true,
          postedAt: true,
        },
      }),
    ]);

    // Build the report data snapshot
    const reportData: Record<string, unknown> = {
      totals: {
        mentions: Number(mentionData[0]?.total || 0),
        positive: Number(mentionData[0]?.positive || 0),
        neutral: Number(mentionData[0]?.neutral || 0),
        negative: Number(mentionData[0]?.negative || 0),
      },
      platforms: platformData.map((p) => ({
        platform: p.platform,
        mentions: Number(p.mentions),
        engagement: Number(p.engagement),
      })),
      topPosts: topPostsData.map((p) => ({
        title: p.title,
        platform: p.platform,
        sentiment: p.sentiment || "neutral",
        engagement: p.engagementScore || 0,
        url: p.sourceUrl,
        postedAt: p.postedAt?.toISOString() || null,
      })),
    };

    // Generate share token and calculate expiry
    const shareToken = crypto.randomUUID();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Save to database
    const [sharedReport] = await db
      .insert(sharedReports)
      .values({
        userId,
        monitorId: monitorId || null,
        shareToken,
        title,
        periodStart,
        periodEnd,
        reportData,
        expiresAt,
      })
      .returning({ id: sharedReports.id, shareToken: sharedReports.shareToken });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kaulbyapp.com";
    const shareUrl = `${appUrl}/report/${shareToken}`;

    return NextResponse.json({
      id: sharedReport.id,
      shareUrl,
      shareToken: sharedReport.shareToken,
      expiresAt: expiresAt?.toISOString() || null,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    logger.error("Share report error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to create shared report" },
      { status: 500 }
    );
  }
}
