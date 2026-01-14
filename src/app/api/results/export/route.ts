import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, monitors, results } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getPlanLimits } from "@/lib/stripe";

// Force dynamic rendering
export const dynamic = "force-dynamic";

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

    // Filter to specific monitor if requested
    const monitorIds = monitorId
      ? [monitorId]
      : userMonitors.map(m => m.id);

    // Get results
    const userResults = await db.query.results.findMany({
      where: inArray(results.monitorId, monitorIds),
      orderBy: desc(results.createdAt),
      limit: 10000, // Limit to prevent huge exports
    });

    if (userResults.length === 0) {
      return NextResponse.json(
        { error: "No results to export" },
        { status: 404 }
      );
    }

    // Create monitor name lookup
    const monitorNames = Object.fromEntries(
      userMonitors.map(m => [m.id, m.name])
    );

    // Generate CSV
    const headers = [
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

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = userResults.map(r => [
      r.id,
      monitorNames[r.monitorId] || "Unknown",
      r.platform,
      escapeCSV(r.title),
      r.sourceUrl,
      escapeCSV(r.author),
      escapeCSV(r.content?.substring(0, 1000)), // Limit content length
      r.sentiment || "",
      r.sentimentScore?.toString() || "",
      r.painPointCategory || "",
      escapeCSV(r.aiSummary),
      r.postedAt?.toISOString() || "",
      r.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");

    // Return as downloadable CSV
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="kaulby-results-${new Date().toISOString().split("T")[0]}.csv"`,
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
