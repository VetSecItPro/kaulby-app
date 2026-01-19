import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, monitors, results, alerts, aiLogs, usage, audiences, communities } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user data
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all monitors
    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
    });

    // Get all results for user's monitors
    const monitorIds = userMonitors.map(m => m.id);
    let userResults: typeof results.$inferSelect[] = [];
    if (monitorIds.length > 0) {
      userResults = await db.query.results.findMany({
        where: inArray(results.monitorId, monitorIds),
      });
    }

    // Get all alerts for user's monitors
    let userAlerts: typeof alerts.$inferSelect[] = [];
    if (monitorIds.length > 0) {
      userAlerts = await db.query.alerts.findMany({
        where: inArray(alerts.monitorId, monitorIds),
      });
    }

    // Get AI logs
    const userAiLogs = await db.query.aiLogs.findMany({
      where: eq(aiLogs.userId, userId),
    });

    // Get usage records
    const userUsage = await db.query.usage.findMany({
      where: eq(usage.userId, userId),
    });

    // Get audiences
    const userAudiences = await db.query.audiences.findMany({
      where: eq(audiences.userId, userId),
    });

    // Get communities for user's audiences
    const audienceIds = userAudiences.map(a => a.id);
    let userCommunities: typeof communities.$inferSelect[] = [];
    if (audienceIds.length > 0) {
      userCommunities = await db.query.communities.findMany({
        where: inArray(communities.audienceId, audienceIds),
      });
    }

    // Compile export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
      },
      monitors: userMonitors.map(m => ({
        id: m.id,
        name: m.name,
        keywords: m.keywords,
        platforms: m.platforms,
        isActive: m.isActive,
        createdAt: m.createdAt,
      })),
      results: userResults.map(r => ({
        id: r.id,
        monitorId: r.monitorId,
        platform: r.platform,
        title: r.title,
        content: r.content,
        sourceUrl: r.sourceUrl,
        author: r.author,
        sentiment: r.sentiment,
        sentimentScore: r.sentimentScore,
        painPointCategory: r.painPointCategory,
        aiSummary: r.aiSummary,
        createdAt: r.createdAt,
      })),
      alerts: userAlerts.map(a => ({
        id: a.id,
        monitorId: a.monitorId,
        channel: a.channel,
        frequency: a.frequency,
        destination: a.destination,
        isActive: a.isActive,
        createdAt: a.createdAt,
      })),
      audiences: userAudiences.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        createdAt: a.createdAt,
      })),
      communities: userCommunities.map(c => ({
        id: c.id,
        audienceId: c.audienceId,
        platform: c.platform,
        identifier: c.identifier,
        createdAt: c.createdAt,
      })),
      aiUsage: {
        totalCalls: userAiLogs.length,
        logs: userAiLogs.map(l => ({
          model: l.model,
          promptTokens: l.promptTokens,
          completionTokens: l.completionTokens,
          costUsd: l.costUsd,
          createdAt: l.createdAt,
        })),
      },
      usageHistory: userUsage.map(u => ({
        periodStart: u.periodStart,
        periodEnd: u.periodEnd,
        resultsCount: u.resultsCount,
        aiCallsCount: u.aiCallsCount,
      })),
    };

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="kaulby-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
