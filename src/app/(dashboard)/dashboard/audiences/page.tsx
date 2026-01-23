import { redirect } from "next/navigation";
import { db, audiences, audienceMonitors, results, monitors } from "@/lib/db";
import { eq, inArray, gte, and } from "drizzle-orm";
import { AudiencesList } from "@/components/dashboard/audiences-list";
import type { AudienceStats } from "@/components/dashboard/audience-card";
import { getSuggestionsFromMonitors } from "@/lib/community-suggestions";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

/**
 * Calculate audience stats from results
 */
async function calculateAudienceStats(
  audienceId: string,
  monitorIds: string[],
  monitorPlatforms: string[][]
): Promise<AudienceStats> {
  if (monitorIds.length === 0) {
    return {
      totalMentions: 0,
      mentionChange: 0,
      dailyMentions: [0, 0, 0, 0, 0, 0, 0],
      platforms: [],
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      monitorCount: monitorIds.length,
    };
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get all results from last 14 days for this audience's monitors
  const recentResults = await db.query.results.findMany({
    where: and(
      inArray(results.monitorId, monitorIds),
      gte(results.createdAt, fourteenDaysAgo)
    ),
    columns: {
      id: true,
      createdAt: true,
      sentiment: true,
    },
  });

  // Split into this week and last week
  const thisWeek = recentResults.filter(r => new Date(r.createdAt) >= sevenDaysAgo);
  const lastWeek = recentResults.filter(r => {
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

  // Calculate sentiment breakdown
  const sentiment = {
    positive: thisWeek.filter(r => r.sentiment === "positive").length,
    neutral: thisWeek.filter(r => r.sentiment === "neutral" || !r.sentiment).length,
    negative: thisWeek.filter(r => r.sentiment === "negative").length,
  };

  // Get unique platforms from all monitors
  const allPlatforms = new Set<string>();
  monitorPlatforms.forEach(platforms => {
    platforms.forEach(p => allPlatforms.add(p));
  });

  return {
    totalMentions: thisWeekCount,
    mentionChange: Math.round(mentionChange * 10) / 10,
    dailyMentions,
    platforms: Array.from(allPlatforms),
    sentiment,
    monitorCount: monitorIds.length,
  };
}

export default async function AudiencesPage() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Fetch audiences for the authenticated user
  const userAudiences = userId
    ? await db.query.audiences.findMany({
        where: eq(audiences.userId, userId),
        orderBy: (audiences, { desc }) => [desc(audiences.createdAt)],
      })
    : [];

  // Get all user monitors for community suggestions
  const userMonitors = userId
    ? await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
        columns: {
          id: true,
          keywords: true,
          platforms: true,
        },
      })
    : [];

  // Generate community suggestions based on monitors
  const suggestions = getSuggestionsFromMonitors(
    userMonitors.map(m => ({ keywords: m.keywords, platforms: m.platforms })),
    [], // No existing communities to exclude for now
    8 // Limit to 8 suggestions
  );

  // For each audience, get monitors and calculate stats
  const audiencesWithStats = await Promise.all(
    userAudiences.map(async (audience) => {
      // Get monitors for this audience
      const monitorLinks = await db.query.audienceMonitors.findMany({
        where: eq(audienceMonitors.audienceId, audience.id),
        with: {
          monitor: {
            columns: {
              id: true,
              platforms: true,
            },
          },
        },
      });

      const monitorIds = monitorLinks.map(ml => ml.monitor.id);
      const monitorPlatforms = monitorLinks.map(ml => ml.monitor.platforms || []);

      // Calculate stats
      const stats = await calculateAudienceStats(
        audience.id,
        monitorIds,
        monitorPlatforms
      );

      return {
        ...audience,
        stats,
      };
    })
  );

  return <AudiencesList audiences={audiencesWithStats} suggestions={suggestions} />;
}
