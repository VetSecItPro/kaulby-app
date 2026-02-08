import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, monitors, results, audiences, webhooks, alerts } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getPlanLimits } from "@/lib/plans";

import { checkApiRateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";

/**
 * User Data Export API
 *
 * Exports all user data in multiple formats:
 * - format=json: Full export as JSON (monitors, results, audiences, settings)
 * - format=csv: Results only as CSV
 * - format=monitors: Monitors only as JSON
 * - format=results: Results only as JSON
 *
 * Part of Phase 3: Data Portability
 */

// Convert results to CSV format
function resultsToCSV(
  resultsData: {
    id: string;
    monitorId: string;
    platform: string;
    sourceUrl: string;
    title: string;
    content: string | null;
    author: string | null;
    postedAt: Date | null;
    sentiment: string | null;
    sentimentScore: number | null;
    conversationCategory: string | null;
    aiSummary: string | null;
    createdAt: Date;
  }[]
): string {
  const headers = [
    "id",
    "monitor_id",
    "platform",
    "source_url",
    "title",
    "content",
    "author",
    "posted_at",
    "sentiment",
    "sentiment_score",
    "conversation_category",
    "ai_summary",
    "created_at",
  ];

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = resultsData.map((r) =>
    [
      r.id,
      r.monitorId,
      r.platform,
      r.sourceUrl,
      r.title,
      r.content,
      r.author,
      r.postedAt?.toISOString(),
      r.sentiment,
      r.sentimentScore,
      r.conversationCategory,
      r.aiSummary,
      r.createdAt.toISOString(),
    ]
      .map(escapeCSV)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check for export
    const rateLimit = await checkApiRateLimit(userId, "export");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    // Get user data
    const userData = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check export access based on tier
    const plan = userData.subscriptionStatus || "free";
    const limits = getPlanLimits(plan);

    // CSV export requires Pro or Enterprise
    if (format === "csv" && !limits.exports.csv) {
      return NextResponse.json(
        { error: "CSV export requires Pro or Enterprise plan" },
        { status: 403 }
      );
    }

    // Get user's monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
    });

    // Get all results for user's monitors
    const monitorIds = userMonitors.map((m) => m.id);
    let userResults: typeof results.$inferSelect[] = [];

    if (monitorIds.length > 0) {
      userResults = await db.query.results.findMany({
        where: inArray(results.monitorId, monitorIds),
        orderBy: (results, { desc }) => [desc(results.createdAt)],
        limit: 50000,
      });
    }

    // Get user's audiences
    const userAudiences = await db.query.audiences.findMany({
      where: eq(audiences.userId, userId),
      with: {
        communities: true,
        audienceMonitors: true,
      },
    });

    // Get user's webhooks
    const userWebhooks = await db.query.webhooks.findMany({
      where: eq(webhooks.userId, userId),
    });

    // Get user's alerts
    const userAlerts =
      monitorIds.length > 0
        ? await db.query.alerts.findMany({
            where: inArray(alerts.monitorId, monitorIds),
          })
        : [];

    // Handle different export formats
    switch (format) {
      case "csv": {
        // Export results as CSV
        const csv = resultsToCSV(userResults);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="kaulby-results-${new Date().toISOString().split("T")[0]}.csv"`,
          },
        });
      }

      case "monitors": {
        // Export monitors only
        const monitorsExport = userMonitors.map((m) => ({
          id: m.id,
          name: m.name,
          companyName: m.companyName,
          keywords: m.keywords,
          searchQuery: m.searchQuery,
          platforms: m.platforms,
          monitorType: m.monitorType,
          discoveryPrompt: m.discoveryPrompt,
          isActive: m.isActive,
          audienceId: m.audienceId,
          createdAt: m.createdAt,
        }));

        return NextResponse.json(monitorsExport, {
          headers: {
            "Content-Disposition": `attachment; filename="kaulby-monitors-${new Date().toISOString().split("T")[0]}.json"`,
          },
        });
      }

      case "results": {
        // Export results only as JSON
        const resultsExport = userResults.map((r) => ({
          id: r.id,
          monitorId: r.monitorId,
          platform: r.platform,
          sourceUrl: r.sourceUrl,
          title: r.title,
          content: r.content,
          author: r.author,
          postedAt: r.postedAt,
          sentiment: r.sentiment,
          sentimentScore: r.sentimentScore,
          conversationCategory: r.conversationCategory,
          aiSummary: r.aiSummary,
          aiAnalysis: r.aiAnalysis,
          metadata: r.metadata,
          createdAt: r.createdAt,
        }));

        return NextResponse.json(resultsExport, {
          headers: {
            "Content-Disposition": `attachment; filename="kaulby-results-${new Date().toISOString().split("T")[0]}.json"`,
          },
        });
      }

      case "json":
      default: {
        // Full export as JSON
        const fullExport = {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            timezone: userData.timezone,
            subscriptionStatus: userData.subscriptionStatus,
            isFoundingMember: userData.isFoundingMember,
            createdAt: userData.createdAt,
          },
          monitors: userMonitors.map((m) => ({
            id: m.id,
            name: m.name,
            companyName: m.companyName,
            keywords: m.keywords,
            searchQuery: m.searchQuery,
            platforms: m.platforms,
            monitorType: m.monitorType,
            discoveryPrompt: m.discoveryPrompt,
            isActive: m.isActive,
            audienceId: m.audienceId,
            filters: m.filters,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          })),
          audiences: userAudiences.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            color: a.color,
            icon: a.icon,
            communities: a.communities.map((c) => ({
              platform: c.platform,
              identifier: c.identifier,
              metadata: c.metadata,
            })),
            monitorIds: a.audienceMonitors.map((am) => am.monitorId),
            createdAt: a.createdAt,
          })),
          webhooks: userWebhooks.map((w) => ({
            id: w.id,
            name: w.name,
            url: w.url,
            events: w.events,
            isActive: w.isActive,
            createdAt: w.createdAt,
          })),
          alerts: userAlerts.map((a) => ({
            id: a.id,
            monitorId: a.monitorId,
            channel: a.channel,
            frequency: a.frequency,
            destination: a.destination,
            isActive: a.isActive,
            createdAt: a.createdAt,
          })),
          results: userResults.map((r) => ({
            id: r.id,
            monitorId: r.monitorId,
            platform: r.platform,
            sourceUrl: r.sourceUrl,
            title: r.title,
            content: r.content,
            author: r.author,
            postedAt: r.postedAt,
            sentiment: r.sentiment,
            sentimentScore: r.sentimentScore,
            painPointCategory: r.painPointCategory,
            conversationCategory: r.conversationCategory,
            aiSummary: r.aiSummary,
            aiAnalysis: r.aiAnalysis,
            metadata: r.metadata,
            isSaved: r.isSaved,
            createdAt: r.createdAt,
          })),
          stats: {
            totalMonitors: userMonitors.length,
            activeMonitors: userMonitors.filter((m) => m.isActive).length,
            totalResults: userResults.length,
            totalAudiences: userAudiences.length,
            totalWebhooks: userWebhooks.length,
          },
        };

        return NextResponse.json(fullExport, {
          headers: {
            "Content-Disposition": `attachment; filename="kaulby-export-${new Date().toISOString().split("T")[0]}.json"`,
          },
        });
      }
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
