import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import { eq, and, inArray, desc, lt } from "drizzle-orm";
import { getPlanLimits } from "@/lib/plans";

// Force dynamic rendering
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;
const MAX_ROWS = 10000;

const CSV_HEADERS = [
  "ID",
  "Monitor",
  "Platform",
  "Title",
  "URL",
  "Author",
  "Content",
  "Sentiment",
  "Sentiment Score",
  "Pain Point Category",
  "AI Summary",
  "Posted At",
  "Found At",
];

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has CSV export access
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true },
    });

    const plan = user?.subscriptionStatus || "free";
    const limits = getPlanLimits(plan);

    if (!limits.exports.csv) {
      return NextResponse.json(
        { error: "CSV export is only available for Pro and Enterprise users" },
        { status: 403 }
      );
    }

    // Get optional monitorId filter
    const { searchParams } = new URL(request.url);
    const monitorId = searchParams.get("monitorId");

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      columns: { id: true, name: true },
    });

    if (userMonitors.length === 0) {
      return NextResponse.json(
        { error: "No monitors found" },
        { status: 404 }
      );
    }

    // Filter to specific monitor if requested (validate ownership)
    const userMonitorIds = userMonitors.map(m => m.id);
    const monitorIds = monitorId
      ? (userMonitorIds.includes(monitorId) ? [monitorId] : [])
      : userMonitorIds;

    // Reject if monitorId was provided but user doesn't own it
    if (monitorId && monitorIds.length === 0) {
      return NextResponse.json(
        { error: "Monitor not found or access denied" },
        { status: 403 }
      );
    }

    // Create monitor name lookup
    const monitorNames = Object.fromEntries(
      userMonitors.map(m => [m.id, m.name])
    );

    // Stream CSV in batches using cursor-based pagination
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Write CSV header
          controller.enqueue(encoder.encode(CSV_HEADERS.join(",") + "\n"));

          let cursor: Date | null = null;
          let totalRows = 0;

          while (totalRows < MAX_ROWS) {
            const batch: Array<{
              id: string;
              monitorId: string;
              platform: string;
              title: string | null;
              sourceUrl: string;
              author: string | null;
              content: string | null;
              sentiment: string | null;
              sentimentScore: number | null;
              painPointCategory: string | null;
              aiSummary: string | null;
              postedAt: Date | null;
              createdAt: Date;
            }> = await db.query.results.findMany({
              where: cursor
                ? and(
                    inArray(results.monitorId, monitorIds),
                    lt(results.createdAt, cursor)
                  )
                : inArray(results.monitorId, monitorIds),
              orderBy: desc(results.createdAt),
              limit: BATCH_SIZE,
              columns: {
                id: true,
                monitorId: true,
                platform: true,
                title: true,
                sourceUrl: true,
                author: true,
                content: true,
                sentiment: true,
                sentimentScore: true,
                painPointCategory: true,
                aiSummary: true,
                postedAt: true,
                createdAt: true,
              },
            });

            if (batch.length === 0) break;

            // Write batch rows
            const csvChunk = batch.map(r =>
              [
                r.id,
                monitorNames[r.monitorId] || "Unknown",
                r.platform,
                escapeCSV(r.title),
                r.sourceUrl,
                escapeCSV(r.author),
                escapeCSV(r.content?.substring(0, 1000)),
                r.sentiment || "",
                r.sentimentScore?.toString() || "",
                r.painPointCategory || "",
                escapeCSV(r.aiSummary),
                r.postedAt?.toISOString() || "",
                r.createdAt.toISOString(),
              ].join(",")
            ).join("\n") + "\n";

            controller.enqueue(encoder.encode(csvChunk));
            totalRows += batch.length;

            // Move cursor to last item's createdAt
            cursor = batch[batch.length - 1].createdAt;

            if (batch.length < BATCH_SIZE) break;
          }

          controller.close();
        } catch (error) {
          console.error("CSV stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="kaulby-results-${new Date().toISOString().split("T")[0]}.csv"`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export results" },
      { status: 500 }
    );
  }
}
