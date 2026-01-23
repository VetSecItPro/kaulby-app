import { redirect, notFound } from "next/navigation";
import { db, audiences, audienceMonitors, results, monitors } from "@/lib/db";
import { eq, and, inArray, desc, gte } from "drizzle-orm";
import { AudienceDetail, type AudienceDetailStats } from "@/components/dashboard/audience-detail";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

interface AudiencePageProps {
  params: Promise<{ id: string }>;
}

/**
 * Calculate detailed stats for the audience detail page
 */
function calculateDetailStats(
  allResults: Array<{
    id: string;
    createdAt: Date;
    platform: string;
    sentiment: string | null;
    engagementScore: number | null;
  }>
): AudienceDetailStats {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Split into this week and last week
  const thisWeek = allResults.filter(r => new Date(r.createdAt) >= sevenDaysAgo);
  const lastWeek = allResults.filter(r => {
    const date = new Date(r.createdAt);
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });

  // Calculate daily mentions for sparkline
  const dailyMentions: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = thisWeek.filter(r => {
      const date = new Date(r.createdAt);
      return date >= dayStart && date < dayEnd;
    }).length;
    dailyMentions.push(count);
  }

  // Calculate change percentage
  const thisWeekCount = thisWeek.length;
  const lastWeekCount = lastWeek.length;
  const mentionChange = lastWeekCount > 0
    ? ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100
    : thisWeekCount > 0 ? 100 : 0;

  // Platform breakdown
  const platformBreakdown: Record<string, { count: number; sentiment: { positive: number; neutral: number; negative: number } }> = {};
  thisWeek.forEach(r => {
    if (!platformBreakdown[r.platform]) {
      platformBreakdown[r.platform] = { count: 0, sentiment: { positive: 0, neutral: 0, negative: 0 } };
    }
    platformBreakdown[r.platform].count++;
    if (r.sentiment === "positive") platformBreakdown[r.platform].sentiment.positive++;
    else if (r.sentiment === "negative") platformBreakdown[r.platform].sentiment.negative++;
    else platformBreakdown[r.platform].sentiment.neutral++;
  });

  // Overall sentiment
  const sentiment = {
    positive: thisWeek.filter(r => r.sentiment === "positive").length,
    neutral: thisWeek.filter(r => r.sentiment === "neutral" || !r.sentiment).length,
    negative: thisWeek.filter(r => r.sentiment === "negative").length,
  };

  // Average engagement
  const engagementScores = thisWeek
    .map(r => r.engagementScore)
    .filter((e): e is number => e !== null && e !== undefined);
  const avgEngagement = engagementScores.length > 0
    ? Math.round(engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length)
    : 0;

  return {
    totalMentions: thisWeekCount,
    mentionChange: Math.round(mentionChange * 10) / 10,
    dailyMentions,
    sentiment,
    platformBreakdown,
    avgEngagement,
    totalAllTime: allResults.length,
  };
}

export default async function AudiencePage({ params }: AudiencePageProps) {
  const userId = await getEffectiveUserId();
  const { id } = await params;

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Fetch the audience
  const audience = userId
    ? await db.query.audiences.findFirst({
        where: and(eq(audiences.id, id), eq(audiences.userId, userId)),
      })
    : null;

  if (!audience) {
    notFound();
  }

  // Get monitors through junction table
  const audienceMonitorLinks = await db.query.audienceMonitors.findMany({
    where: eq(audienceMonitors.audienceId, id),
    with: {
      monitor: true,
    },
  });

  const audienceMonitorsList = audienceMonitorLinks.map((am) => am.monitor);
  const monitorIds = audienceMonitorsList.map((m) => m.id);

  // Get results from last 14 days for stats calculation
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let statsResults: Array<{
    id: string;
    createdAt: Date;
    platform: string;
    sentiment: string | null;
    engagementScore: number | null;
  }> = [];

  let recentResults: (typeof results.$inferSelect)[] = [];

  if (monitorIds.length > 0) {
    // Fetch stats data (lightweight, last 14 days)
    statsResults = await db.query.results.findMany({
      where: and(
        inArray(results.monitorId, monitorIds),
        gte(results.createdAt, fourteenDaysAgo)
      ),
      columns: {
        id: true,
        createdAt: true,
        platform: true,
        sentiment: true,
        engagementScore: true,
      },
    });

    // Fetch recent results for display (full data, limited)
    recentResults = await db.query.results.findMany({
      where: inArray(results.monitorId, monitorIds),
      orderBy: [desc(results.createdAt)],
      limit: 50,
    });
  }

  // Calculate stats
  const stats = calculateDetailStats(statsResults);

  // Get all user's monitors for the "add monitor" dropdown
  const allUserMonitors = userId
    ? await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
        orderBy: [desc(monitors.createdAt)],
      })
    : [];

  // Filter out monitors already in this audience
  const availableMonitors = allUserMonitors.filter(
    (m) => !monitorIds.includes(m.id)
  );

  return (
    <AudienceDetail
      audience={audience}
      monitors={audienceMonitorsList}
      results={recentResults}
      availableMonitors={availableMonitors}
      stats={stats}
    />
  );
}
